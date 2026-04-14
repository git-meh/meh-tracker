import { NextResponse } from "next/server"
import { and, eq, inArray, notInArray, sql } from "drizzle-orm"
import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db"
import { candidateProfiles, jobMatches, jobs } from "@/lib/db/schema"
import { buildMatchResult } from "@/lib/visa-platform/matching"
import { logger } from "@/lib/logger"

// Minimum score to be stored as a match
const SCORE_THRESHOLD = 5

// Batch size for bulk DB upserts — avoids a single massive query
const UPSERT_BATCH_SIZE = 500

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const start = Date.now()

  // ── Load candidate profile ──────────────────────────────────────────────────
  const [profile] = await db
    .select()
    .from(candidateProfiles)
    .where(eq(candidateProfiles.userId, user.id))
    .limit(1)

  logger.info("matches_refresh_started", {
    userId: user.id,
    hasProfile: Boolean(profile),
    profileSnapshot: profile
      ? {
          skills: profile.skills,
          skillsCount: profile.skills.length,
          targetRoles: profile.targetRoles,
          targetRolesCount: profile.targetRoles.length,
          targetCountries: profile.targetCountries,
          needsVisaSponsorship: profile.needsVisaSponsorship,
          prefersRemote: profile.prefersRemote,
          preferredLocations: profile.preferredLocations,
          salaryFloor: profile.salaryFloor,
          preferredCurrency: profile.preferredCurrency,
          currentCountry: profile.currentCountry,
          yearsExperience: profile.yearsExperience,
          preferredBoards: profile.preferredBoards,
        }
      : "NO PROFILE — fill in workspace to get real matches",
  })

  if (!profile) {
    logger.warn("matches_refresh_no_profile", {
      userId: user.id,
      action: "Scoring all jobs with null profile — most will score 0",
    })
  }

  // ── Load ALL jobs ───────────────────────────────────────────────────────────
  const preferredBoards = profile?.preferredBoards ?? []
  const availabilityFilter = inArray(jobs.availability, ["open", "unknown"])
  const boardFilter =
    preferredBoards.length > 0
      ? sql`${jobs.sourceKey} = any (ARRAY[${sql.join(
          preferredBoards.map((b) => sql`${b}`),
          sql`, `
        )}]::text[])`
      : undefined

  const allJobs = await db
    .select()
    .from(jobs)
    .where(boardFilter ? sql`${availabilityFilter} AND (${boardFilter})` : availabilityFilter)

  logger.info("matches_refresh_jobs_loaded", {
    userId: user.id,
    totalJobsInDb: allJobs.length,
    boardFilter: preferredBoards.length > 0 ? preferredBoards : "all boards",
    note: "Scoring ALL jobs — no cap",
  })

  // ── Score every job in memory ───────────────────────────────────────────────
  const qualifying: Array<{
    jobId: string
    score: number
    rationale: string
    fitSignals: string[]
    concerns: string[]
    jobTitle: string
    company: string
  }> = []

  const scoreDistribution: Record<string, number> = {
    "0-4 (skipped)": 0,
    "5-19": 0,
    "20-39": 0,
    "40-59": 0,
    "60-79": 0,
    "80-100": 0,
  }

  for (const job of allJobs) {
    const result = buildMatchResult(profile ?? null, job)

    if (result.score < 10) scoreDistribution["0-4 (skipped)"]++
    else if (result.score < 20) scoreDistribution["5-19"]++
    else if (result.score < 40) scoreDistribution["20-39"]++
    else if (result.score < 60) scoreDistribution["40-59"]++
    else if (result.score < 80) scoreDistribution["60-79"]++
    else scoreDistribution["80-100"]++

    if (result.score < SCORE_THRESHOLD) continue

    qualifying.push({
      jobId: job.id,
      score: result.score,
      rationale: result.rationale,
      fitSignals: result.fitSignals,
      concerns: result.concerns,
      jobTitle: job.title,
      company: job.company,
    })
  }

  // Log every job that qualified with its score and signals
  logger.info("matches_refresh_qualifying_jobs", {
    userId: user.id,
    count: qualifying.length,
    jobs: qualifying
      .sort((a, b) => b.score - a.score)
      .map((q) => ({
        title: q.jobTitle,
        company: q.company,
        score: q.score,
        fitSignals: q.fitSignals,
        concerns: q.concerns,
      })),
  })

  // ── Bulk upsert qualifying matches ─────────────────────────────────────────
  const now = new Date()
  const qualifyingJobIds = qualifying.map((q) => q.jobId)

  // Process in batches to avoid query size limits
  for (let i = 0; i < qualifying.length; i += UPSERT_BATCH_SIZE) {
    const batch = qualifying.slice(i, i + UPSERT_BATCH_SIZE)
    await db
      .insert(jobMatches)
      .values(
        batch.map((q) => ({
          userId: user.id,
          jobId: q.jobId,
          score: q.score,
          rationale: q.rationale,
          fitSignals: q.fitSignals,
          concerns: q.concerns,
          refreshedAt: now,
        }))
      )
      .onConflictDoUpdate({
        target: [jobMatches.userId, jobMatches.jobId],
        set: {
          score: sql`excluded.score`,
          rationale: sql`excluded.rationale`,
          fitSignals: sql`excluded.fit_signals`,
          concerns: sql`excluded.concerns`,
          refreshedAt: sql`excluded.refreshed_at`,
        },
      })
  }

  // ── Delete stale matches (jobs that no longer qualify) ─────────────────────
  let deletedStale = 0
  if (qualifyingJobIds.length > 0) {
    const deleteResult = await db
      .delete(jobMatches)
      .where(
        and(
          eq(jobMatches.userId, user.id),
          notInArray(jobMatches.jobId, qualifyingJobIds)
        )
      )
      .returning({ id: jobMatches.id })
    deletedStale = deleteResult.length
  } else {
    // No qualifying jobs — clear everything for this user
    const deleteResult = await db
      .delete(jobMatches)
      .where(eq(jobMatches.userId, user.id))
      .returning({ id: jobMatches.id })
    deletedStale = deleteResult.length
  }

  logger.info("matches_refresh_done", {
    userId: user.id,
    totalJobsScored: allJobs.length,
    matchesStored: qualifying.length,
    staleMatchesDeleted: deletedStale,
    scoreDistribution,
    durationMs: Date.now() - start,
  })

  return NextResponse.json({
    refreshed: qualifying.length,
    totalScored: allJobs.length,
    staleDeleted: deletedStale,
  })
}
