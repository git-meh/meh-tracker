import { db } from "@/lib/db"
import { jobs, applications, profiles } from "@/lib/db/schema"
import { desc, eq, sql } from "drizzle-orm"
import { JobCard } from "@/components/jobs/job-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; availability?: string }>
}) {
  const { q, availability } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const allJobs = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      company: jobs.company,
      url: jobs.url,
      description: jobs.description,
      salaryRange: jobs.salaryRange,
      location: jobs.location,
      tags: jobs.tags,
      postedBy: jobs.postedBy,
      availability: jobs.availability,
      lastChecked: jobs.lastChecked,
      createdAt: jobs.createdAt,
      applicantCount: sql<number>`cast(count(${applications.id}) as int)`,
      posterName: profiles.name,
    })
    .from(jobs)
    .leftJoin(applications, eq(applications.jobId, jobs.id))
    .leftJoin(profiles, eq(profiles.id, jobs.postedBy))
    .groupBy(jobs.id, profiles.name)
    .orderBy(desc(jobs.createdAt))

  // Fetch current user's applications for the "already applied" state on cards
  const userApplicationMap = new Map<string, { id: string; status: (typeof applications.$inferSelect)["status"] }>()
  if (user) {
    const userApps = await db
      .select({ id: applications.id, jobId: applications.jobId, status: applications.status })
      .from(applications)
      .where(eq(applications.userId, user.id))
    userApps.forEach((a) => userApplicationMap.set(a.jobId, { id: a.id, status: a.status }))
  }

  const filtered = allJobs.filter((job) => {
    if (q && !`${job.title} ${job.company} ${job.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase())) {
      return false
    }
    if (availability && job.availability !== availability) return false
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Job Board</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} job{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        {user && (
          <Button asChild>
            <Link href="/jobs/new">Post a Job</Link>
          </Button>
        )}
      </div>

      {/* Filters */}
      <form className="flex flex-wrap gap-2">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search by title, company, or tag..."
          className="max-w-xs"
        />
        <select
          name="availability"
          defaultValue={availability ?? ""}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="unknown">Unknown</option>
        </select>
        <Button type="submit" variant="outline" size="sm">Filter</Button>
        {(q || availability) && (
          <Button asChild variant="ghost" size="sm">
            <Link href="/jobs">Clear</Link>
          </Button>
        )}
      </form>

      {/* Job list */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            userApplication={userApplicationMap.get(job.id) ?? null}
            isAuthenticated={!!user}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="text-5xl">😑</span>
          <h2 className="mt-4 text-lg font-semibold">No jobs found</h2>
          <p className="text-muted-foreground">Try adjusting your filters or post a new job.</p>
          {user && (
            <Button asChild className="mt-4">
              <Link href="/jobs/new">Post a Job</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
