import { NextResponse } from "next/server"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db"
import { candidateProfiles } from "@/lib/db/schema"
import {
  normalizeCountryCode,
  normalizeCountryCodes,
} from "@/lib/visa-platform/countries"

const candidateProfileSchema = z.object({
  currentCountry: z.string().max(120).nullable().optional(),
  visaStatus: z.string().max(120).nullable().optional(),
  needsVisaSponsorship: z.boolean().optional(),
  targetCountries: z.array(z.string().max(120)).max(25).optional(),
  preferredLocations: z.array(z.string().max(120)).max(20).optional(),
  targetRoles: z.array(z.string().max(120)).max(20).optional(),
  yearsExperience: z.number().int().min(0).max(60).nullable().optional(),
  salaryFloor: z.number().int().min(0).max(1_000_000).nullable().optional(),
  preferredCurrency: z.string().max(10).optional(),
  prefersRemote: z.boolean().optional(),
  summary: z.string().max(4000).nullable().optional(),
  skills: z.array(z.string().max(80)).max(50).optional(),
  preferredBoards: z.array(z.string().max(120)).max(30).optional(),
})

async function getUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
}

export async function GET() {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [profile] = await db
    .select()
    .from(candidateProfiles)
    .where(eq(candidateProfiles.userId, user.id))
    .limit(1)

  return NextResponse.json(profile ?? null)
}

export async function PUT(request: Request) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = candidateProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const now = new Date()
  const currentCountry = normalizeCountryCode(parsed.data.currentCountry) ?? null
  const normalisedTargetCountries = normalizeCountryCodes(parsed.data.targetCountries)
  const [existing] = await db
    .select()
    .from(candidateProfiles)
    .where(eq(candidateProfiles.userId, user.id))
    .limit(1)

  if (existing) {
    const [updated] = await db
      .update(candidateProfiles)
      .set({
        ...parsed.data,
        currentCountry,
        visaStatus: parsed.data.visaStatus ?? null,
        targetCountries: normalisedTargetCountries,
        yearsExperience: parsed.data.yearsExperience ?? null,
        salaryFloor: parsed.data.salaryFloor ?? null,
        summary: parsed.data.summary ?? null,
        updatedAt: now,
      })
      .where(eq(candidateProfiles.userId, user.id))
      .returning()

    return NextResponse.json(updated)
  }

  const [created] = await db
    .insert(candidateProfiles)
    .values({
      userId: user.id,
      currentCountry,
      visaStatus: parsed.data.visaStatus ?? null,
      needsVisaSponsorship: parsed.data.needsVisaSponsorship ?? true,
      targetCountries: normalisedTargetCountries,
      preferredLocations: parsed.data.preferredLocations ?? [],
      targetRoles: parsed.data.targetRoles ?? [],
      yearsExperience: parsed.data.yearsExperience ?? null,
      salaryFloor: parsed.data.salaryFloor ?? null,
      preferredCurrency: parsed.data.preferredCurrency ?? "GBP",
      prefersRemote: parsed.data.prefersRemote ?? false,
      summary: parsed.data.summary ?? null,
      skills: parsed.data.skills ?? [],
      preferredBoards: parsed.data.preferredBoards ?? [],
      updatedAt: now,
    })
    .returning()

  return NextResponse.json(created, { status: 201 })
}
