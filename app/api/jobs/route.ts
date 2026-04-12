import { NextResponse } from "next/server"
import { z } from "zod"
import { desc, eq } from "drizzle-orm"
import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db"
import { jobMatches, jobs } from "@/lib/db/schema"
import { filterJobs, parseJobDiscoveryFilters } from "@/lib/visa-platform/discovery"
import {
  normalizeCountryCodes,
  resolveCountryMetadata,
} from "@/lib/visa-platform/countries"

const createJobSchema = z.object({
  url: z.string().url(),
  title: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  salaryRange: z.string().max(100).optional(),
  salaryMin: z.number().int().min(0).nullable().optional(),
  salaryMax: z.number().int().min(0).nullable().optional(),
  currency: z.string().max(10).optional(),
  location: z.string().max(200).optional(),
  tags: z.array(z.string().max(50)).max(10).default([]),
  countryCode: z.string().max(120).optional(),
  eligibleCountries: z.array(z.string().max(120)).max(20).default([]),
  sourceId: z.string().uuid().nullable().optional(),
  sourceType: z.enum(["manual", "approved_feed", "employer_site", "ats"]).optional(),
  sourceKey: z.string().max(120).optional(),
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

function deriveFromUrl(url: string) {
  try {
    const { hostname, pathname } = new URL(url)
    const host = hostname.replace(/^www\./, "")
    const slug = pathname.split("/").filter(Boolean).pop() ?? ""
    const title = slug
      ? slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : host
    return { title, company: host }
  } catch {
    return { title: url, company: "Unknown" }
  }
}

export async function GET(request: Request) {
  const allJobs = await db.select().from(jobs).orderBy(desc(jobs.createdAt))
  const searchParams = Object.fromEntries(new URL(request.url).searchParams.entries())
  const filters = parseJobDiscoveryFilters(searchParams)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const matches = user
    ? await db
        .select()
        .from(jobMatches)
        .where(eq(jobMatches.userId, user.id))
    : []

  const matchMap = new Map(matches.map((match) => [match.jobId, match.score]))
  const sponsorshipRank = {
    eligible: 0,
    possible: 1,
    unknown: 2,
    not_available: 3,
  } as const

  const filteredJobs = filterJobs(
    allJobs.map((job) => ({
      ...job,
      matchScore: matchMap.get(job.id) ?? null,
    })),
    filters
  ).sort((left, right) => {
    const sponsorshipDiff =
      sponsorshipRank[left.visaSponsorshipStatus] -
      sponsorshipRank[right.visaSponsorshipStatus]
    if (sponsorshipDiff !== 0) return sponsorshipDiff

    if (user) {
      const matchDiff = (right.matchScore ?? -1) - (left.matchScore ?? -1)
      if (matchDiff !== 0) return matchDiff
    }

    const leftCountryRank = left.countryCode === "GB" ? 0 : left.countryCode ? 1 : 2
    const rightCountryRank = right.countryCode === "GB" ? 0 : right.countryCode ? 1 : 2
    if (leftCountryRank !== rightCountryRank) {
      return leftCountryRank - rightCountryRank
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  })

  return NextResponse.json(filteredJobs)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = createJobSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const derived = deriveFromUrl(parsed.data.url)
  const { countryCode, countryConfidence } = resolveCountryMetadata({
    countryCode: parsed.data.countryCode,
    location: parsed.data.location,
  })
  const sourceKey = (parsed.data.sourceKey ?? parsed.data.sourceType ?? "manual")
    .trim()
    .toLowerCase()
  const eligibleCountries = normalizeCountryCodes(
    parsed.data.eligibleCountries?.length
      ? parsed.data.eligibleCountries
      : countryCode
        ? [countryCode]
        : []
  )

  const [job] = await db
    .insert(jobs)
    .values({
      ...parsed.data,
      title: parsed.data.title || derived.title,
      company: parsed.data.company || derived.company,
      salaryMin: parsed.data.salaryMin ?? null,
      salaryMax: parsed.data.salaryMax ?? null,
      currency: parsed.data.currency ?? "GBP",
      countryCode,
      countryConfidence,
      eligibleCountries,
      sourceId: parsed.data.sourceId ?? null,
      sourceType: parsed.data.sourceType ?? "manual",
      sourceKey,
      sourceJobId: parsed.data.sourceJobId ?? null,
      applyAdapter: parsed.data.applyAdapter ?? "manual_external",
      visaSponsorshipStatus: parsed.data.visaSponsorshipStatus ?? "unknown",
      workMode: parsed.data.workMode ?? "unknown",
      employmentType: parsed.data.employmentType ?? "unknown",
      closingAt: parsed.data.closingAt ? new Date(parsed.data.closingAt) : null,
      postedBy: user.id,
      ingestedAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()

  return NextResponse.json(job, { status: 201 })
}
