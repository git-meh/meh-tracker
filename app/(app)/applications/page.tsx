import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db"
import { applications, jobs } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AvailabilityBadge } from "@/components/jobs/availability-badge"
import { formatDistanceToNow } from "date-fns"
import { Lock } from "lucide-react"
import type { ApplicationStatus } from "@/lib/db/schema"

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  saved: "secondary",
  applied: "default",
  oa: "outline",
  phone_screen: "warning",
  interview: "warning",
  offer: "success",
  rejected: "destructive",
  withdrawn: "secondary",
} as const

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  oa: "OA",
  phone_screen: "Phone Screen",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
}

export default async function ApplicationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const userApplications = await db
    .select({
      id: applications.id,
      status: applications.status,
      isPrivate: applications.isPrivate,
      createdAt: applications.createdAt,
      updatedAt: applications.updatedAt,
      appliedAt: applications.appliedAt,
      jobTitle: jobs.title,
      jobCompany: jobs.company,
      jobId: jobs.id,
      jobAvailability: jobs.availability,
    })
    .from(applications)
    .leftJoin(jobs, eq(applications.jobId, jobs.id))
    .where(eq(applications.userId, user.id))
    .orderBy(desc(applications.updatedAt))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Applications</h1>
        <p className="text-sm text-muted-foreground">
          {userApplications.length} application{userApplications.length !== 1 ? "s" : ""}
        </p>
      </div>

      {userApplications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="text-5xl">😑</span>
          <h2 className="mt-4 text-lg font-semibold">No applications yet</h2>
          <p className="text-muted-foreground">Start tracking by visiting a job listing.</p>
          <Button asChild className="mt-4">
            <Link href="/jobs">Browse Jobs</Link>
          </Button>
        </div>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="sm:hidden space-y-3">
            {userApplications.map((app) => (
              <Link key={app.id} href={`/applications/${app.id}`}>
                <div className="rounded-lg border bg-background p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{app.jobTitle}</p>
                      <p className="text-xs text-muted-foreground">{app.jobCompany}</p>
                    </div>
                    <Badge variant={STATUS_COLORS[app.status] as "default" | "secondary" | "destructive" | "outline"} className="shrink-0">
                      {STATUS_LABELS[app.status]}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {app.jobAvailability && <AvailabilityBadge availability={app.jobAvailability} />}
                    {app.isPrivate && (
                      <span className="flex items-center gap-1 text-muted-foreground text-xs">
                        <Lock className="h-3 w-3" /> Private
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(app.updatedAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block rounded-lg border bg-background overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Job</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Availability</th>
                  <th className="px-4 py-3 text-left font-medium">Updated</th>
                  <th className="px-4 py-3 text-left font-medium">Privacy</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {userApplications.map((app) => (
                  <tr key={app.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{app.jobTitle}</p>
                        <p className="text-muted-foreground text-xs">{app.jobCompany}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_COLORS[app.status] as "default" | "secondary" | "destructive" | "outline"}>
                        {STATUS_LABELS[app.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {app.jobAvailability && (
                        <AvailabilityBadge availability={app.jobAvailability} />
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDistanceToNow(new Date(app.updatedAt), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3">
                      {app.isPrivate && (
                        <span className="flex items-center gap-1 text-muted-foreground text-xs">
                          <Lock className="h-3 w-3" /> Private
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/applications/${app.id}`}>View →</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
