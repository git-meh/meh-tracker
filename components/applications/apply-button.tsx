"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export function ApplyButton({ jobId }: { jobId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleApply() {
    setLoading(true)
    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, status: "saved" }),
    })

    if (res.ok) {
      const app = await res.json()
      router.push(`/applications/${app.id}`)
    } else {
      setLoading(false)
    }
  }

  return (
    <Button onClick={handleApply} disabled={loading}>
      {loading ? "Saving..." : "Track Application"}
    </Button>
  )
}
