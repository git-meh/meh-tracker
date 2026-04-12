"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import type { AutomationPreference } from "@/lib/db/schema"
import { COUNTRY_OPTIONS } from "@/lib/visa-platform/countries"

const SOURCE_TYPE_OPTIONS = [
  { value: "approved_feed", label: "Approved feeds" },
  { value: "employer_site", label: "Employer sites" },
  { value: "ats", label: "ATS" },
  { value: "manual", label: "Manual jobs" },
]

interface AutomationPreferencesFormProps {
  preferences: AutomationPreference | null
  executorConfigured: boolean
  notificationWebhookConfigured: boolean
}

export function AutomationPreferencesForm({
  preferences,
  executorConfigured,
  notificationWebhookConfigured,
}: AutomationPreferencesFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(formData: FormData) {
    const payload = {
      reviewRequired: formData.get("reviewRequired") === "on",
      autoSubmitEnabled: formData.get("autoSubmitEnabled") === "on",
      allowedSourceTypes: formData.getAll("allowedSourceTypes"),
      supportedCountries: formData.getAll("supportedCountries"),
      emailNotificationsEnabled:
        formData.get("emailNotificationsEnabled") === "on",
      dailyDigestEnabled: formData.get("dailyDigestEnabled") === "on",
      instantUpdatesEnabled: formData.get("instantUpdatesEnabled") === "on",
    }

    startTransition(async () => {
      setError(null)
      const response = await fetch("/api/automation-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Save failed" }))
        setError(data.error?.formErrors?.[0] ?? data.error ?? "Save failed")
        return
      }

      router.refresh()
    })
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="rounded-lg border bg-muted/20 p-4 text-sm">
        <p className="font-medium">Beta Runtime Status</p>
        <div className="mt-2 space-y-1 text-muted-foreground">
          <p>
            Auto-submit executor: {executorConfigured ? "configured" : "manual-only in this environment"}
          </p>
          <p>
            Notification delivery: {notificationWebhookConfigured ? "configured" : "events will be queued until a delivery webhook is configured"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Allowed Source Types
          </label>
          <div className="space-y-2 rounded-md border p-3">
            {SOURCE_TYPE_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="allowedSourceTypes"
                  value={option.value}
                  defaultChecked={
                    preferences?.allowedSourceTypes.includes(option.value) ??
                    ["approved_feed", "employer_site", "ats"].includes(option.value)
                  }
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="supportedCountries">
            Automation Countries
          </label>
          <select
            id="supportedCountries"
            name="supportedCountries"
            defaultValue={preferences?.supportedCountries ?? []}
            multiple
            className="min-h-36 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {COUNTRY_OPTIONS.map((country) => (
              <option key={country.code} value={country.code}>
                {country.label} ({country.code})
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Leave this empty to allow any supported country. Hold Command or Ctrl to select more than one.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
          <input
            type="checkbox"
            name="reviewRequired"
            defaultChecked={preferences?.reviewRequired ?? true}
          />
          Review each draft before submission
        </label>
        <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
          <input
            type="checkbox"
            name="autoSubmitEnabled"
            defaultChecked={preferences?.autoSubmitEnabled ?? false}
          />
          Opt into supported auto-submit flows (beta)
        </label>
        <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
          <input
            type="checkbox"
            name="emailNotificationsEnabled"
            defaultChecked={preferences?.emailNotificationsEnabled ?? true}
          />
          Email notifications enabled
        </label>
        <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
          <input
            type="checkbox"
            name="dailyDigestEnabled"
            defaultChecked={preferences?.dailyDigestEnabled ?? true}
          />
          Daily new-job digests enabled
        </label>
        <label className="flex items-center gap-2 rounded-md border p-3 text-sm md:col-span-2">
          <input
            type="checkbox"
            name="instantUpdatesEnabled"
            defaultChecked={preferences?.instantUpdatesEnabled ?? true}
          />
          Immediate updates for draft-ready, submission, and status-change events
        </label>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Save Automation Settings"}
      </Button>
    </form>
  )
}
