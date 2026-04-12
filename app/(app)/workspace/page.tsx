import { desc, eq } from "drizzle-orm"
import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db"
import {
  automationPreferences,
  candidateProfiles,
  notificationEvents,
  resumes,
  resumeVersions,
  savedSearches,
} from "@/lib/db/schema"
import { ResumeManager } from "@/components/resumes/resume-manager"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CandidateProfileForm } from "@/components/workspace/candidate-profile-form"
import { AutomationPreferencesForm } from "@/components/workspace/automation-preferences-form"
import { SavedSearchesList } from "@/components/workspace/saved-searches-list"
import { NotificationFeed } from "@/components/workspace/notification-feed"
import { JobBoardPreferences } from "@/components/workspace/job-board-preferences"

export default async function WorkspacePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [profile] = await db
    .select()
    .from(candidateProfiles)
    .where(eq(candidateProfiles.userId, user.id))
    .limit(1)

  const [preferences] = await db
    .select()
    .from(automationPreferences)
    .where(eq(automationPreferences.userId, user.id))
    .limit(1)

  const userResumes = await db
    .select()
    .from(resumes)
    .where(eq(resumes.userId, user.id))

  const versions = await db
    .select()
    .from(resumeVersions)
    .where(eq(resumeVersions.userId, user.id))
    .orderBy(desc(resumeVersions.createdAt))

  const searches = await db
    .select()
    .from(savedSearches)
    .where(eq(savedSearches.userId, user.id))
    .orderBy(desc(savedSearches.createdAt))

  const events = await db
    .select()
    .from(notificationEvents)
    .where(eq(notificationEvents.userId, user.id))
    .orderBy(desc(notificationEvents.createdAt))
    .limit(10)

  const versionMap = new Map<string, typeof versions>()
  versions.forEach((version) => {
    const existing = versionMap.get(version.resumeId) ?? []
    existing.push(version)
    versionMap.set(version.resumeId, existing)
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Candidate Workspace</h1>
        <p className="text-sm text-muted-foreground">
          Keep your visa profile, CV versions, saved searches, and automation settings in one place.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Candidate Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <CandidateProfileForm profile={profile ?? null} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">CV Library</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ResumeManager initialResumes={userResumes} />
          {userResumes.length > 0 ? (
            <div className="space-y-2">
              {userResumes.map((resume) => {
                const resumeVersionList = versionMap.get(resume.id) ?? []
                const latestVersion = resumeVersionList[0]

                return (
                  <div
                    key={resume.id}
                    className="rounded-lg border bg-muted/20 p-3 text-sm"
                  >
                    <p className="font-medium">{resume.fileName}</p>
                    <p className="text-muted-foreground">
                      {resumeVersionList.length} version
                      {resumeVersionList.length === 1 ? "" : "s"}
                      {latestVersion
                        ? ` · latest extraction status: ${latestVersion.extractionStatus}`
                        : ""}
                    </p>
                  </div>
                )
              })}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Job Board Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Choose which job boards and sectors appear in your Recommended Jobs feed.
            Leave everything unchecked to see jobs from all sources.
          </p>
          <JobBoardPreferences currentBoards={profile?.preferredBoards ?? []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Automation & Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <AutomationPreferencesForm
            preferences={preferences ?? null}
            executorConfigured={Boolean(process.env.AUTOMATION_EXECUTOR_WEBHOOK_URL)}
            notificationWebhookConfigured={Boolean(process.env.NOTIFICATION_WEBHOOK_URL)}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Saved Searches</CardTitle>
          </CardHeader>
          <CardContent>
            <SavedSearchesList searches={searches} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Notification Events</CardTitle>
          </CardHeader>
          <CardContent>
            <NotificationFeed events={events} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
