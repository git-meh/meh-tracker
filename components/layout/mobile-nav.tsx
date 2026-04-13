"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import {
  Menu,
  X,
  LayoutDashboard,
  Briefcase,
  FileText,
  Sparkles,
  Users,
  Settings,
  Target,
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
  { href: "/jobs", label: "Discover Jobs", icon: Briefcase },
  { href: "/matches", label: "AI Matches", icon: Sparkles },
  { href: "/applications", label: "My Applications", icon: FileText },
  { href: "/workspace", label: "Workspace", icon: Target },
  { href: "/group", label: "Group Feed", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
]

interface MobileNavProps {
  user: User | null
}

export function MobileNav({ user }: MobileNavProps) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const navItems = user ? authNavItems : publicNavItems

  function close() {
    setIsOpen(false)
  }

  return (
    <>
      <button
        className="md:hidden p-2 rounded-md hover:bg-accent transition-colors"
        aria-label="Open navigation menu"
        onClick={() => setIsOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-50 bg-black/60 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={close}
            />

            {/* Drawer */}
            <motion.div
              key="drawer"
              className="fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r bg-background shadow-lg md:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
            >
              <div className="flex h-16 items-center justify-between border-b px-6">
                <Link href="/jobs" className="flex items-center gap-2 font-bold text-lg" onClick={close}>
                  <span className="text-2xl">😑</span>
                  <span>meh-tracker</span>
                </Link>
                <button
                  className="rounded-sm p-1 opacity-70 transition-opacity hover:opacity-100"
                  onClick={close}
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="flex flex-1 flex-col gap-1 p-4">
                {navItems.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={close}
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

              <div className="border-t p-4">
                {user ? (
                  <Link
                    href="/jobs/new"
                    onClick={close}
                    className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Post a Job
                  </Link>
                ) : (
                  <Link
                    href="/login"
                    onClick={close}
                    className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
                  >
                    <LogIn className="h-4 w-4" />
                    Sign in to track jobs
                  </Link>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
