"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, Trash2 } from "lucide-react"

export function DeleteApplicationButton({ applicationId }: { applicationId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)

  async function handleDelete() {
    setLoading(true)
    const res = await fetch(`/api/applications/${applicationId}`, { method: "DELETE" })
    if (res.ok) {
      router.push("/applications")
    } else {
      setLoading(false)
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Remove this application?</span>
        <Button
          variant="destructive"
          size="sm"
          disabled={loading}
          onClick={handleDelete}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Yes, remove"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={loading}
          onClick={() => setConfirming(false)}
        >
          Cancel
        </Button>
      </div>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5 text-muted-foreground hover:text-destructive"
      onClick={() => setConfirming(true)}
    >
      <Trash2 className="h-3.5 w-3.5" />
      Remove
    </Button>
  )
}
