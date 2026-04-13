import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { db } from "@/lib/db"
import { applications, jobs, applicationRuns, applicationStatusHistory, generatedArtifacts, resumes, profiles } from "@/lib/db/schema"
import { desc, eq } from "drizzle-orm"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AvailabilityBadge } from "@/components/jobs/availability-badge"
import { StatusChanger } from "@/components/applications/status-changer"
import { PrivacyToggle } from "@/components/applications/privacy-toggle"
import { DeleteApplicationButton } from "@/components/applications/delete-application-button"
import { format } from "date-fns"
import { ExternalLink, FileText } from "lucide-react"
import type { ApplicationStatus } from "@/lib/db/schema"
import { JOB_SOURCE_TYPE_LABELS } from "@/lib/visa-platform/constants"

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
      resumeVersionId: applications.resumeVersionId,
      sourceJobId: applications.sourceJobId,
      jobSourceType: applications.jobSourceType,
      matchedScore: applications.matchedScore,
      matchReason: applications.matchReason,
      submissionAttempts: applications.submissionAttempts,
      automationMode: applications.automationMode,
      externalApplicationId: applications.externalApplicationId,
      externalConfirmationUrl: applications.externalConfirmationUrl,
      lastSubmissionAt: applications.lastSubmissionAt,
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

  const runs = await db
    .select()
    .from(applicationRuns)
    .where(eq(applicationRuns.applicationId, id))
    .orderBy(desc(applicationRuns.createdAt))

  const artifacts = await db
    .select()
    .from(generatedArtifacts)
    .where(eq(generatedArtifacts.applicationId, id))
    .orderBy(desc(generatedArtifacts.createdAt))

  const latestArtifacts = new Map<string, (typeof artifacts)[number]>()
  artifacts.forEach((artifact) => {
    if (!latestArtifacts.has(artifact.type)) {
      latestArtifacts.set(artifact.type, artifact)
    }
  })

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/applications">← My Applications</Link>
        </Button>
        <DeleteApplicationButton applicationId={id} />
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{app.jobTitle}</h1>
          <p className="text-muted-foreground">{app.jobCompany}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
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
          {app.matchedScore ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground w-20">Match</span>
              <span className="text-sm">
                {app.matchedScore} · {app.matchReason ?? "Generated from profile matching"}
              </span>
            </div>
          ) : null}
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground w-20">Source</span>
            <span className="text-sm">{JOB_SOURCE_TYPE_LABELS[app.jobSourceType]}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground w-20">Automation</span>
            <span className="text-sm">
              {app.automationMode.replace(/_/g, " ")} · {app.submissionAttempts} attempt
              {app.submissionAttempts === 1 ? "" : "s"}
            </span>
          </div>
          {app.externalConfirmationUrl ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground w-20">Confirm</span>
              <a
                href={app.externalConfirmationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                External confirmation
              </a>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generated Package</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {latestArtifacts.size === 0 ? (
            <p className="text-sm text-muted-foreground">
              No generated artifacts are attached to this application yet.
            </p>
          ) : (
            Array.from(latestArtifacts.values()).map((artifact) => (
              <div key={artifact.id} className="rounded-lg border bg-muted/20 p-4">
                <p className="text-sm font-medium capitalize">
                  {artifact.type.replace(/_/g, " ")}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {artifact.content ?? "No content stored for this artifact."}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Submission Audit</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No submission runs yet. Approving an AI draft or future automation attempts will appear here.
            </p>
          ) : (
            <div className="space-y-3">
              {runs.map((run) => (
                <div key={run.id} className="rounded-lg border bg-muted/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">
                      {run.status.replace(/_/g, " ")} · {run.adapter}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      Attempt {run.attemptNumber}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {run.log || run.error || "No executor log recorded."}
                  </p>
                  {run.externalUrl ? (
                    <a
                      href={run.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-sm text-primary hover:underline"
                    >
                      Open external flow
                    </a>
                  ) : null}
                </div>
              ))}
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
