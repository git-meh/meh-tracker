"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  Users,
  Settings,
  PlusCircle,
  LogIn,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { User } from "@supabase/supabase-js"

const publicNavItems = [
  { href: "/jobs", label: "Job Board", icon: Briefcase },
]

const authNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Job Board", icon: Briefcase },
  { href: "/applications", label: "My Applications", icon: FileText },
  { href: "/group", label: "Group Feed", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
]

interface SidebarProps {
  user: User | null
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const navItems = user ? authNavItems : publicNavItems

  return (
    <aside className="flex h-full w-60 flex-col border-r bg-background">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/jobs" className="flex items-center gap-2 font-bold text-lg">
          <span className="text-2xl">😑</span>
          <span>meh-tracker</span>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-4">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
              pathname === href || (href !== "/jobs" && pathname.startsWith(href + "/"))
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="border-t p-4 space-y-2">
        {user ? (
          <Link
            href="/jobs/new"
            className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            Post a Job
          </Link>
        ) : (
          <Link
            href="/login"
            className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            <LogIn className="h-4 w-4" />
            Sign in to track jobs
          </Link>
        )}
      </div>
    </aside>
  )
}
