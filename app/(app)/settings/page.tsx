import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db"
import { profiles, invites } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { InviteManager } from "@/components/settings/invite-manager"
import { VisibilitySettings } from "@/components/settings/visibility-settings"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1)
  const myInvites = await db.select().from(invites).where(eq(invites.createdBy, user.id))

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm"><span className="font-medium">Name:</span> {profile?.name}</p>
          <p className="text-sm"><span className="font-medium">Email:</span> {user.email}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Visibility</CardTitle>
        </CardHeader>
        <CardContent>
          <VisibilitySettings currentVisibility={profile?.visibility ?? "public"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invites</CardTitle>
        </CardHeader>
        <CardContent>
          <InviteManager initialInvites={myInvites} />
        </CardContent>
      </Card>

      <Separator />

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/workspace">Open Workspace</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/settings/resumes">Manage CVs →</Link>
        </Button>
      </div>
    </div>
  )
}
