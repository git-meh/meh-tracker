import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db"
import { applications, jobs, profiles } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import type { ApplicationStatus } from "@/lib/db/schema"

const STATUS_COLUMNS: { status: ApplicationStatus; label: string; color: string }[] = [
  { status: "saved", label: "Saved", color: "bg-slate-100" },
  { status: "applied", label: "Applied", color: "bg-blue-50" },
  { status: "oa", label: "OA / Assessment", color: "bg-purple-50" },
  { status: "phone_screen", label: "Phone Screen", color: "bg-yellow-50" },
  { status: "interview", label: "Interview", color: "bg-orange-50" },
  { status: "offer", label: "Offer", color: "bg-green-50" },
]

const FINAL_STATUSES: ApplicationStatus[] = ["rejected", "withdrawn"]

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const userApplications = await db
    .select({
      id: applications.id,
      status: applications.status,
      isPrivate: applications.isPrivate,
      createdAt: applications.createdAt,
      jobTitle: jobs.title,
      jobCompany: jobs.company,
      jobId: jobs.id,
    })
    .from(applications)
    .leftJoin(jobs, eq(applications.jobId, jobs.id))
    .where(eq(applications.userId, user.id))

  const grouped = STATUS_COLUMNS.reduce(
    (acc, col) => {
      acc[col.status] = userApplications.filter((a) => a.status === col.status)
      return acc
    },
    {} as Record<ApplicationStatus, typeof userApplications>
  )

  const finalApps = userApplications.filter((a) =>
    FINAL_STATUSES.includes(a.status)
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            {userApplications.length} application{userApplications.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <Button asChild>
          <Link href="/jobs">Browse Jobs</Link>
        </Button>
      </div>

      {/* Kanban columns */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STATUS_COLUMNS.map(({ status, label, color }) => (
          <div key={status} className="w-64 flex-shrink-0">
            <div className={`rounded-lg border ${color} p-3`}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">{label}</h3>
                <Badge variant="secondary" className="text-xs">
                  {grouped[status]?.length ?? 0}
                </Badge>
              </div>
              <div className="space-y-2">
                {(grouped[status] ?? []).map((app) => (
                  <Link key={app.id} href={`/applications/${app.id}`}>
                    <div className="rounded-md border bg-background p-3 hover:shadow-sm transition-shadow cursor-pointer">
                      <p className="text-sm font-medium line-clamp-1">{app.jobTitle}</p>
                      <p className="text-xs text-muted-foreground">{app.jobCompany}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(app.createdAt), { addSuffix: true })}
                      </p>
                      {app.isPrivate && (
                        <span className="mt-1 inline-block text-xs text-muted-foreground">🔒 Private</span>
                      )}
                    </div>
                  </Link>
                ))}
                {(grouped[status] ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Empty</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Final outcomes */}
      {finalApps.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Closed</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
            {finalApps.map((app) => (
              <Link key={app.id} href={`/applications/${app.id}`}>
                <div className="rounded-md border bg-background p-3 hover:shadow-sm transition-shadow">
                  <p className="text-sm font-medium">{app.jobTitle}</p>
                  <p className="text-xs text-muted-foreground">{app.jobCompany}</p>
                  <Badge
                    variant={app.status === "offer" ? "success" : "destructive"}
                    className="mt-1 text-xs capitalize"
                  >
                    {app.status}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {userApplications.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="text-6xl">😑</span>
          <h2 className="mt-4 text-xl font-semibold">Nothing tracked yet</h2>
          <p className="mt-2 text-muted-foreground">Browse the job board and start applying.</p>
          <Button asChild className="mt-4">
            <Link href="/jobs">Browse Jobs</Link>
          </Button>
        </div>
      )}
    </div>
  )
}
