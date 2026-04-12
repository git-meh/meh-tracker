import Link from "next/link"
import { and, desc, eq } from "drizzle-orm"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db"
import {
  applicationDrafts,
  applications,
  generatedArtifacts,
  jobMatches,
  jobs,
} from "@/lib/db/schema"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DraftReviewForm } from "@/components/matches/draft-review-form"
import {
  JOB_BOARD_LABELS,
  JOB_SOURCE_TYPE_LABELS,
  VISA_SPONSORSHIP_LABELS,
  WORK_MODE_LABELS,
} from "@/lib/visa-platform/constants"

export default async function DraftReviewPage({
  params,
}: {
  params: Promise<{ draftId: string }>
}) {
  const { draftId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const [draft] = await db
    .select()
    .from(applicationDrafts)
    .where(and(eq(applicationDrafts.id, draftId), eq(applicationDrafts.userId, user.id)))
    .limit(1)

  if (!draft) {
    notFound()
  }

  const [job] = await db
    .select()
    .from(jobs)
    .where(eq(jobs.id, draft.jobId))
    .limit(1)

  if (!job) {
    notFound()
  }

  const [match] = draft.jobMatchId
    ? await db
        .select()
        .from(jobMatches)
        .where(eq(jobMatches.id, draft.jobMatchId))
        .limit(1)
    : []

  const [application] = draft.applicationId
    ? await db
        .select()
        .from(applications)
        .where(eq(applications.id, draft.applicationId))
        .limit(1)
    : []

  const artifacts = await db
    .select()
    .from(generatedArtifacts)
    .where(eq(generatedArtifacts.draftId, draft.id))
    .orderBy(desc(generatedArtifacts.createdAt))

  const latestByType = new Map<string, (typeof artifacts)[number]>()
  artifacts.forEach((artifact) => {
    if (!latestByType.has(artifact.type)) {
      latestByType.set(artifact.type, artifact)
    }
  })

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/matches">← Back to Matches</Link>
          </Button>
          <h1 className="mt-3 text-2xl font-bold">Review Draft</h1>
          <p className="text-sm text-muted-foreground">
            Edit the tailored package before approving the application.
          </p>
        </div>
        {application ? (
          <Button asChild variant="outline">
            <Link href={`/applications/${application.id}`}>View Application</Link>
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{job.title}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {job.company}
            {job.location ? ` · ${job.location}` : ""}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{VISA_SPONSORSHIP_LABELS[job.visaSponsorshipStatus]}</Badge>
            <Badge variant="outline">{WORK_MODE_LABELS[job.workMode]}</Badge>
            <Badge variant="outline">{JOB_SOURCE_TYPE_LABELS[job.sourceType]}</Badge>
            {job.sourceKey ? (
              <Badge variant="outline">{JOB_BOARD_LABELS[job.sourceKey] ?? job.sourceKey}</Badge>
            ) : null}
            <Badge variant="secondary">Draft: {draft.status}</Badge>
            {match ? (
              <Badge variant={match.score >= 75 ? "success" : match.score >= 50 ? "warning" : "secondary"}>
                Match {match.score}
              </Badge>
            ) : null}
          </div>

          {match ? (
            <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
              <p className="text-sm font-medium">Why this role is in your queue</p>
              <p className="text-sm text-muted-foreground">{match.rationale}</p>
              {match.fitSignals.length > 0 ? (
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {match.fitSignals.slice(0, 5).map((signal) => (
                    <li key={signal}>• {signal}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Editable Application Package</CardTitle>
        </CardHeader>
        <CardContent>
          <DraftReviewForm
            draftId={draft.id}
            initialReviewNotes={draft.reviewNotes}
            initialArtifacts={{
              tailored_resume: latestByType.get("tailored_resume")?.content ?? "",
              cover_letter: latestByType.get("cover_letter")?.content ?? "",
              application_answers: latestByType.get("application_answers")?.content ?? "",
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
