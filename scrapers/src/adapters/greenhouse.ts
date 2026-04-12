/**
 * Greenhouse ATS scraper.
 *
 * Public JSON API — no key required:
 *   GET https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true
 *
 * Confirmed response shape (verified 2026-04-11 against monzo, skyscanner):
 *   { jobs: [ { id, title, company_name, absolute_url, location, offices, departments, metadata, content, first_published, updated_at } ] }
 *
 * No pagination — all jobs returned in one call.
 * absolute_url format: https://job-boards.greenhouse.io/{company}/jobs/{id}
 */

import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"
import { fetchJson, NotFoundError, BlockedError } from "../lib/fetch.js"
import { detectSponsorshipStatus } from "../lib/visa-detect.js"
import {
  stripHtml,
  detectWorkMode,
  normalizeEmploymentType,
  resolveCountryMetadata,
  type IngestibleJob,
} from "../lib/normalizer.js"
import { pushJobs } from "../lib/pusher.js"
import { sleep } from "../lib/fetch.js"

const __dirname = dirname(fileURLToPath(import.meta.url))

type GreenhouseJob = {
  id: number
  internal_job_id: number
  title: string
  company_name: string
  absolute_url: string
  location: { name: string }
  offices: Array<{ id: number; name: string; location: string }>
  departments: Array<{ id: number; name: string }>
  metadata: null | Array<{ id: number; name: string; value: string; value_type: string }>
  content: string | null
  first_published: string
  updated_at: string
  language: string
}

type GreenhouseResponse = {
  jobs: GreenhouseJob[]
}

function normaliseJob(job: GreenhouseJob): IngestibleJob {
  const description = job.content ? stripHtml(job.content) : null
  const location = job.location?.name ?? null
  const { countryCode, countryConfidence } = resolveCountryMetadata({ location })
  const workMode = detectWorkMode(location, description)
  const visaSponsorshipStatus = detectSponsorshipStatus(description ?? "")

  const tags: string[] = []
  if (job.departments?.[0]?.name) tags.push(job.departments[0].name)

  // Try extracting employment type from metadata if present
  let employmentType: IngestibleJob["employmentType"] = "unknown"
  if (Array.isArray(job.metadata)) {
    const typeMeta = job.metadata.find(
      (m) => m.name.toLowerCase().includes("type") || m.name.toLowerCase().includes("commitment")
    )
    if (typeMeta?.value) {
      employmentType = normalizeEmploymentType(typeMeta.value)
    }
  }

  return {
    url: job.absolute_url,
    title: job.title,
    company: job.company_name,
    description,
    currency: "GBP",
    location,
    countryCode,
    countryConfidence,
    tags,
    eligibleCountries: countryCode ? [countryCode] : [],
    sourceType: "ats",
    sourceKey: "greenhouse",
    sourceJobId: String(job.id),
    applyAdapter: "greenhouse",
    visaSponsorshipStatus,
    workMode,
    employmentType,
  }
}

export async function scrapeGreenhouse(slugs: string[]): Promise<IngestibleJob[]> {
  const all: IngestibleJob[] = []

  for (const slug of slugs) {
    try {
      console.log(`[greenhouse] Fetching ${slug}...`)
      const data = await fetchJson<GreenhouseResponse>(
        `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`,
        { minDelayMs: 800, maxDelayMs: 2000 }
      )

      const jobs = data.jobs ?? []
      console.log(`[greenhouse] ${slug}: ${jobs.length} jobs`)

      for (const job of jobs) {
        all.push(normaliseJob(job))
      }
    } catch (err) {
      if (err instanceof NotFoundError) {
        console.warn(`[greenhouse] ${slug}: slug not found — skipping`)
      } else if (err instanceof BlockedError) {
        console.warn(`[greenhouse] ${slug}: blocked — skipping`)
      } else {
        console.error(`[greenhouse] ${slug}: unexpected error:`, err)
      }
    }

    await sleep(500)
  }

  return all
}

// Run directly: npx tsx src/adapters/greenhouse.ts
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const listPath = join(__dirname, "../company-list/greenhouse.json")
  const slugs: string[] = JSON.parse(readFileSync(listPath, "utf-8"))
  console.log(`[greenhouse] Running against ${slugs.length} company slugs`)

  scrapeGreenhouse(slugs)
    .then((jobs) => pushJobs(jobs, { label: "greenhouse" }))
    .catch(console.error)
}
