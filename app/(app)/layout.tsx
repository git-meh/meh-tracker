import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"

// Note: actual route protection is handled by middleware.ts
// This layout renders for both authenticated and anonymous users.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile = null
  if (user) {
    const [p] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1)
    profile = p ?? null
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={user} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header profile={profile} />
        <main className="flex-1 overflow-y-auto bg-muted/20 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
