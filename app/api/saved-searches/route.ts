import { NextResponse } from "next/server"
import { z } from "zod"
import { eq, desc } from "drizzle-orm"
import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db"
import { savedSearches } from "@/lib/db/schema"

const savedSearchSchema = z.object({
  name: z.string().min(1).max(120),
  query: z.string().max(200).nullable().optional(),
  filters: z.record(z.string(), z.unknown()).default({}),
  emailDaily: z.boolean().default(true),
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

  const searches = await db
    .select()
    .from(savedSearches)
    .where(eq(savedSearches.userId, user.id))
    .orderBy(desc(savedSearches.createdAt))

  return NextResponse.json(searches)
}

export async function POST(request: Request) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = savedSearchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const [search] = await db
    .insert(savedSearches)
    .values({
      userId: user.id,
      name: parsed.data.name,
      query: parsed.data.query ?? null,
      filters: parsed.data.filters,
      emailDaily: parsed.data.emailDaily,
    })
    .returning()

  return NextResponse.json(search, { status: 201 })
}
