import { notFound } from "next/navigation"
import Link from "next/link"
import { db } from "@/lib/db"
import { jobs, applications, profiles } from "@/lib/db/schema"
import { eq, sql, and } from "drizzle-orm"
import { createClient } from "@/lib/supabase/server"
import { AvailabilityBadge } from "@/components/jobs/availability-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MapPin, DollarSign, ExternalLink, Calendar, Users } from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"
import { ApplyButton } from "@/components/applications/apply-button"

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [job] = await db
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
      posterName: profiles.name,
    })
    .from(jobs)
    .leftJoin(profiles, eq(profiles.id, jobs.postedBy))
    .where(eq(jobs.id, id))
    .limit(1)

  if (!job) notFound()

  // Public applicant count (non-private applications)
  const [{ count }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(applications)
    .where(eq(applications.jobId, id))

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Check if user already applied
  let userApplication = null
  if (user) {
    const [existing] = await db
      .select()
      .from(applications)
      .where(and(eq(applications.jobId, id), eq(applications.userId, user.id)))
      .limit(1)
    userApplication = existing ?? null
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/jobs">← Back to jobs</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{job.title}</h1>
              <p className="text-lg text-muted-foreground font-medium">{job.company}</p>
            </div>
            <AvailabilityBadge availability={job.availability} />
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground pt-2">
            {job.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {job.location}
              </span>
            )}
            {job.salaryRange && (
              <span className="flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                {job.salaryRange}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Posted {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {count} from your group applied
            </span>
          </div>

          {job.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-2">
              {job.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {job.description && (
            <div>
              <h2 className="font-semibold mb-2">Description</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{job.description}</p>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <a href={job.url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="gap-2">
                View Original Listing <ExternalLink className="h-4 w-4" />
              </Button>
            </a>

            {user ? (
              userApplication ? (
                <Button asChild variant="secondary">
                  <Link href={`/applications/${userApplication.id}`}>
                    View My Application →
                  </Link>
                </Button>
              ) : (
                <ApplyButton jobId={job.id} />
              )
            ) : (
              <Button asChild>
                <Link href={`/login?redirectTo=/jobs/${job.id}`}>
                  Sign in to track application
                </Link>
              </Button>
            )}
          </div>

          {job.lastChecked && (
            <p className="text-xs text-muted-foreground">
              Availability last checked: {format(new Date(job.lastChecked), "PPp")}
            </p>
          )}
          {job.posterName && (
            <p className="text-xs text-muted-foreground">Posted by {job.posterName}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
