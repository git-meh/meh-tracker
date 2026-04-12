import Link from "next/link"
import { and, desc, eq, sql } from "drizzle-orm"
import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db"
import {
  applications,
  applicationDrafts,
  candidateProfiles,
  generatedArtifacts,
  jobMatches,
  jobs,
} from "@/lib/db/schema"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RefreshMatchesButton } from "@/components/matches/refresh-matches-button"
import { GenerateDraftButton } from "@/components/matches/generate-draft-button"
import {
  JOB_BOARD_LABELS,
  JOB_SOURCE_TYPE_LABELS,
  VISA_SPONSORSHIP_LABELS,
  WORK_MODE_LABELS,
} from "@/lib/visa-platform/constants"

export default async function MatchesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // Check if the user has a profile so we can show an onboarding nudge
  const [profile] = await db
    .select({
      skills: candidateProfiles.skills,
      targetRoles: candidateProfiles.targetRoles,
      preferredBoards: candidateProfiles.preferredBoards,
    })
    .from(candidateProfiles)
    .where(eq(candidateProfiles.userId, user.id))
    .limit(1)

  const hasProfile = Boolean(profile?.skills?.length || profile?.targetRoles?.length)
  const preferredBoards = profile?.preferredBoards ?? []

  const matches = await db
    .select({
      matchId: jobMatches.id,
      score: jobMatches.score,
      rationale: jobMatches.rationale,
      fitSignals: jobMatches.fitSignals,
      concerns: jobMatches.concerns,
      draftId: applicationDrafts.id,
      draftStatus: applicationDrafts.status,
      applicationId: applications.id,
      jobId: jobs.id,
      title: jobs.title,
      company: jobs.company,
      url: jobs.url,
      location: jobs.location,
      sourceType: jobs.sourceType,
      sourceKey: jobs.sourceKey,
      visaSponsorshipStatus: jobs.visaSponsorshipStatus,
      workMode: jobs.workMode,
      createdAt: jobs.createdAt,
    })
    .from(jobMatches)
    .innerJoin(jobs, eq(jobMatches.jobId, jobs.id))
    .leftJoin(
      applicationDrafts,
      and(
        eq(applicationDrafts.userId, user.id),
        eq(applicationDrafts.jobId, jobs.id)
      )
    )
    .leftJoin(
      applications,
      and(eq(applications.userId, user.id), eq(applications.jobId, jobs.id))
    )
    .where(
      preferredBoards.length > 0
        ? and(
            eq(jobMatches.userId, user.id),
            sql`${jobs.sourceKey} = any (ARRAY[${sql.join(
              preferredBoards.map((board) => sql`${board}`),
              sql`, `
            )}]::text[])`
          )
        : eq(jobMatches.userId, user.id)
    )
    // Visa-eligible jobs first, then by match score descending
    .orderBy(
      sql`case when ${jobs.visaSponsorshipStatus} = 'eligible' then 0 when ${jobs.visaSponsorshipStatus} = 'possible' then 1 else 2 end`,
      desc(jobMatches.score)
    )

  const draftIds = matches
    .map((match) => match.draftId)
    .filter((value): value is string => Boolean(value))

  const artifacts = draftIds.length
    ? await db
        .select()
        .from(generatedArtifacts)
        .where(eq(generatedArtifacts.userId, user.id))
        .orderBy(desc(generatedArtifacts.createdAt))
    : []

  const artifactsByDraft = new Map<string, typeof artifacts>()
  artifacts.forEach((artifact) => {
    if (!artifact.draftId || !draftIds.includes(artifact.draftId)) return
    const bucket = artifactsByDraft.get(artifact.draftId) ?? []
    bucket.push(artifact)
    artifactsByDraft.set(artifact.draftId, bucket)
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Recommended Jobs</h1>
          <p className="text-sm text-muted-foreground">
            Scores open roles against your profile and UK visa requirements.
          </p>
          {!hasProfile && (
            <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
              Your workspace profile is empty — add your skills and target roles first so matching is meaningful.{" "}
              <a href="/workspace" className="underline">Open Workspace →</a>
            </p>
          )}
        </div>
        <RefreshMatchesButton />
      </div>

      {matches.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-lg font-semibold">No matches yet</p>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Complete your candidate workspace, then refresh matches to generate a ranked review queue.
            </p>
            <div className="mt-4 flex gap-2">
              <Button asChild variant="outline">
                <Link href="/workspace">Open Workspace</Link>
              </Button>
              <RefreshMatchesButton />
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {matches.map((match) => {
            const draftArtifacts = match.draftId
              ? artifactsByDraft.get(match.draftId) ?? []
              : []

            return (
              <Card key={match.matchId}>
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{match.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {match.company}
                        {match.location ? ` · ${match.location}` : ""}
                      </p>
                    </div>
                    <Badge variant={match.score >= 75 ? "success" : match.score >= 50 ? "warning" : "secondary"}>
                      Match {match.score}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      {VISA_SPONSORSHIP_LABELS[match.visaSponsorshipStatus]}
                    </Badge>
                    <Badge variant="outline">
                      {WORK_MODE_LABELS[match.workMode]}
                    </Badge>
                    <Badge variant="outline">
                      {JOB_SOURCE_TYPE_LABELS[match.sourceType]}
                    </Badge>
                    {match.sourceKey ? (
                      <Badge variant="outline">
                        {JOB_BOARD_LABELS[match.sourceKey] ?? match.sourceKey}
                      </Badge>
                    ) : null}
                    {match.draftStatus ? (
                      <Badge variant="secondary">Draft: {match.draftStatus}</Badge>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{match.rationale}</p>

                  {match.fitSignals.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Fit Signals</p>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {match.fitSignals.slice(0, 4).map((signal) => (
                          <li key={signal}>• {signal}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {match.concerns.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Watch-outs</p>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {match.concerns.slice(0, 3).map((concern) => (
                          <li key={concern}>• {concern}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {draftArtifacts.length > 0 ? (
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <p className="text-sm font-medium">Latest draft artifacts</p>
                      <div className="mt-2 space-y-2">
                        {draftArtifacts.slice(0, 3).map((artifact) => (
                          <div key={artifact.id}>
                            <p className="text-xs font-medium uppercase text-muted-foreground">
                              {artifact.type.replace(/_/g, " ")}
                            </p>
                            <p className="line-clamp-3 text-sm text-muted-foreground">
                              {artifact.content ?? "No content generated yet."}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2">
                    <GenerateDraftButton
                      jobId={match.jobId}
                      draftId={match.draftId}
                    />
                    {match.applicationId ? (
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/applications/${match.applicationId}`}>
                          View Application
                        </Link>
                      </Button>
                    ) : null}
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/jobs/${match.jobId}`}>View Job</Link>
                    </Button>
                    <a
                      href={match.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      Open Source
                    </a>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
