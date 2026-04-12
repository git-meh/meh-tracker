import { NextResponse } from "next/server"
import { and, desc, eq, gte, inArray, or } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  automationPreferences,
  jobs,
  savedSearches,
} from "@/lib/db/schema"
import {
  filterJobs,
  parseJobDiscoveryFilters,
} from "@/lib/visa-platform/discovery"
import { createNotificationEvent } from "@/lib/visa-platform/notifications"

function isDigestAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim()
  const authHeader = request.headers.get("authorization") ?? ""
  const secretParam = new URL(request.url).searchParams.get("secret") ?? ""
  const providedSecret = authHeader.replace(/^Bearer\s+/i, "").trim() || secretParam

  if (!cronSecret) {
    return true
  }

  return providedSecret === cronSecret
}

function toRawFilterRecord(search: {
  query: string | null
  filters: Record<string, unknown>
}) {
  const entries = Object.entries(search.filters ?? {}).flatMap(([key, value]) => {
    if (value === null || value === undefined || value === "") {
      return []
    }

    return [[key, String(value)] as const]
  })

  return Object.fromEntries([
    ...entries,
    ...(search.query ? [["q", search.query] as const] : []),
  ]) as Record<string, string | string[] | undefined>
}

export async function GET(request: Request) {
  if (!isDigestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searches = await db
    .select()
    .from(savedSearches)
    .orderBy(desc(savedSearches.createdAt))

  let processed = 0
  let eventsCreated = 0

  for (const search of searches) {
    if (!search.emailDaily) {
      continue
    }

    const [preferences] = await db
      .select()
      .from(automationPreferences)
      .where(eq(automationPreferences.userId, search.userId))
      .limit(1)

    if (
      preferences &&
      (!preferences.emailNotificationsEnabled || !preferences.dailyDigestEnabled)
    ) {
      continue
    }

    const since = search.lastDigestAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentJobs = await db
      .select()
      .from(jobs)
      .where(
        and(
          inArray(jobs.availability, ["open", "unknown"]),
          or(gte(jobs.ingestedAt, since), gte(jobs.createdAt, since))
        )
      )
      .orderBy(desc(jobs.ingestedAt))

    const filters = parseJobDiscoveryFilters(toRawFilterRecord(search))
    const matches = filterJobs(recentJobs, filters).slice(0, 5)

    processed += 1

    if (matches.length > 0) {
      await createNotificationEvent({
        userId: search.userId,
        type: "daily_digest",
        subject: `${matches.length} new job${matches.length === 1 ? "" : "s"} for ${search.name}`,
        body: matches
          .map((job) => {
            const location = job.location ? ` · ${job.location}` : ""
            return `• ${job.title} at ${job.company}${location}`
          })
          .join("\n"),
      })
      eventsCreated += 1
    }

    await db
      .update(savedSearches)
      .set({ lastDigestAt: new Date() })
      .where(eq(savedSearches.id, search.id))
  }

  return NextResponse.json({
    ok: true,
    processed,
    eventsCreated,
  })
}
