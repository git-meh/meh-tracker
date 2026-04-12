"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import type { SavedSearch } from "@/lib/db/schema"

interface SavedSearchesListProps {
  searches: SavedSearch[]
}

export function SavedSearchesList({ searches }: SavedSearchesListProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function removeSearch(id: string) {
    startTransition(async () => {
      await fetch(`/api/saved-searches/${id}`, { method: "DELETE" })
      router.refresh()
    })
  }

  if (searches.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No saved searches yet. Save a search from the discovery page to start daily digests.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {searches.map((search) => (
        <div
          key={search.id}
          className="flex items-start justify-between gap-4 rounded-lg border bg-background p-4"
        >
          <div className="space-y-1">
            <p className="font-medium">{search.name}</p>
            <p className="text-sm text-muted-foreground">
              Query: {search.query || "None"} · Daily digest: {search.emailDaily ? "On" : "Off"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => removeSearch(search.id)}
          >
            Remove
          </Button>
        </div>
      ))}
    </div>
  )
}
