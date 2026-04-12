"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"

interface GenerateDraftButtonProps {
  jobId: string
  draftId?: string | null
}

export function GenerateDraftButton({
  jobId,
  draftId,
}: GenerateDraftButtonProps) {
  const router = useRouter()
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function generateDraft() {
    if (draftId) {
      router.push(`/matches/${draftId}`)
      return
    }

    startTransition(async () => {
      setMessage(null)
      const response = await fetch("/api/application-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      })

      const data = await response.json().catch(() => ({ error: "Draft generation failed" }))
      if (!response.ok) {
        setMessage(data.error ?? "Draft generation failed")
        return
      }

      if (data.reviewUrl) {
        router.push(data.reviewUrl)
        return
      }

      setMessage("Draft ready for review.")
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant={draftId ? "secondary" : "default"}
        size="sm"
        disabled={isPending}
        onClick={generateDraft}
      >
        {isPending ? "Generating..." : draftId ? "Review Draft" : "Generate Draft"}
      </Button>
      {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
    </div>
  )
}
