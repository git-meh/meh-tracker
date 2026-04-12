import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db"
import { applications, applicationStatusHistory, jobs } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { createNotificationEvent } from "@/lib/visa-platform/notifications"

const statusSchema = z.object({
  status: z.enum(["saved", "applied", "oa", "phone_screen", "interview", "offer", "rejected", "withdrawn"]),
  note: z.string().max(500).optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [app] = await db.select().from(applications).where(eq(applications.id, id)).limit(1)
  if (!app || app.userId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await request.json()
  const parsed = statusSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  if (parsed.data.status === app.status) return NextResponse.json(app)

  // Update application + write history atomically
  const now = new Date()
  const [updated] = await db
    .update(applications)
    .set({
      status: parsed.data.status,
      updatedAt: now,
      // Set appliedAt when first moving to "applied"
      ...(parsed.data.status === "applied" && !app.appliedAt ? { appliedAt: now } : {}),
    })
    .where(eq(applications.id, id))
    .returning()

  await db.insert(applicationStatusHistory).values({
    applicationId: id,
    fromStatus: app.status,
    toStatus: parsed.data.status,
    note: parsed.data.note,
    changedBy: user.id,
    changedAt: now,
  })

  const [job] = await db.select().from(jobs).where(eq(jobs.id, app.jobId)).limit(1)
  if (job) {
    await createNotificationEvent({
      userId: user.id,
      type: "status_changed",
      subject: `${job.title} moved to ${parsed.data.status}`,
      body: `Your application for ${job.company} is now marked as ${parsed.data.status}.`,
      jobId: job.id,
      applicationId: app.id,
    })
  }

  return NextResponse.json(updated)
}
