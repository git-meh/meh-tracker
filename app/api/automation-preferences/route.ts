import { NextResponse } from "next/server"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db"
import { automationPreferences } from "@/lib/db/schema"
import { normalizeCountryCodes } from "@/lib/visa-platform/countries"

const automationPreferenceSchema = z.object({
  reviewRequired: z.boolean().optional(),
  autoSubmitEnabled: z.boolean().optional(),
  allowedSourceTypes: z.array(z.string().max(40)).max(10).optional(),
  supportedCountries: z.array(z.string().max(120)).max(25).optional(),
  emailNotificationsEnabled: z.boolean().optional(),
  dailyDigestEnabled: z.boolean().optional(),
  instantUpdatesEnabled: z.boolean().optional(),
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

  const [preferences] = await db
    .select()
    .from(automationPreferences)
    .where(eq(automationPreferences.userId, user.id))
    .limit(1)

  return NextResponse.json(preferences ?? null)
}

export async function PUT(request: Request) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = automationPreferenceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const now = new Date()
  const [existing] = await db
    .select()
    .from(automationPreferences)
    .where(eq(automationPreferences.userId, user.id))
    .limit(1)

  if (existing) {
    const [updated] = await db
      .update(automationPreferences)
      .set({
        ...parsed.data,
        supportedCountries:
          parsed.data.supportedCountries !== undefined
            ? normalizeCountryCodes(parsed.data.supportedCountries)
            : existing.supportedCountries,
        updatedAt: now,
      })
      .where(eq(automationPreferences.userId, user.id))
      .returning()

    return NextResponse.json(updated)
  }

  const [created] = await db
    .insert(automationPreferences)
    .values({
      userId: user.id,
      reviewRequired: parsed.data.reviewRequired ?? true,
      autoSubmitEnabled: parsed.data.autoSubmitEnabled ?? false,
      allowedSourceTypes: parsed.data.allowedSourceTypes ?? [
        "approved_feed",
        "employer_site",
        "ats",
      ],
      supportedCountries: normalizeCountryCodes(parsed.data.supportedCountries),
      emailNotificationsEnabled:
        parsed.data.emailNotificationsEnabled ?? true,
      dailyDigestEnabled: parsed.data.dailyDigestEnabled ?? true,
      instantUpdatesEnabled: parsed.data.instantUpdatesEnabled ?? true,
      updatedAt: now,
    })
    .returning()

  return NextResponse.json(created, { status: 201 })
}
