"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Bookmark, Loader2, X } from "lucide-react"
import type { ApplicationStatus } from "@/lib/db/schema"

interface QuickApplyButtonProps {
  jobId: string
  existingApplicationId?: string
  existingStatus?: ApplicationStatus
}

export function QuickApplyButton({
  jobId,
  existingApplicationId,
  existingStatus,
}: QuickApplyButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function track(status: ApplicationStatus) {
    setLoading(true)
    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, status }),
    })
    if (res.ok) router.refresh()
    setLoading(false)
  }

  async function remove() {
    if (!existingApplicationId) return
    setLoading(true)
    const res = await fetch(`/api/applications/${existingApplicationId}`, {
      method: "DELETE",
    })
    if (res.ok) router.refresh()
    setLoading(false)
  }

  if (existingApplicationId) {
    return (
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => router.push(`/applications/${existingApplicationId}`)}
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
          {existingStatus === "applied" ? "Applied" : "Tracking"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          disabled={loading}
          onClick={remove}
          title="Remove application"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <X className="h-3 w-3" />
          )}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs"
        disabled={loading}
        onClick={() => track("applied")}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5" />
        )}
        Applied
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs"
        disabled={loading}
        onClick={() => track("saved")}
      >
        <Bookmark className="h-3.5 w-3.5" />
        Save
      </Button>
    </div>
  )
}
