import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db"
import { applications, applicationStatusHistory, jobs, resumes, resumeVersions } from "@/lib/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { logger } from "@/lib/logger"

const createSchema = z.object({
  jobId: z.string().uuid(),
  status: z.enum(["saved", "applied", "oa", "phone_screen", "interview", "offer", "rejected", "withdrawn"]).default("saved"),
  notes: z.string().max(2000).optional(),
  resumeId: z.string().uuid().optional(),
  resumeVersionId: z.string().uuid().optional(),
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

  if (existing) {
    logger.info("application_already_exists", { userId: user.id, jobId: parsed.data.jobId, applicationId: existing.id })
    return NextResponse.json(existing, { status: 200 })
  }

  const [job] = await db.select().from(jobs).where(eq(jobs.id, parsed.data.jobId)).limit(1)
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }

  let resumeId = parsed.data.resumeId ?? null
  let resumeVersionId = parsed.data.resumeVersionId ?? null

  if (!resumeId) {
    const userResumes = await db
      .select()
      .from(resumes)
      .where(eq(resumes.userId, user.id))

    const preferredResume =
      userResumes.sort((left, right) => {
        if (left.isDefault === right.isDefault) {
          return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
        }

        return left.isDefault ? -1 : 1
      })[0] ?? null

    resumeId = preferredResume?.id ?? null
    if (preferredResume) {
      const [latestVersion] = await db
        .select()
        .from(resumeVersions)
        .where(eq(resumeVersions.resumeId, preferredResume.id))
        .orderBy(desc(resumeVersions.versionNumber))
        .limit(1)
      resumeVersionId = latestVersion?.id ?? null
    }
  }

  const [app] = await db
    .insert(applications)
    .values({
      userId: user.id,
      jobId: parsed.data.jobId,
      status: parsed.data.status,
      notes: parsed.data.notes,
      isPrivate: parsed.data.isPrivate,
      resumeId,
      resumeVersionId,
      sourceJobId: job.sourceJobId ?? null,
      jobSourceType: job.sourceType,
      matchedScore: null,
      matchReason: null,
      automationMode: "review_required",
    })
    .returning()

  // Write initial status history
  await db.insert(applicationStatusHistory).values({
    applicationId: app.id,
    fromStatus: null,
    toStatus: app.status,
    changedBy: user.id,
  })

  logger.info("application_created", {
    userId: user.id,
    jobId: parsed.data.jobId,
    applicationId: app.id,
    status: app.status,
  })
  return NextResponse.json(app, { status: 201 })
}
