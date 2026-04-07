import { Badge } from "@/components/ui/badge"
import type { Availability } from "@/lib/db/schema"

const config: Record<Availability, { label: string; variant: "success" | "destructive" | "secondary" }> = {
  open: { label: "Open", variant: "success" },
  closed: { label: "Closed", variant: "destructive" },
  unknown: { label: "Unknown", variant: "secondary" },
}

export function AvailabilityBadge({ availability }: { availability: Availability }) {
  const { label, variant } = config[availability]
  return <Badge variant={variant}>{label}</Badge>
}
