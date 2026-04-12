"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"

export function RefreshMatchesButton() {
  const router = useRouter()
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function refreshMatches() {
    startTransition(async () => {
      setMessage(null)
      const response = await fetch("/api/matches/refresh", { method: "POST" })
      const data = await response.json().catch(() => ({ refreshed: 0 }))
      if (!response.ok) {
        setMessage(data.error ?? "Could not refresh matches.")
        return
      }

      setMessage(`Refreshed ${data.refreshed} match${data.refreshed === 1 ? "" : "es"}.`)
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-3">
      <Button onClick={refreshMatches} disabled={isPending}>
        {isPending ? "Refreshing..." : "Refresh Matches"}
      </Button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  )
}
