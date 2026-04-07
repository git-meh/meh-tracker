"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

interface GroupFeedRealtimeProps {
  userId: string
}

/**
 * Invisible component that subscribes to Supabase Realtime and
 * triggers a router refresh when group members update their applications.
 */
export function GroupFeedRealtime({ userId }: GroupFeedRealtimeProps) {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel("group-feed")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "application_status_history",
        },
        (payload) => {
          // Only refresh if someone else changed their status
          if (payload.new?.changed_by !== userId) {
            router.refresh()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, router, supabase])

  return null
}
