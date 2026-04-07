import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db"
import { applications, applicationStatusHistory } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"

const createSchema = z.object({
  jobId: z.string().uuid(),
  status: z.enum(["saved", "applied", "oa", "phone_screen", "interview", "offer", "rejected", "withdrawn"]).default("saved"),
  notes: z.string().max(2000).optional(),
  resumeId: z.string().uuid().optional(),
  isPrivate: z.boolean().default(false),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userApps = await db
    .select()
    .from(applications)
    .where(eq(applications.userId, user.id))

  return NextResponse.json(userApps)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Prevent duplicate applications
  const [existing] = await db
    .select()
    .from(applications)
    .where(and(eq(applications.userId, user.id), eq(applications.jobId, parsed.data.jobId)))
    .limit(1)

  if (existing) return NextResponse.json(existing, { status: 200 })

  const [app] = await db
    .insert(applications)
    .values({ ...parsed.data, userId: user.id })
    .returning()

  // Write initial status history
  await db.insert(applicationStatusHistory).values({
    applicationId: app.id,
    fromStatus: null,
    toStatus: app.status,
    changedBy: user.id,
  })

  return NextResponse.json(app, { status: 201 })
}
