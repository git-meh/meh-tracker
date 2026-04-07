import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { db } from "@/lib/db"
import { applications, jobs, applicationStatusHistory, resumes, profiles } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AvailabilityBadge } from "@/components/jobs/availability-badge"
import { StatusChanger } from "@/components/applications/status-changer"
import { PrivacyToggle } from "@/components/applications/privacy-toggle"
import { format } from "date-fns"
import { ExternalLink, FileText } from "lucide-react"
import type { ApplicationStatus } from "@/lib/db/schema"

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  oa: "OA / Assessment",
  phone_screen: "Phone Screen",
  interview: "Interview",
  offer: "Offer Received",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
}

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [app] = await db
    .select({
      id: applications.id,
      status: applications.status,
      notes: applications.notes,
      isPrivate: applications.isPrivate,
      appliedAt: applications.appliedAt,
      createdAt: applications.createdAt,
      updatedAt: applications.updatedAt,
      resumeId: applications.resumeId,
      jobTitle: jobs.title,
      jobCompany: jobs.company,
      jobUrl: jobs.url,
      jobId: jobs.id,
      jobAvailability: jobs.availability,
      resumeFileName: resumes.fileName,
    })
    .from(applications)
    .leftJoin(jobs, eq(applications.jobId, jobs.id))
    .leftJoin(resumes, eq(applications.resumeId, resumes.id))
    .where(eq(applications.id, id))
    .limit(1)

  if (!app || app.id !== id) notFound()
  // Only owner can view
  const [fullApp] = await db.select().from(applications).where(eq(applications.id, id)).limit(1)
  if (fullApp.userId !== user.id) notFound()

  const history = await db
    .select({
      id: applicationStatusHistory.id,
      fromStatus: applicationStatusHistory.fromStatus,
      toStatus: applicationStatusHistory.toStatus,
      note: applicationStatusHistory.note,
      changedAt: applicationStatusHistory.changedAt,
      changerName: profiles.name,
    })
    .from(applicationStatusHistory)
    .leftJoin(profiles, eq(applicationStatusHistory.changedBy, profiles.id))
    .where(eq(applicationStatusHistory.applicationId, id))
    .orderBy(desc(applicationStatusHistory.changedAt))

  // const userResumes = await db
  //   .select()
  //   .from(resumes)
  //   .where(eq(resumes.userId, user.id))

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/applications">← My Applications</Link>
      </Button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{app.jobTitle}</h1>
          <p className="text-muted-foreground">{app.jobCompany}</p>
        </div>
        <div className="flex items-center gap-2">
          {app.jobAvailability && <AvailabilityBadge availability={app.jobAvailability} />}
          {app.jobUrl && (
            <a href={app.jobUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1">
                <ExternalLink className="h-3 w-3" /> View Job
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Status + Privacy */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Application Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground w-20">Status</span>
            <StatusChanger applicationId={id} currentStatus={app.status} />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground w-20">Privacy</span>
            <PrivacyToggle applicationId={id} isPrivate={app.isPrivate} />
          </div>
          {app.resumeFileName && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground w-20">CV Used</span>
              <span className="flex items-center gap-1 text-sm">
                <FileText className="h-4 w-4" /> {app.resumeFileName}
              </span>
            </div>
          )}
          {app.appliedAt && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground w-20">Applied</span>
              <span className="text-sm">{format(new Date(app.appliedAt), "PPP")}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No status changes yet.</p>
          ) : (
            <ol className="relative border-l border-muted ml-3 space-y-4">
              {history.map((h) => (
                <li key={h.id} className="ml-4">
                  <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-background bg-primary" />
                  <p className="text-sm font-medium">
                    {h.fromStatus
                      ? `${STATUS_LABELS[h.fromStatus]} → ${STATUS_LABELS[h.toStatus]}`
                      : `Started as ${STATUS_LABELS[h.toStatus]}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(h.changedAt), "PPp")}
                    {h.changerName && ` · ${h.changerName}`}
                  </p>
                  {h.note && <p className="text-xs mt-1 text-muted-foreground">{h.note}</p>}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
