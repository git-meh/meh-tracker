import { NextResponse } from "next/server"
import { and, desc, eq } from "drizzle-orm"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db"
import {
  applicationDrafts,
  candidateProfiles,
  generatedArtifacts,
  jobMatches,
  jobs,
  resumes,
  resumeVersions,
} from "@/lib/db/schema"
import { buildApplicationAnswersContent, buildCoverLetterContent, buildTailoredResumeContent } from "@/lib/visa-platform/drafts"
import { buildMatchResult } from "@/lib/visa-platform/matching"
import { createNotificationEvent } from "@/lib/visa-platform/notifications"

const createDraftSchema = z.object({
  jobId: z.string().uuid(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = createDraftSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const [job] = await db
    .select()
    .from(jobs)
    .where(eq(jobs.id, parsed.data.jobId))
    .limit(1)

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }

  const [profile] = await db
    .select()
    .from(candidateProfiles)
    .where(eq(candidateProfiles.userId, user.id))
    .limit(1)

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

  const [preferredResumeVersion] = preferredResume
    ? await db
        .select()
        .from(resumeVersions)
        .where(eq(resumeVersions.resumeId, preferredResume.id))
        .orderBy(desc(resumeVersions.versionNumber))
        .limit(1)
    : []

  const computedMatch = buildMatchResult(profile ?? null, job)

  const [existingMatch] = await db
    .select()
    .from(jobMatches)
    .where(
      and(eq(jobMatches.userId, user.id), eq(jobMatches.jobId, parsed.data.jobId))
    )
    .limit(1)

  const match = existingMatch
    ? (
        await db
          .update(jobMatches)
          .set({
            score: computedMatch.score,
            rationale: computedMatch.rationale,
            fitSignals: computedMatch.fitSignals,
            concerns: computedMatch.concerns,
            refreshedAt: new Date(),
          })
          .where(eq(jobMatches.id, existingMatch.id))
          .returning()
      )[0]
    : (
        await db
          .insert(jobMatches)
          .values({
            userId: user.id,
            jobId: job.id,
            score: computedMatch.score,
            rationale: computedMatch.rationale,
            fitSignals: computedMatch.fitSignals,
            concerns: computedMatch.concerns,
          })
          .returning()
      )[0]

  const now = new Date()
  const [existingDraft] = await db
    .select()
    .from(applicationDrafts)
    .where(
      and(
        eq(applicationDrafts.userId, user.id),
        eq(applicationDrafts.jobId, parsed.data.jobId)
      )
    )
    .limit(1)

  const draft = existingDraft
    ? (
        await db
          .update(applicationDrafts)
          .set({
            jobMatchId: match.id,
            status: "ready_for_review",
            reviewNotes: null,
            generatedAt: now,
            updatedAt: now,
          })
          .where(eq(applicationDrafts.id, existingDraft.id))
          .returning()
      )[0]
    : (
        await db
          .insert(applicationDrafts)
          .values({
            userId: user.id,
            jobId: job.id,
            jobMatchId: match.id,
            status: "ready_for_review",
            generatedAt: now,
            updatedAt: now,
          })
          .returning()
      )[0]

  const tailoredResume = buildTailoredResumeContent(
    job,
    profile ?? null,
    preferredResumeVersion ?? null,
    computedMatch
  )
  const coverLetter = buildCoverLetterContent(job, profile ?? null, computedMatch)
  const answers = buildApplicationAnswersContent(job, profile ?? null, computedMatch)

  const artifacts = await db
    .insert(generatedArtifacts)
    .values([
      {
        userId: user.id,
        jobId: job.id,
        draftId: draft.id,
        sourceResumeVersionId: preferredResumeVersion?.id ?? null,
        type: "tailored_resume",
        title: `${job.title} tailored resume`,
        content: tailoredResume,
      },
      {
        userId: user.id,
        jobId: job.id,
        draftId: draft.id,
        sourceResumeVersionId: preferredResumeVersion?.id ?? null,
        type: "cover_letter",
        title: `${job.title} cover letter`,
        content: coverLetter,
      },
      {
        userId: user.id,
        jobId: job.id,
        draftId: draft.id,
        sourceResumeVersionId: preferredResumeVersion?.id ?? null,
        type: "application_answers",
        title: `${job.title} application answers`,
        content: answers,
      },
    ])
    .returning()

  await createNotificationEvent({
    userId: user.id,
    type: "draft_ready",
    subject: `Draft ready for ${job.title} at ${job.company}`,
    body: `A new tailored application package is ready for review with a match score of ${computedMatch.score}.`,
    jobId: job.id,
    draftId: draft.id,
  })

  return NextResponse.json(
    {
      draft,
      match,
      artifacts,
      resumeVersion: preferredResumeVersion ?? null,
      reviewUrl: `/matches/${draft.id}`,
    },
    { status: 201 }
  )
}
