"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Copy, Check, PlusCircle } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import type { Invite } from "@/lib/db/schema"

interface InviteManagerProps {
  initialInvites: Invite[]
}

export function InviteManager({ initialInvites }: InviteManagerProps) {
  const [invites, setInvites] = useState(initialInvites)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  async function handleGenerate() {
    setLoading(true)
    const res = await fetch("/api/invites", { method: "POST", body: JSON.stringify({}) })
    const data = await res.json()
    if (res.ok) {
      setInvites((prev) => [data, ...prev])
    }
    setLoading(false)
  }

  async function handleCopy(code: string) {
    const url = `${window.location.origin}/invite/${code}`
    await navigator.clipboard.writeText(url)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  const activeInvites = invites.filter((i) => !i.usedBy)

  return (
    <div className="space-y-4">
      <Button onClick={handleGenerate} disabled={loading} size="sm" variant="outline">
        <PlusCircle className="h-4 w-4 mr-2" />
        {loading ? "Generating..." : "Generate Invite Link"}
      </Button>

      {activeInvites.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active invites.</p>
      ) : (
        <div className="space-y-2">
          {activeInvites.map((invite) => (
            <div
              key={invite.id}
              className="flex items-center justify-between rounded-md border p-3 text-sm"
            >
              <div>
                <code className="text-xs bg-muted px-1 py-0.5 rounded">{invite.code}</code>
                {invite.expiresAt && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Expires {formatDistanceToNow(new Date(invite.expiresAt), { addSuffix: true })}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(invite.code)}
              >
                {copied === invite.code ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
