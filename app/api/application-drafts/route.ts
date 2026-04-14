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
import { generateAllArtifacts } from "@/lib/visa-platform/drafts"
import { buildAiMatchResult } from "@/lib/visa-platform/matching"
import { createNotificationEvent } from "@/lib/visa-platform/notifications"
import { logger } from "@/lib/logger"

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

  // ── Load candidate profile ──────────────────────────────────────────────────
  const [profile] = await db
    .select()
    .from(candidateProfiles)
    .where(eq(candidateProfiles.userId, user.id))
    .limit(1)

  logger.info("draft_generate_profile_loaded", {
    userId: user.id,
    jobId: job.id,
    jobTitle: job.title,
    company: job.company,
    hasProfile: Boolean(profile),
    skills: profile?.skills ?? [],
    targetRoles: profile?.targetRoles ?? [],
    targetCountries: profile?.targetCountries ?? [],
    needsVisaSponsorship: profile?.needsVisaSponsorship ?? null,
    prefersRemote: profile?.prefersRemote ?? null,
    salaryFloor: profile?.salaryFloor ?? null,
  })

  if (!profile) {
    logger.warn("draft_generate_no_profile", { userId: user.id, jobId: job.id })
  }

  // ── Load best resume + latest version ──────────────────────────────────────
  const userResumes = await db
    .select()
    .from(resumes)
    .where(eq(resumes.userId, user.id))

  const preferredResume =
    userResumes.sort((a, b) => {
      if (a.isDefault === b.isDefault)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      return a.isDefault ? -1 : 1
    })[0] ?? null

  const [preferredResumeVersion] = preferredResume
    ? await db
        .select()
        .from(resumeVersions)
        .where(eq(resumeVersions.resumeId, preferredResume.id))
        .orderBy(desc(resumeVersions.versionNumber))
        .limit(1)
    : []

  const resumeText =
    preferredResumeVersion?.normalizedText ??
    preferredResumeVersion?.extractedText ??
    null

  logger.info("draft_generate_resume_loaded", {
    userId: user.id,
    resumeCount: userResumes.length,
    hasDefaultResume: Boolean(preferredResume?.isDefault),
    resumeFileName: preferredResume?.fileName ?? null,
    hasExtractedText: Boolean(resumeText),
    extractedTextChars: resumeText?.length ?? 0,
  })

  // ── AI match scoring ────────────────────────────────────────────────────────
  const computedMatch = await buildAiMatchResult(profile ?? null, job, resumeText)

  const [existingMatch] = await db
    .select()
    .from(jobMatches)
    .where(and(eq(jobMatches.userId, user.id), eq(jobMatches.jobId, parsed.data.jobId)))
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

  // ── Create / reset draft record ─────────────────────────────────────────────
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

  // ── Generate all 6 artifacts (AI primary, templates as fallback) ─────────────
  const artifactOutputs = await generateAllArtifacts(
    job,
    profile ?? null,
    preferredResumeVersion ?? null,
    computedMatch
  )

  const aiGeneratedCount = artifactOutputs.filter((a) => a.aiGenerated).length

  logger.info("draft_artifacts_generated", {
    userId: user.id,
    jobId: job.id,
    totalArtifacts: artifactOutputs.length,
    aiGenerated: aiGeneratedCount,
    templateFallback: artifactOutputs.length - aiGeneratedCount,
  })

  const artifacts = await db
    .insert(generatedArtifacts)
    .values(
      artifactOutputs.map(({ type, title, content, aiGenerated }) => ({
        userId: user.id,
        jobId: job.id,
        draftId: draft.id,
        sourceResumeVersionId: preferredResumeVersion?.id ?? null,
        type,
        title,
        content,
        aiGenerated,
      }))
    )
    .returning()

  await createNotificationEvent({
    userId: user.id,
    type: "draft_ready",
    subject: `Draft ready: ${job.title} at ${job.company}`,
    body: `${aiGeneratedCount === artifactOutputs.length ? "AI-generated" : "Tailored"} application package ready — match score ${computedMatch.score}/100.`,
    jobId: job.id,
    draftId: draft.id,
  })

  return NextResponse.json(
    {
      draft,
      match,
      artifacts,
      resumeVersion: preferredResumeVersion ?? null,
      aiGeneratedCount,
      reviewUrl: `/matches/${draft.id}`,
    },
    { status: 201 }
  )
}
