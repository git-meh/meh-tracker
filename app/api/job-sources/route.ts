import { NextResponse } from "next/server"
import { z } from "zod"
import { desc, eq } from "drizzle-orm"
import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db"
import { jobSources } from "@/lib/db/schema"
import { normalizeCountryCodes } from "@/lib/visa-platform/countries"

const sourceSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(120),
  sourceType: z.enum(["manual", "approved_feed", "employer_site", "ats"]),
  baseUrl: z.string().url().nullable().optional(),
  countryCodes: z.array(z.string().max(120)).max(25).default([]),
  supportsVisaSponsorship: z.boolean().default(false),
  defaultAdapter: z.enum([
    "none",
    "greenhouse",
    "lever",
    "workday",
    "ashby",
    "smartrecruiters",
    "manual_external",
  ]),
  isActive: z.boolean().default(true),
})

async function getUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
}

export async function GET() {
  const sources = await db
    .select()
    .from(jobSources)
    .orderBy(desc(jobSources.createdAt))

  return NextResponse.json(sources)
}

export async function POST(request: Request) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = sourceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const slug = parsed.data.slug.trim().toLowerCase()

  const [existing] = await db
    .select()
    .from(jobSources)
    .where(eq(jobSources.slug, slug))
    .limit(1)

  if (existing) {
    return NextResponse.json(
      { error: "A source with this slug already exists." },
      { status: 409 }
    )
  }

  const [source] = await db
    .insert(jobSources)
    .values({
      ...parsed.data,
      slug,
      countryCodes: normalizeCountryCodes(parsed.data.countryCodes),
      baseUrl: parsed.data.baseUrl ?? null,
      createdBy: user.id,
    })
    .returning()

  return NextResponse.json(source, { status: 201 })
}
