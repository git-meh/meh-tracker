"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, PlusCircle, Trash2 } from "lucide-react";
import { formatDistanceToNow, isPast } from "date-fns";
import type { Invite } from "@/lib/db/schema";

interface InviteManagerProps {
  initialInvites: Invite[];
}

function formatInviteExpiry(expiresAt: Date | string) {
  const expiryDate = new Date(expiresAt);
  const relativeTime = formatDistanceToNow(expiryDate, { addSuffix: true });

  return isPast(expiryDate)
    ? `Expired ${relativeTime}`
    : `Expires ${relativeTime}`;
}

export function InviteManager({ initialInvites }: InviteManagerProps) {
  const [invites, setInvites] = useState(initialInvites);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [deletingInviteId, setDeletingInviteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    const res = await fetch("/api/invites", {
      method: "POST",
      body: JSON.stringify({})
    });
    const data = await res.json();
    if (res.ok) {
      setInvites((prev) => [data, ...prev]);
    }
    setLoading(false);
  }

  async function handleCopy(code: string) {
    const url = `${window.location.origin}/invite/${code}`;
    await navigator.clipboard.writeText(url);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }

  const activeInvites = invites.filter((i) => !i.usedBy);

  async function deleteInvite(id: string) {
    setDeletingInviteId(id);
    setDeleteError(null);

    try {
      const response = await fetch("/api/invites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Unable to delete invite");
      }

      setInvites((currentInvites) =>
        currentInvites.filter((invite) => invite.id !== id)
      );
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Unable to delete invite"
      );
    } finally {
      setDeletingInviteId(null);
    }
  }

  return (
    <div className="space-y-4">
      <Button
        onClick={handleGenerate}
        disabled={loading}
        size="sm"
        variant="outline"
      >
        <PlusCircle className="mr-2 h-4 w-4" />
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
                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                  {invite.code}
                </code>
                {invite.expiresAt && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatInviteExpiry(invite.expiresAt)}
                  </p>
                )}
              </div>
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(invite.code)}
                  aria-label="Copy invite link"
                >
                  {copied === invite.code ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteInvite(invite.id)}
                  disabled={deletingInviteId === invite.id}
                  aria-label="Delete invite"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteError && (
        <p role="alert" className="text-sm text-destructive">
          {deleteError}
        </p>
      )}
    </div>
  );
}
