import type { IngestibleJob } from "./normalizer.js"
import { sleep } from "./fetch.js"
import { log } from "./log.js"

const BATCH_SIZE = 50

export async function pushJobs(
  jobs: IngestibleJob[],
  opts: { sourceId?: string; label?: string } = {}
): Promise<void> {
  const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const apiKey = process.env.JOB_INGESTION_API_KEY
  const adapter = opts.label ?? "adapter"

  if (!apiKey) {
    log.error("pusher_no_api_key", { adapter })
    throw new Error("JOB_INGESTION_API_KEY is not set")
  }

  if (jobs.length === 0) {
    log.info("pusher_no_jobs", { adapter })
    return
  }

  const totalBatches = Math.ceil(jobs.length / BATCH_SIZE)
  log.info("pusher_start", { adapter, totalJobs: jobs.length, totalBatches, batchSize: BATCH_SIZE })

  let pushed = 0
  let failed = 0
  let skipped = 0

  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batchIndex = Math.floor(i / BATCH_SIZE) + 1
    const batch = jobs.slice(i, i + BATCH_SIZE)

    try {
      const res = await fetch(`${appUrl}/api/job-sources/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-job-ingestion-key": apiKey,
        },
        body: JSON.stringify({
          jobs: batch,
          ...(opts.sourceId ? { sourceId: opts.sourceId } : {}),
        }),
      })

      if (!res.ok) {
        const body = await res.text().catch(() => "")
        log.error("pusher_batch_failed", { adapter, batchIndex, totalBatches, status: res.status, body: body.slice(0, 500) })
        failed += batch.length
      } else {
        const data = await res.json().catch(() => ({}))
        const written = Number(data.jobsInserted ?? 0) + Number(data.jobsUpdated ?? 0)
        const skippedInBatch = Number(data.jobsSkipped ?? 0)
        log.info("pusher_batch_ok", {
          adapter,
          batchIndex,
          totalBatches,
          count: batch.length,
          inserted: data.jobsInserted ?? 0,
          updated: data.jobsUpdated ?? 0,
          skipped: skippedInBatch,
        })
        pushed += written
        skipped += skippedInBatch
      }
    } catch (err) {
      log.error("pusher_batch_error", { adapter, batchIndex, error: String(err) })
      failed += batch.length
    }

    if (i + BATCH_SIZE < jobs.length) {
      await sleep(500)
    }
  }

  log.info("pusher_done", { adapter, pushed, skipped, failed, total: jobs.length })
}
