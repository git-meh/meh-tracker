import { NextResponse } from "next/server"
import { and, desc, eq } from "drizzle-orm"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db"
import {
  applicationDrafts,
  applicationStatusHistory,
  applications,
  automationPreferences,
  generatedArtifacts,
  jobMatches,
  jobs,
  resumeVersions,
} from "@/lib/db/schema"
import { executeApplicationRun, getAutomationEligibility } from "@/lib/visa-platform/automation"
import { createNotificationEvent } from "@/lib/visa-platform/notifications"

const updateDraftSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reviewNotes: z.string().max(2000).nullable().optional(),
})

const saveDraftSchema = z.object({
  reviewNotes: z.string().max(2000).nullable().optional(),
  artifacts: z.array(
    z.object({
      type: z.enum(["tailored_resume", "cover_letter", "application_answers"]),
      title: z.string().max(200).optional(),
      content: z.string().max(100000),
    })
  ),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const [draft] = await db
    .select()
    .from(applicationDrafts)
    .where(eq(applicationDrafts.id, id))
    .limit(1)

  if (!draft || draft.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const artifacts = await db
    .select()
    .from(generatedArtifacts)
    .where(eq(generatedArtifacts.draftId, draft.id))
    .orderBy(desc(generatedArtifacts.createdAt))

  return NextResponse.json({ draft, artifacts })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = updateDraftSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { id } = await params
  const [draft] = await db
    .select()
    .from(applicationDrafts)
    .where(eq(applicationDrafts.id, id))
    .limit(1)

  if (!draft || draft.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (parsed.data.status === "rejected") {
    const [updated] = await db
      .update(applicationDrafts)
      .set({
        status: "rejected",
        reviewNotes: parsed.data.reviewNotes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(applicationDrafts.id, draft.id))
      .returning()

    return NextResponse.json(updated)
  }

  const [job] = await db
    .select()
    .from(jobs)
    .where(eq(jobs.id, draft.jobId))
    .limit(1)

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }

  const [match] = draft.jobMatchId
    ? await db.select().from(jobMatches).where(eq(jobMatches.id, draft.jobMatchId)).limit(1)
    : []

  const [preferences] = await db
    .select()
    .from(automationPreferences)
    .where(eq(automationPreferences.userId, user.id))
    .limit(1)

  const [tailoredResumeArtifact] = await db
    .select()
    .from(generatedArtifacts)
    .where(
      and(
        eq(generatedArtifacts.draftId, draft.id),
        eq(generatedArtifacts.type, "tailored_resume")
      )
    )
    .orderBy(desc(generatedArtifacts.createdAt))
    .limit(1)

  const [sourceResumeVersion] = tailoredResumeArtifact?.sourceResumeVersionId
    ? await db
        .select()
        .from(resumeVersions)
        .where(eq(resumeVersions.id, tailoredResumeArtifact.sourceResumeVersionId))
        .limit(1)
    : []

  const now = new Date()
  const [existingApplication] = draft.applicationId
    ? await db
        .select()
        .from(applications)
        .where(eq(applications.id, draft.applicationId))
        .limit(1)
    : await db
        .select()
        .from(applications)
        .where(
          and(
            eq(applications.userId, user.id),
            eq(applications.jobId, draft.jobId)
          )
        )
        .limit(1)

  const application = existingApplication
    ? existingApplication
    : (
        await db
          .insert(applications)
          .values({
            userId: user.id,
            jobId: draft.jobId,
            resumeId: sourceResumeVersion?.resumeId ?? null,
            resumeVersionId: sourceResumeVersion?.id ?? null,
            status: "saved",
            sourceJobId: job.sourceJobId ?? null,
            jobSourceType: job.sourceType,
            matchedScore: match?.score ?? null,
            matchReason: match?.rationale ?? null,
            automationMode: getAutomationEligibility(job, preferences ?? null).mode,
          })
          .returning()
      )[0]

  if (!existingApplication) {
    await db.insert(applicationStatusHistory).values({
      applicationId: application.id,
      fromStatus: null,
      toStatus: "saved",
      changedBy: user.id,
      changedAt: now,
      note: "Created from generated draft review.",
    })
  }

  await db
    .update(generatedArtifacts)
    .set({ applicationId: application.id })
    .where(eq(generatedArtifacts.draftId, draft.id))

  const [approvedDraft] = await db
    .update(applicationDrafts)
    .set({
      applicationId: application.id,
      status: "approved",
      reviewNotes: parsed.data.reviewNotes ?? null,
      approvedAt: now,
      updatedAt: now,
    })
    .where(eq(applicationDrafts.id, draft.id))
    .returning()

  const execution = await executeApplicationRun({
    application,
    draft: approvedDraft,
    job,
    preferences: preferences ?? null,
  })

  if (execution.result.status === "submitted") {
    await db.insert(applicationStatusHistory).values({
      applicationId: application.id,
      fromStatus: application.status,
      toStatus: "applied",
      changedBy: user.id,
      changedAt: new Date(),
      note: "Submitted through the automation executor.",
    })

    await db
      .update(applicationDrafts)
      .set({
        status: "submitted",
        updatedAt: new Date(),
      })
      .where(eq(applicationDrafts.id, draft.id))

    await createNotificationEvent({
      userId: user.id,
      type: "application_submitted",
      subject: `Application submitted for ${job.title}`,
      body: `The approved draft for ${job.company} has been marked as submitted.`,
      jobId: job.id,
      applicationId: application.id,
      draftId: draft.id,
    })
  }

  if (execution.result.status === "failed") {
    await db
      .update(applicationDrafts)
      .set({
        status: "failed",
        updatedAt: new Date(),
      })
      .where(eq(applicationDrafts.id, draft.id))

    await createNotificationEvent({
      userId: user.id,
      type: "application_failed",
      subject: `Application automation failed for ${job.title}`,
      body: execution.result.error ?? "The executor could not complete this application.",
      jobId: job.id,
      applicationId: application.id,
      draftId: draft.id,
    })
  }

  return NextResponse.json({
    draftId: draft.id,
    applicationId: application.id,
    run: execution.run,
    result: execution.result,
  })
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = saveDraftSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { id } = await params
  const [draft] = await db
    .select()
    .from(applicationDrafts)
    .where(eq(applicationDrafts.id, id))
    .limit(1)

  if (!draft || draft.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const existingArtifacts = await db
    .select()
    .from(generatedArtifacts)
    .where(eq(generatedArtifacts.draftId, draft.id))
    .orderBy(desc(generatedArtifacts.createdAt))

  const latestByType = new Map<string, (typeof existingArtifacts)[number]>()
  existingArtifacts.forEach((artifact) => {
    if (!latestByType.has(artifact.type)) {
      latestByType.set(artifact.type, artifact)
    }
  })

  const inserts = parsed.data.artifacts
    .map((artifact) => {
      const previous = latestByType.get(artifact.type)
      if (
        previous &&
        previous.content === artifact.content &&
        previous.title === (artifact.title ?? previous.title)
      ) {
        return null
      }

      return {
        userId: user.id,
        jobId: draft.jobId,
        applicationId: draft.applicationId ?? null,
        draftId: draft.id,
        sourceResumeVersionId: previous?.sourceResumeVersionId ?? null,
        type: artifact.type,
        title: artifact.title ?? previous?.title ?? artifact.type.replace(/_/g, " "),
        content: artifact.content,
        status: "ready" as const,
      }
    })
    .filter(
      (
        value
      ): value is {
        userId: string
        jobId: string
        applicationId: string | null
        draftId: string
        sourceResumeVersionId: string | null
        type: "tailored_resume" | "cover_letter" | "application_answers"
        title: string
        content: string
        status: "ready"
      } => Boolean(value)
    )

  if (inserts.length > 0) {
    await db.insert(generatedArtifacts).values(inserts)
  }

  const [updatedDraft] = await db
    .update(applicationDrafts)
    .set({
      reviewNotes: parsed.data.reviewNotes ?? null,
      updatedAt: new Date(),
    })
    .where(eq(applicationDrafts.id, draft.id))
    .returning()

  const artifacts = await db
    .select()
    .from(generatedArtifacts)
    .where(eq(generatedArtifacts.draftId, draft.id))
    .orderBy(desc(generatedArtifacts.createdAt))

  return NextResponse.json({ draft: updatedDraft, artifacts })
}
