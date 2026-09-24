"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, PlusCircle, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Invite } from "@/lib/db/schema";
import {
  getInviteLifecycleStatus,
  type InviteLifecycleStatus
} from "@/lib/invites";

interface InviteManagerProps {
  initialInvites: Invite[];
}

const statusBadgeVariants: Record<
  InviteLifecycleStatus,
  "success" | "destructive" | "secondary"
> = {
  active: "success",
  expired: "destructive",
  used: "secondary"
};

function formatInviteTiming(invite: Invite, status: InviteLifecycleStatus) {
  if (status === "used") {
    return invite.usedAt
      ? `Used ${formatDistanceToNow(new Date(invite.usedAt), { addSuffix: true })}`
      : "Used";
  }

  if (!invite.expiresAt) return "No expiry date";

  const relativeTime = formatDistanceToNow(new Date(invite.expiresAt), {
    addSuffix: true
  });
  return status === "expired"
    ? `Expired ${relativeTime}`
    : `Expires ${relativeTime}`;
}

export function InviteManager({ initialInvites }: InviteManagerProps) {
  const [invites, setInvites] = useState(initialInvites);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [deletingInviteId, setDeletingInviteId] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setInviteError(null);

    try {
      const response = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to generate invite");
      }

      setInvites((prev) => [data, ...prev]);
    } catch (error) {
      setInviteError(
        error instanceof Error ? error.message : "Unable to generate invite"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy(code: string) {
    const url = `${window.location.origin}/invite/${code}`;
    await navigator.clipboard.writeText(url);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }

  async function deleteInvite(id: string) {
    setDeletingInviteId(id);
    setInviteError(null);

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
      setInviteError(
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

      {invites.length === 0 ? (
        <p className="text-sm text-muted-foreground">No invites yet.</p>
      ) : (
        <div className="space-y-2">
          {invites.map((invite) => {
            const status = getInviteLifecycleStatus(invite);

            return (
              <div
                key={invite.id}
                className="flex items-center justify-between rounded-md border p-3 text-sm"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded bg-muted px-1 py-0.5 text-xs">
                      {invite.code}
                    </code>
                    <Badge variant={statusBadgeVariants[status]}>
                      {status === "active"
                        ? "Active"
                        : status === "expired"
                          ? "Expired"
                          : "Used"}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatInviteTiming(invite, status)}
                  </p>
                </div>
                <div className="flex items-center">
                  {status === "active" && (
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
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteInvite(invite.id)}
                    disabled={deletingInviteId !== null}
                    aria-label={`Delete ${status} invite`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {inviteError && (
        <p role="alert" className="text-sm text-destructive">
          {inviteError}
        </p>
      )}
    </div>
  );
}
