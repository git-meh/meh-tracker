"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { SavedSearchFilters } from "@/lib/db/schema"

interface SaveSearchButtonProps {
  query: string
  filters: SavedSearchFilters
}

export function SaveSearchButton({
  query,
  filters,
}: SaveSearchButtonProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState("")
  const [emailDaily, setEmailDaily] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function saveSearch() {
    startTransition(async () => {
      setError(null)
      const response = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          query: query || null,
          filters,
          emailDaily,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Save failed" }))
        setError(data.error?.formErrors?.[0] ?? data.error ?? "Save failed")
        return
      }

      setIsOpen(false)
      setName("")
      setEmailDaily(true)
      router.refresh()
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Save Search
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save Search</DialogTitle>
          <DialogDescription>
            Save the current filters and optionally include it in the daily digest.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="savedSearchName">
              Search Name
            </label>
            <Input
              id="savedSearchName"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="UK visa-friendly backend roles"
            />
          </div>

          <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
            <input
              type="checkbox"
              checked={emailDaily}
              onChange={(event) => setEmailDaily(event.target.checked)}
            />
            Include this search in the daily digest
          </label>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isPending || !name.trim()}
            onClick={saveSearch}
          >
            {isPending ? "Saving..." : "Save Search"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
