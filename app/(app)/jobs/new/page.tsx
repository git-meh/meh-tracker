"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { ChevronDown, ChevronUp } from "lucide-react"

export default function NewJobPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const form = new FormData(e.currentTarget)
    const tagsRaw = form.get("tags") as string
    const tags = tagsRaw
      ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
      : []

    const iAmApplying = form.get("iAmApplying") === "on"

    const body = {
      url: form.get("url"),
      title: form.get("title") || undefined,
      company: form.get("company") || undefined,
      description: form.get("description") || undefined,
      salaryRange: form.get("salaryRange") || undefined,
      location: form.get("location") || undefined,
      tags,
    }

    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? "Failed to post job")
      setLoading(false)
      return
    }

    const job = await res.json()

    if (iAmApplying) {
      // Create application and redirect to it
      const appRes = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, status: "applied" }),
      })
      if (appRes.ok) {
        const app = await appRes.json()
        router.push(`/applications/${app.id}`)
        return
      }
    }

    router.push(`/jobs/${job.id}`)
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Post a Job</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Just a link is enough - add details whenever you have them.
      </p>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Required */}
            <div className="space-y-2">
              <Label htmlFor="url">
                Job URL <span className="text-destructive">*</span>
              </Label>
              <Input
                id="url"
                name="url"
                type="url"
                placeholder="https://jobs.example.com/role/123"
                required
                autoFocus
              />
            </div>

            {/* Optional details toggle */}
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showDetails ? "Hide details" : "Add details (optional)"}
            </button>

            {showDetails && (
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Job Title</Label>
                    <Input id="title" name="title" placeholder="Software Engineer" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">Company</Label>
                    <Input id="company" name="company" placeholder="Acme Corp" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input id="location" name="location" placeholder="Remote / London" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="salaryRange">Salary Range</Label>
                    <Input id="salaryRange" name="salaryRange" placeholder="£60k – £80k" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tags">Tags</Label>
                  <Input id="tags" name="tags" placeholder="React, TypeScript, Remote (comma-separated)" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Notes</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Anything worth noting about this role..."
                    rows={3}
                  />
                </div>
              </div>
            )}

            {/* I'm applying checkbox */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="iAmApplying"
                name="iAmApplying"
                className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
              />
              <label htmlFor="iAmApplying" className="text-sm cursor-pointer select-none">
                I&apos;m applying to this job
              </label>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-3 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Posting..." : "Post Job"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
