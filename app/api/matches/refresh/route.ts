import { NextResponse } from "next/server"
import { desc, eq, inArray, sql } from "drizzle-orm"
import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db"
import { candidateProfiles, jobMatches, jobs } from "@/lib/db/schema"
import { buildMatchResult } from "@/lib/visa-platform/matching"
import { logger } from "@/lib/logger"

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const start = Date.now()
  logger.info("matches_refresh_started", { userId: user.id })

  const [profile] = await db
    .select()
    .from(candidateProfiles)
    .where(eq(candidateProfiles.userId, user.id))
    .limit(1)

  if (!profile) {
    logger.warn("matches_refresh_no_profile", { userId: user.id })
  }

  // Build base availability filter
  const availabilityFilter = inArray(jobs.availability, ["open", "unknown"])

  // If user has board preferences, only scan matching jobs.
  // jobs.tags is a text array — we check overlap with preferredBoards using &&
  const preferredBoards = profile?.preferredBoards ?? []
  const boardFilter =
    preferredBoards.length > 0
      ? sql`${jobs.sourceKey} = any (ARRAY[${sql.join(
          preferredBoards.map((board) => sql`${board}`),
          sql`, `
        )}]::text[])`
      : undefined

  // Include "unknown" availability — scraped jobs default to unknown until verified
  const allJobs = await db
    .select()
    .from(jobs)
    .where(boardFilter ? sql`${availabilityFilter} AND (${boardFilter})` : availabilityFilter)
    .orderBy(desc(jobs.createdAt))

  const existingMatches = await db
    .select()
    .from(jobMatches)
    .where(eq(jobMatches.userId, user.id))

  const existingByJobId = new Map(existingMatches.map((match) => [match.jobId, match]))
  let refreshed = 0

  // Scan up to 300 most recent jobs; only store if score ≥ 5
  for (const job of allJobs.slice(0, 300)) {
    const result = buildMatchResult(profile ?? null, job)
    if (result.score < 5) {
      continue
    }

    const existing = existingByJobId.get(job.id)
    if (existing) {
      await db
        .update(jobMatches)
        .set({
          score: result.score,
          rationale: result.rationale,
          fitSignals: result.fitSignals,
          concerns: result.concerns,
          refreshedAt: new Date(),
        })
        .where(eq(jobMatches.id, existing.id))
    } else {
      await db.insert(jobMatches).values({
        userId: user.id,
        jobId: job.id,
        score: result.score,
        rationale: result.rationale,
        fitSignals: result.fitSignals,
        concerns: result.concerns,
      })
    }

    refreshed += 1
  }

  logger.info("matches_refresh_done", {
    userId: user.id,
    jobsScanned: Math.min(allJobs.length, 300),
    refreshed,
    durationMs: Date.now() - start,
    hasProfile: Boolean(profile),
  })

  return NextResponse.json({ refreshed })
}
