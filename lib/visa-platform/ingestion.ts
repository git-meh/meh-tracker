import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  jobIngestionRuns,
  jobs,
  type ApplyAdapter,
  type EmploymentType,
  type JobSourceType,
  type VisaSponsorshipStatus,
  type WorkMode,
} from "@/lib/db/schema"
import {
  normalizeCountryCodes,
  resolveCountryMetadata,
} from "@/lib/visa-platform/countries"

export type IngestibleJob = {
  url: string
  title: string
  company: string
  description?: string | null
  salaryRange?: string | null
  salaryMin?: number | null
  salaryMax?: number | null
  currency?: string | null
  location?: string | null
  countryCode?: string | null
  countryConfidence?: string | null
  tags?: string[]
  eligibleCountries?: string[]
  sourceId?: string | null
  sourceType?: JobSourceType
  sourceKey?: string | null
  sourceJobId?: string | null
  applyAdapter?: ApplyAdapter
  visaSponsorshipStatus?: VisaSponsorshipStatus
  workMode?: WorkMode
  employmentType?: EmploymentType
  closingAt?: Date | null
}

export function buildJobDedupeKey(
  job: Pick<IngestibleJob, "url" | "sourceJobId" | "company" | "title" | "sourceKey" | "sourceType">
) {
  const sourcePrefix = (job.sourceKey ?? job.sourceType ?? "unknown").toLowerCase()

  if (job.sourceJobId) {
    return `${sourcePrefix}:source:${job.sourceJobId}`.toLowerCase()
  }

  try {
    const parsed = new URL(job.url)
    return `${sourcePrefix}:${parsed.hostname}${parsed.pathname}`
      .replace(/\/+$/, "")
      .toLowerCase()
  } catch {
    return `${sourcePrefix}:${job.company}:${job.title}:${job.url}`.toLowerCase()
  }
}

export async function ingestJobs(args: {
  sourceId?: string | null
  payload: IngestibleJob[]
}) {
  const [run] = await db
    .insert(jobIngestionRuns)
    .values({
      sourceId: args.sourceId ?? null,
      status: "running",
      startedAt: new Date(),
    })
    .returning()

  let jobsInserted = 0
  let jobsUpdated = 0
  let jobsSkipped = 0

  try {
    for (const payload of args.payload) {
      if (!payload.url?.trim() || !payload.title?.trim() || !payload.company?.trim()) {
        jobsSkipped += 1
        continue
      }

      const { countryCode, countryConfidence } = resolveCountryMetadata({
        countryCode: payload.countryCode,
        location: payload.location,
      })
      const dedupeKey = buildJobDedupeKey(payload)
      const [existing] = await db
        .select()
        .from(jobs)
        .where(eq(jobs.dedupeKey, dedupeKey))
        .limit(1)

      const eligibleCountries = normalizeCountryCodes(
        payload.eligibleCountries?.length
          ? payload.eligibleCountries
          : countryCode
            ? [countryCode]
            : []
      )

      const values = {
        title: payload.title.trim(),
        company: payload.company.trim(),
        url: payload.url.trim(),
        description: payload.description ?? null,
        salaryRange: payload.salaryRange ?? null,
        salaryMin: payload.salaryMin ?? null,
        salaryMax: payload.salaryMax ?? null,
        currency: payload.currency ?? "GBP",
        location: payload.location ?? null,
        countryCode,
        countryConfidence: payload.countryConfidence ?? countryConfidence,
        tags: payload.tags ?? [],
        eligibleCountries,
        sourceId: payload.sourceId ?? args.sourceId ?? null,
        sourceType: payload.sourceType ?? "approved_feed",
        sourceKey: (payload.sourceKey ?? payload.sourceType ?? "approved-feed")
          .trim()
          .toLowerCase(),
        sourceJobId: payload.sourceJobId ?? null,
        dedupeKey,
        applyAdapter: payload.applyAdapter ?? "none",
        visaSponsorshipStatus: payload.visaSponsorshipStatus ?? "unknown",
        workMode: payload.workMode ?? "unknown",
        employmentType: payload.employmentType ?? "unknown",
        closingAt: payload.closingAt ?? null,
        ingestedAt: new Date(),
        updatedAt: new Date(),
      } satisfies typeof jobs.$inferInsert

      if (existing) {
        await db.update(jobs).set(values).where(eq(jobs.id, existing.id))
        jobsUpdated += 1
      } else {
        await db.insert(jobs).values(values)
        jobsInserted += 1
      }
    }

    const [updatedRun] = await db
      .update(jobIngestionRuns)
      .set({
        status: "succeeded",
        jobsSeen: args.payload.length,
        jobsInserted,
        jobsUpdated,
        jobsSkipped,
        finishedAt: new Date(),
      })
      .where(eq(jobIngestionRuns.id, run.id))
      .returning()

    return updatedRun
  } catch (error) {
    const [failedRun] = await db
      .update(jobIngestionRuns)
      .set({
        status: "failed",
        jobsSeen: args.payload.length,
        jobsInserted,
        jobsUpdated,
        jobsSkipped,
        error: error instanceof Error ? error.message : "Ingestion failed",
        finishedAt: new Date(),
      })
      .where(eq(jobIngestionRuns.id, run.id))
      .returning()

    throw failedRun
  }
}
