import Link from "next/link"
import { and, asc, desc, eq, gte, ilike, inArray, or, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { applications, jobMatches, jobs, jobSources, profiles } from "@/lib/db/schema"
import { createClient } from "@/lib/supabase/server"
import { JobCard } from "@/components/jobs/job-card"
import { JobFilters } from "@/components/jobs/job-filters"
import { SaveSearchButton } from "@/components/jobs/save-search-button"
import { Button } from "@/components/ui/button"
import {
  parseJobDiscoveryFilters,
  toSavedSearchFilters,
} from "@/lib/visa-platform/discovery"
import type { SQL } from "drizzle-orm"

const PAGE_SIZE = 24

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const rawParams = await searchParams
  const getString = (key: string) => {
    const v = rawParams[key]
    return (Array.isArray(v) ? v[0] : v) ?? ""
  }

  const filters = parseJobDiscoveryFilters(rawParams)
  const page = Math.max(1, parseInt(getString("page") || "1", 10))
  const offset = (page - 1) * PAGE_SIZE

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const userMatchScore = user
    ? sql<number | null>`(
        select ${jobMatches.score}
        from ${jobMatches}
        where ${jobMatches.jobId} = ${jobs.id}
          and ${jobMatches.userId} = ${user.id}
        limit 1
      )`
    : sql<number | null>`null`

  const sponsorshipRank = sql<number>`
    case
      when ${jobs.visaSponsorshipStatus} = 'eligible' then 0
      when ${jobs.visaSponsorshipStatus} = 'possible' then 1
      when ${jobs.visaSponsorshipStatus} = 'unknown' then 2
      else 3
    end
  `
  const countryRank = sql<number>`
    case
      when ${jobs.countryCode} = 'GB' then 0
      when ${jobs.countryCode} is null then 2
      else 1
    end
  `

  const conditions: SQL[] = []
  const ordering = user
    ? [
        asc(sponsorshipRank),
        desc(sql<number>`coalesce(${userMatchScore}, -1)`),
        asc(countryRank),
        desc(jobs.createdAt),
      ]
    : [asc(sponsorshipRank), asc(countryRank), desc(jobs.createdAt)]

  if (filters.q) {
    const words = filters.q.trim().split(/\s+/).filter(Boolean)
    for (const word of words) {
      const pattern = `%${word}%`
      conditions.push(
        or(
          ilike(jobs.title, pattern),
          ilike(jobs.company, pattern),
          ilike(jobs.location, pattern),
          sql`exists (select 1 from unnest(${jobs.tags}) as t where t ilike ${pattern})`
        )!
      )
    }
  }

  if (filters.availability) conditions.push(eq(jobs.availability, filters.availability))
  if (filters.sponsorship) conditions.push(eq(jobs.visaSponsorshipStatus, filters.sponsorship))
  if (filters.country) conditions.push(eq(jobs.countryCode, filters.country))
  if (filters.workMode) conditions.push(eq(jobs.workMode, filters.workMode))
  if (filters.employmentType) conditions.push(eq(jobs.employmentType, filters.employmentType))
  if (filters.sourceType) conditions.push(eq(jobs.sourceType, filters.sourceType))
  if (typeof filters.minSalary === "number") conditions.push(gte(jobs.salaryMin, filters.minSalary))
  if (filters.onlyMatched) {
    conditions.push(
      user
        ? sql`exists (
            select 1
            from ${jobMatches}
            where ${jobMatches.jobId} = ${jobs.id}
              and ${jobMatches.userId} = ${user.id}
              and ${jobMatches.score} > 0
          )`
        : sql`false`
    )
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [categoryRows, [{ total }], pageJobs] = await Promise.all([
    db
      .select({ tag: sql<string>`unnest(${jobs.tags})` })
      .from(jobs)
      .groupBy(sql`unnest(${jobs.tags})`)
      .orderBy(sql`count(*) desc`)
      .limit(80),

    db
      .select({ total: sql<number>`cast(count(*) as int)` })
      .from(jobs)
      .where(where),

    db
      .select({
        id: jobs.id,
        title: jobs.title,
        company: jobs.company,
        url: jobs.url,
        description: jobs.description,
        salaryRange: jobs.salaryRange,
        salaryMin: jobs.salaryMin,
        salaryMax: jobs.salaryMax,
        currency: jobs.currency,
        location: jobs.location,
        countryCode: jobs.countryCode,
        tags: jobs.tags,
        eligibleCountries: jobs.eligibleCountries,
        sourceType: jobs.sourceType,
        applyAdapter: jobs.applyAdapter,
        visaSponsorshipStatus: jobs.visaSponsorshipStatus,
        workMode: jobs.workMode,
        employmentType: jobs.employmentType,
        postedBy: jobs.postedBy,
        availability: jobs.availability,
        lastChecked: jobs.lastChecked,
        closingAt: jobs.closingAt,
        createdAt: jobs.createdAt,
        matchScore: userMatchScore,
        applicantCount: sql<number>`cast(count(distinct ${applications.id}) as int)`,
        posterName: profiles.name,
        sourceName: jobSources.name,
      })
      .from(jobs)
      .leftJoin(applications, eq(applications.jobId, jobs.id))
      .leftJoin(profiles, eq(profiles.id, jobs.postedBy))
      .leftJoin(jobSources, eq(jobSources.id, jobs.sourceId))
      .where(where)
      .groupBy(jobs.id, profiles.name, jobSources.name)
      .orderBy(...ordering)
      .limit(PAGE_SIZE)
      .offset(offset),
  ])

  const categories = categoryRows.map((r) => r.tag).filter(Boolean)

  const userApplicationMap = new Map<string, { id: string; status: (typeof applications.$inferSelect)["status"] }>()

  if (user && pageJobs.length > 0) {
    const jobIds = pageJobs.map((j) => j.id)
    const userApps = await db
      .select({ id: applications.id, jobId: applications.jobId, status: applications.status })
      .from(applications)
      .where(and(eq(applications.userId, user.id), inArray(applications.jobId, jobIds)))
    userApps.forEach((a) => userApplicationMap.set(a.jobId, { id: a.id, status: a.status }))
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function pageUrl(p: number) {
    const params = new URLSearchParams()
    if (filters.q) params.set("q", filters.q)
    if (getString("category")) params.set("category", getString("category"))
    if (filters.sponsorship) params.set("sponsorship", filters.sponsorship)
    if (filters.workMode) params.set("workMode", filters.workMode)
    if (filters.employmentType) params.set("employmentType", filters.employmentType)
    if (filters.sourceType) params.set("sourceType", filters.sourceType)
    if (filters.country) params.set("country", filters.country)
    if (filters.minSalary) params.set("minSalary", String(filters.minSalary))
    if (filters.onlyMatched) params.set("onlyMatched", "true")
    if (p > 1) params.set("page", String(p))
    return `/jobs?${params.toString()}`
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Job Discovery</h1>
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString()} role{total === 1 ? "" : "s"}
            {Object.values(filters).some(Boolean) ? " matching filters" : " available"}
            {totalPages > 1 ? ` · page ${page} of ${totalPages}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {user && (
            <SaveSearchButton query={filters.q} filters={toSavedSearchFilters(filters)} />
          )}
          {user && (
            <Button asChild>
              <Link href="/jobs/new">Post a Job</Link>
            </Button>
          )}
        </div>
      </div>

      <JobFilters categories={categories} />

      {pageJobs.length > 0 ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pageJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                userApplication={userApplicationMap.get(job.id) ?? null}
                isAuthenticated={Boolean(user)}
                matchScore={job.matchScore}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 py-4">
              {page > 1 ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={pageUrl(page - 1)}>Previous</Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>Previous</Button>
              )}

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let p: number
                  if (totalPages <= 7) {
                    p = i + 1
                  } else if (i === 0) {
                    p = 1
                  } else if (i === 6) {
                    p = totalPages
                  } else if (page <= 4) {
                    p = i + 1
                  } else if (page >= totalPages - 3) {
                    p = totalPages - 6 + i
                  } else {
                    p = page - 3 + i
                  }

                  const isEllipsis =
                    totalPages > 7 &&
                    ((i === 1 && p > 2) || (i === 5 && p < totalPages - 1))

                  if (isEllipsis) {
                    return <span key={i} className="px-1 text-sm text-muted-foreground">…</span>
                  }

                  return (
                    <Button
                      key={i}
                      asChild={p !== page}
                      variant={p === page ? "default" : "ghost"}
                      size="sm"
                      className="w-9"
                      disabled={p === page}
                    >
                      {p === page ? <span>{p}</span> : <Link href={pageUrl(p)}>{p}</Link>}
                    </Button>
                  )
                })}
              </div>

              {page < totalPages ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={pageUrl(page + 1)}>Next</Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>Next</Button>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="text-5xl">😑</span>
          <h2 className="mt-4 text-lg font-semibold">No jobs found</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Try a different category or remove a filter.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/jobs">Clear all filters</Link>
          </Button>
        </div>
      )}
    </div>
  )
}
