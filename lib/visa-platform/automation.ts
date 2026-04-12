import { eq, desc } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  applicationRuns,
  applications,
  type Application,
  type ApplicationDraft,
  type AutomationPreference,
  type Job,
} from "@/lib/db/schema"
import { AUTO_SUBMIT_ELIGIBLE_ADAPTERS } from "@/lib/visa-platform/constants"

export function getAutomationEligibility(
  job: Pick<Job, "sourceType" | "applyAdapter" | "countryCode">,
  preferences: AutomationPreference | null
) {
  const reviewRequired = preferences?.reviewRequired ?? true
  const autoSubmitEnabled = preferences?.autoSubmitEnabled ?? false
  const sourceAllowed =
    !preferences?.allowedSourceTypes?.length ||
    preferences.allowedSourceTypes.includes(job.sourceType)
  const countryAllowed =
    !preferences?.supportedCountries?.length ||
    (job.countryCode !== null &&
      preferences.supportedCountries.includes(job.countryCode))
  const adapterAllowed = AUTO_SUBMIT_ELIGIBLE_ADAPTERS.includes(job.applyAdapter)

  const eligible = autoSubmitEnabled && sourceAllowed && countryAllowed && adapterAllowed

  if (!autoSubmitEnabled) {
    return {
      eligible: false,
      mode: reviewRequired ? "review_required" : "manual",
      reason: "Auto-submit is disabled for this user",
    }
  }

  if (!sourceAllowed) {
    return {
      eligible: false,
      mode: "review_required",
      reason: "Source type is excluded from automation preferences",
    }
  }

  if (!countryAllowed) {
    return {
      eligible: false,
      mode: "review_required",
      reason: "Country is outside the automation coverage list",
    }
  }

  if (!adapterAllowed) {
    return {
      eligible: false,
      mode: "review_required",
      reason: "Job adapter is not in the supported automation set",
    }
  }

  return {
    eligible,
    mode: eligible ? "auto_submit" : "review_required",
    reason: eligible ? "Eligible for executor handoff" : "Requires review",
  }
}

type ExecutorPayload = {
  applicationId: string
  draftId: string
  applyUrl: string
  adapter: string
  company: string
  title: string
}

export async function executeApplicationRun({
  application,
  draft,
  job,
  preferences,
}: {
  application: Application
  draft: ApplicationDraft
  job: Pick<Job, "id" | "url" | "company" | "title" | "applyAdapter" | "sourceType" | "countryCode">
  preferences: AutomationPreference | null
}) {
  const eligibility = getAutomationEligibility(job, preferences)
  const previousRuns = await db
    .select()
    .from(applicationRuns)
    .where(eq(applicationRuns.applicationId, application.id))
    .orderBy(desc(applicationRuns.createdAt))

  const attemptNumber = (previousRuns[0]?.attemptNumber ?? 0) + 1
  const now = new Date()

  const [run] = await db
    .insert(applicationRuns)
    .values({
      userId: application.userId,
      applicationId: application.id,
      draftId: draft.id,
      status: eligibility.eligible ? "queued" : "manual_required",
      mode: eligibility.mode,
      adapter: job.applyAdapter,
      attemptNumber,
      log: eligibility.reason,
      externalUrl: job.url,
      startedAt: now,
      finishedAt: eligibility.eligible ? null : now,
    })
    .returning()

  await db
    .update(applications)
    .set({
      automationMode: eligibility.mode,
      submissionAttempts: attemptNumber,
      lastSubmissionAt: now,
      updatedAt: now,
    })
    .where(eq(applications.id, application.id))

  if (!eligibility.eligible) {
    return {
      run: {
        ...run,
        status: "manual_required" as const,
      },
      result: {
        status: "manual_required" as const,
        log: eligibility.reason,
      },
    }
  }

  const executorUrl = process.env.AUTOMATION_EXECUTOR_WEBHOOK_URL
  if (!executorUrl) {
    await db
      .update(applicationRuns)
      .set({
        status: "manual_required",
        log: "Executor webhook is not configured in this environment.",
        finishedAt: new Date(),
      })
      .where(eq(applicationRuns.id, run.id))

    return {
      run: {
        ...run,
        status: "manual_required" as const,
      },
      result: {
        status: "manual_required" as const,
        log: "Executor webhook is not configured in this environment.",
      },
    }
  }

  const payload: ExecutorPayload = {
    applicationId: application.id,
    draftId: draft.id,
    applyUrl: job.url,
    adapter: job.applyAdapter,
    company: job.company,
    title: job.title,
  }

  try {
    const response = await fetch(executorUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    const result = (await response.json().catch(() => ({}))) as {
      status?: "queued" | "submitted" | "failed"
      externalApplicationId?: string
      confirmationUrl?: string
      log?: string
      error?: string
    }

    const status =
      response.ok && (result.status === "submitted" || result.status === "queued")
        ? result.status
        : "failed"

    const finishTime = new Date()

    await db
      .update(applicationRuns)
      .set({
        status,
        log: result.log ?? null,
        error: status === "failed" ? result.error ?? "Executor rejected the request." : null,
        finishedAt: finishTime,
        externalUrl: result.confirmationUrl ?? job.url,
      })
      .where(eq(applicationRuns.id, run.id))

    if (status === "submitted") {
      await db
        .update(applications)
        .set({
          status: "applied",
          appliedAt: finishTime,
          externalApplicationId: result.externalApplicationId ?? null,
          externalConfirmationUrl: result.confirmationUrl ?? null,
          updatedAt: finishTime,
        })
        .where(eq(applications.id, application.id))
    }

    return {
      run: {
        ...run,
        status,
      },
      result: {
        status,
        log: result.log ?? null,
        externalApplicationId: result.externalApplicationId ?? null,
        confirmationUrl: result.confirmationUrl ?? null,
        error: status === "failed" ? result.error ?? "Executor rejected the request." : null,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Executor call failed"
    await db
      .update(applicationRuns)
      .set({
        status: "failed",
        error: message,
        finishedAt: new Date(),
      })
      .where(eq(applicationRuns.id, run.id))

    return {
      run: {
        ...run,
        status: "failed" as const,
      },
      result: {
        status: "failed" as const,
        error: message,
      },
    }
  }
}
