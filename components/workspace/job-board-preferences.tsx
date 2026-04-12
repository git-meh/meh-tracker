"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { JOB_BOARDS, BOARD_SECTORS } from "@/lib/visa-platform/constants"

interface JobBoardPreferencesProps {
  currentBoards: string[]
}

export function JobBoardPreferences({ currentBoards }: JobBoardPreferencesProps) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set(currentBoards))
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function toggle(tag: string) {
    setSaved(false)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  function selectAll() {
    setSaved(false)
    setSelected(new Set(JOB_BOARDS.map((b) => b.key)))
  }

  function selectNone() {
    setSaved(false)
    setSelected(new Set())
  }

  async function save() {
    startTransition(async () => {
      setError(null)
      setSaved(false)
      const res = await fetch("/api/candidate-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredBoards: [...selected] }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? "Save failed")
        return
      }
      setSaved(true)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <p className="text-sm text-muted-foreground flex-1">
          {selected.size === 0
            ? "All boards shown (no filter active)"
            : `${selected.size} board${selected.size === 1 ? "" : "s"} selected`}
        </p>
        <button
          type="button"
          onClick={selectAll}
          className="text-xs text-primary hover:underline"
        >
          Select all
        </button>
        <button
          type="button"
          onClick={selectNone}
          className="text-xs text-muted-foreground hover:underline"
        >
          Clear
        </button>
      </div>

      {BOARD_SECTORS.map((sector) => (
        <div key={sector} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {sector}
          </p>
          <div className="flex flex-wrap gap-2">
            {JOB_BOARDS.filter((b) => b.sector === sector).map((board) => {
              const isOn = selected.has(board.key)
              return (
                <button
                  key={board.key}
                  type="button"
                  onClick={() => toggle(board.key)}
                  className="focus:outline-none"
                >
                  <Badge variant={isOn ? "default" : "outline"}>
                    {board.label}
                  </Badge>
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3 pt-2">
        <Button onClick={save} disabled={isPending} size="sm">
          {isPending ? "Saving…" : "Save Preferences"}
        </Button>
        {saved && (
          <span className="text-sm text-green-600 dark:text-green-400">Saved!</span>
        )}
        {error && (
          <span className="text-sm text-destructive">{error}</span>
        )}
      </div>

      {selected.size === 0 && (
        <p className="text-xs text-muted-foreground">
          When nothing is selected, all job boards contribute to your feed.
          Select specific boards to filter your Recommended Jobs view.
        </p>
      )}
    </div>
  )
}
