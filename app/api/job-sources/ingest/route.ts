import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { ingestJobs } from "@/lib/visa-platform/ingestion"
import { resolveCountryMetadata } from "@/lib/visa-platform/countries"

const ingestSchema = z.object({
  sourceId: z.string().uuid().nullable().optional(),
  jobs: z
    .array(
      z.object({
        url: z.string().url(),
        title: z.string().min(1).max(200),
        company: z.string().min(1).max(200),
        description: z.string().max(100000).nullable().optional(),
        salaryRange: z.string().max(120).nullable().optional(),
        salaryMin: z.number().int().min(0).nullable().optional(),
        salaryMax: z.number().int().min(0).nullable().optional(),
        currency: z.string().max(10).nullable().optional(),
        location: z.string().max(200).nullable().optional(),
        countryCode: z.string().max(120).nullable().optional(),
        countryConfidence: z.string().max(40).nullable().optional(),
        tags: z.array(z.string().max(60)).max(20).optional(),
        eligibleCountries: z.array(z.string().max(2)).max(20).optional(),
        sourceId: z.string().uuid().nullable().optional(),
        sourceType: z.enum(["manual", "approved_feed", "employer_site", "ats"]).optional(),
        sourceKey: z.string().max(120).nullable().optional(),
        sourceJobId: z.string().max(200).nullable().optional(),
        applyAdapter: z.enum([
          "none",
          "greenhouse",
          "lever",
          "workday",
          "ashby",
          "smartrecruiters",
          "manual_external",
        ]).optional(),
        visaSponsorshipStatus: z
          .enum(["eligible", "possible", "not_available", "unknown"])
          .optional(),
        workMode: z.enum(["remote", "hybrid", "onsite", "unknown"]).optional(),
        employmentType: z
          .enum([
            "full_time",
            "part_time",
            "contract",
            "internship",
            "temporary",
            "apprenticeship",
            "unknown",
          ])
          .optional(),
        closingAt: z.string().datetime().nullable().optional(),
      })
    )
    .min(1)
    .max(250),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const configuredIngestionKey = process.env.JOB_INGESTION_API_KEY?.trim()
  const requestIngestionKey =
    request.headers.get("x-job-ingestion-key")?.trim() ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim()

  const hasValidIngestionKey =
    Boolean(configuredIngestionKey) &&
    Boolean(requestIngestionKey) &&
    configuredIngestionKey === requestIngestionKey

  if (!user && !hasValidIngestionKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = ingestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const run = await ingestJobs({
      sourceId: parsed.data.sourceId ?? null,
      payload: parsed.data.jobs.map((job) => {
        const { countryCode, countryConfidence } = resolveCountryMetadata({
          countryCode: job.countryCode,
          location: job.location,
        })

        return {
          ...job,
          description: job.description ?? null,
          salaryRange: job.salaryRange ?? null,
          currency: job.currency ?? "GBP",
          location: job.location ?? null,
          countryCode,
          countryConfidence: job.countryConfidence ?? countryConfidence,
          sourceId: job.sourceId ?? parsed.data.sourceId ?? null,
          sourceKey: job.sourceKey?.trim().toLowerCase() ?? job.sourceType ?? "approved-feed",
          sourceJobId: job.sourceJobId ?? null,
          closingAt: job.closingAt ? new Date(job.closingAt) : null,
        }
      }),
    })

    return NextResponse.json(run, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Job ingestion failed",
      },
      { status: 500 }
    )
  }
}
