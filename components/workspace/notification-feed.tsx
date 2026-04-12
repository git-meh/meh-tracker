import { Badge } from "@/components/ui/badge"
import type { NotificationEvent } from "@/lib/db/schema"

interface NotificationFeedProps {
  events: NotificationEvent[]
}

const STATUS_VARIANTS: Record<
  NotificationEvent["status"],
  "secondary" | "warning" | "success" | "destructive"
> = {
  pending: "warning",
  sent: "success",
  failed: "destructive",
  skipped: "secondary",
}

const STATUS_LABELS: Record<NotificationEvent["status"], string> = {
  pending: "Queued",
  sent: "Sent",
  failed: "Failed",
  skipped: "Skipped",
}

export function NotificationFeed({ events }: NotificationFeedProps) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No notification events yet.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {events.map((event) => (
        <div
          key={event.id}
          className="rounded-lg border bg-background p-4"
        >
          <div className="flex items-center justify-between gap-4">
            <p className="font-medium">{event.subject}</p>
            <Badge variant={STATUS_VARIANTS[event.status]}>{STATUS_LABELS[event.status]}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{event.body}</p>
        </div>
      ))}
    </div>
  )
}
