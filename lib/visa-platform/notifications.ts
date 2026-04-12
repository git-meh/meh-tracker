import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  automationPreferences,
  notificationEvents,
  type NotificationEvent,
  type NotificationStatus,
  type NotificationType,
} from "@/lib/db/schema"

function getNotificationPreferenceState(
  type: NotificationType,
  preferences:
    | {
        emailNotificationsEnabled: boolean
        dailyDigestEnabled: boolean
        instantUpdatesEnabled: boolean
      }
    | null
) {
  if (!preferences) {
    return { allowed: true, reason: null as string | null }
  }

  if (!preferences.emailNotificationsEnabled) {
    return {
      allowed: false,
      reason: "Email notifications are disabled in workspace settings.",
    }
  }

  if (type === "daily_digest" && !preferences.dailyDigestEnabled) {
    return {
      allowed: false,
      reason: "Daily digest notifications are disabled in workspace settings.",
    }
  }

  if (type !== "daily_digest" && !preferences.instantUpdatesEnabled) {
    return {
      allowed: false,
      reason: "Instant notification updates are disabled in workspace settings.",
    }
  }

  return { allowed: true, reason: null as string | null }
}

export async function createNotificationEvent(input: {
  userId: string
  type: NotificationType
  subject: string
  body: string
  jobId?: string | null
  applicationId?: string | null
  draftId?: string | null
}) {
  const [preferences] = await db
    .select({
      emailNotificationsEnabled: automationPreferences.emailNotificationsEnabled,
      dailyDigestEnabled: automationPreferences.dailyDigestEnabled,
      instantUpdatesEnabled: automationPreferences.instantUpdatesEnabled,
    })
    .from(automationPreferences)
    .where(eq(automationPreferences.userId, input.userId))
    .limit(1)

  const preferenceState = getNotificationPreferenceState(
    input.type,
    preferences ?? null
  )
  const webhookConfigured = Boolean(process.env.NOTIFICATION_WEBHOOK_URL)
  const initialStatus: NotificationStatus = preferenceState.allowed
    ? "pending"
    : "skipped"

  const [event] = await db
    .insert(notificationEvents)
    .values({
      userId: input.userId,
      type: input.type,
      subject: input.subject,
      jobId: input.jobId ?? null,
      applicationId: input.applicationId ?? null,
      draftId: input.draftId ?? null,
      status: initialStatus,
      body: preferenceState.allowed
        ? input.body
        : `${input.body}\n\nDelivery skipped: ${preferenceState.reason}`,
    })
    .returning()

  if (!preferenceState.allowed || !webhookConfigured) {
    return event
  }

  return dispatchNotificationEvent(event)
}

export async function dispatchNotificationEvent(
  event: NotificationEvent
): Promise<NotificationEvent> {
  const webhookUrl = process.env.NOTIFICATION_WEBHOOK_URL

  if (!webhookUrl) {
    return event
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    })

    const status: NotificationStatus = response.ok ? "sent" : "failed"
    const [updated] = await db
      .update(notificationEvents)
      .set({
        status,
        sentAt: response.ok ? new Date() : null,
      })
      .where(eq(notificationEvents.id, event.id))
      .returning()

    return updated
  } catch {
    const [updated] = await db
      .update(notificationEvents)
      .set({ status: "failed" })
      .where(eq(notificationEvents.id, event.id))
      .returning()

    return updated
  }
}
