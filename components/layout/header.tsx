"use client"

import { useRouter } from "next/navigation"
import { LogOut, User, FileText, Sparkles } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import type { Profile } from "@/lib/db/schema"
import Link from "next/link"

interface HeaderProps {
  profile: Profile | null
}

export function Header({ profile }: HeaderProps) {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/jobs")
    router.refresh()
  }

  const initials = profile?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <header className="flex h-16 items-center justify-end border-b bg-background px-6 gap-3">
      {profile ? (
        <>
          <Link
            href="/settings/resumes"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <FileText className="h-4 w-4" />
            My CVs
          </Link>
          <Link
            href="/matches"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            AI Matches
          </Link>
          <Link href="/settings">
            <Avatar className="h-8 w-8 cursor-pointer">
              <AvatarImage src={profile.avatarUrl ?? undefined} />
              <AvatarFallback className="text-xs">{initials ?? <User className="h-4 w-4" />}</AvatarFallback>
            </Avatar>
          </Link>
          <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/signup">Sign up</Link>
          </Button>
        </div>
      )}
    </header>
  )
}
