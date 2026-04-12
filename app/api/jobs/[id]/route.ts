import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db"
import { jobs } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import {
  normalizeCountryCodes,
  resolveCountryMetadata,
} from "@/lib/visa-platform/countries"

const updateJobSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  company: z.string().min(1).max(200).optional(),
  url: z.string().url().optional(),
  description: z.string().max(5000).optional(),
  salaryRange: z.string().max(100).optional(),
  salaryMin: z.number().int().min(0).nullable().optional(),
  salaryMax: z.number().int().min(0).nullable().optional(),
  currency: z.string().max(10).optional(),
  location: z.string().max(200).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  availability: z.enum(["open", "closed", "unknown"]).optional(),
  countryCode: z.string().max(120).optional(),
  eligibleCountries: z.array(z.string().max(120)).max(20).optional(),
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1)
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(job)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1)
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (job.postedBy !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const parsed = updateJobSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { countryCode, countryConfidence } = resolveCountryMetadata({
    countryCode: parsed.data.countryCode ?? job.countryCode,
    location: parsed.data.location ?? job.location,
  })
  const eligibleCountries = parsed.data.eligibleCountries
    ? normalizeCountryCodes(parsed.data.eligibleCountries)
    : undefined

  const [updated] = await db
    .update(jobs)
    .set({
      ...parsed.data,
      countryCode,
      countryConfidence,
      eligibleCountries,
      sourceKey: parsed.data.sourceKey?.trim().toLowerCase(),
      closingAt: parsed.data.closingAt ? new Date(parsed.data.closingAt) : undefined,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, id))
    .returning()
  return NextResponse.json(updated)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1)
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (job.postedBy !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await db.delete(jobs).where(eq(jobs.id, id))
  return new NextResponse(null, { status: 204 })
}
