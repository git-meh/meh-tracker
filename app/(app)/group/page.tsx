import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db"
import { applications, jobs, profiles, applicationStatusHistory } from "@/lib/db/schema"
import { eq, desc, and, ne } from "drizzle-orm"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { AvailabilityBadge } from "@/components/jobs/availability-badge"
import { formatDistanceToNow } from "date-fns"
import { GroupFeedRealtime } from "@/components/group/group-feed-realtime"
import type { ApplicationStatus } from "@/lib/db/schema"

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: "saved",
  applied: "applied to",
  oa: "has an assessment for",
  phone_screen: "has a phone screen for",
  interview: "has an interview for",
  offer: "received an offer from",
  rejected: "was rejected from",
  withdrawn: "withdrew from",
}

export default async function GroupFeedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Get recent public status changes from other group members
  const recentHistory = await db
    .select({
      id: applicationStatusHistory.id,
      toStatus: applicationStatusHistory.toStatus,
      changedAt: applicationStatusHistory.changedAt,
      applicationId: applicationStatusHistory.applicationId,
      isPrivate: applications.isPrivate,
      jobTitle: jobs.title,
      jobCompany: jobs.company,
      jobAvailability: jobs.availability,
      jobId: jobs.id,
      userName: profiles.name,
      userId: profiles.id,
    })
    .from(applicationStatusHistory)
    .innerJoin(applications, eq(applicationStatusHistory.applicationId, applications.id))
    .innerJoin(jobs, eq(applications.jobId, jobs.id))
    .innerJoin(profiles, eq(applicationStatusHistory.changedBy, profiles.id))
    .where(
      and(
        ne(applicationStatusHistory.changedBy, user.id),
        eq(applications.isPrivate, false)
      )
    )
    .orderBy(desc(applicationStatusHistory.changedAt))
    .limit(50)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Group Feed</h1>
        <p className="text-sm text-muted-foreground">What your friends are up to</p>
      </div>

      <GroupFeedRealtime userId={user.id} />

      {recentHistory.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="text-5xl">😑</span>
          <h2 className="mt-4 text-lg font-semibold">Nothing here yet</h2>
          <p className="text-muted-foreground">Invite friends to see their activity.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recentHistory.map((item) => {
            const initials = item.userName
              ?.split(" ")
              .map((n: string) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)

            return (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-lg border bg-background p-4"
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{item.userName}</span>{" "}
                    <span className="text-muted-foreground">
                      {STATUS_LABELS[item.toStatus]}
                    </span>{" "}
                    <span className="font-medium">{item.jobTitle}</span>{" "}
                    <span className="text-muted-foreground">at</span>{" "}
                    <span className="font-medium">{item.jobCompany}</span>
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {item.jobAvailability && (
                      <AvailabilityBadge availability={item.jobAvailability} />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(item.changedAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
