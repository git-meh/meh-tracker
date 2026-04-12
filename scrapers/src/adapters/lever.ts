/**
 * Lever ATS scraper.
 *
 * Public JSON API — no key required:
 *   GET https://api.lever.co/v0/postings/{slug}?mode=json
 *
 * Returns a JSON array of postings.
 * - Empty array [] = valid slug, no current open roles
 * - 404 = slug does not exist on Lever
 *
 * Verified fields from Lever API documentation:
 * {
 *   id: string (UUID)
 *   text: string (job title)
 *   hostedUrl: string
 *   applyUrl: string
 *   categories: { commitment, department, location, team }
 *   description: string (HTML)
 *   descriptionPlain: string
 *   lists: Array<{ text, content }>
 *   additional: string (HTML)
 *   additionalPlain: string
 *   createdAt: number (ms timestamp)
 *   salaryRange?: { currency, interval, min, max }
 * }
 */

import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"
import { fetchJson, NotFoundError, BlockedError, sleep } from "../lib/fetch.js"
import { detectSponsorshipStatus } from "../lib/visa-detect.js"
import {
  stripHtml,
  detectWorkMode,
  normalizeEmploymentType,
  resolveCountryMetadata,
  type IngestibleJob,
} from "../lib/normalizer.js"
import { pushJobs } from "../lib/pusher.js"

const __dirname = dirname(fileURLToPath(import.meta.url))

type LeverSalaryRange = {
  currency?: string
  interval?: string
  min?: number
  max?: number
}

type LeverPosting = {
  id: string
  text: string
  hostedUrl: string
  applyUrl: string
  categories: {
    commitment?: string
    department?: string
    location?: string
    team?: string
  }
  description: string
  descriptionPlain?: string
  lists?: Array<{ text: string; content: string }>
  additional?: string
  additionalPlain?: string
  createdAt: number
  salaryRange?: LeverSalaryRange
}

function normaliseJob(posting: LeverPosting, slug: string): IngestibleJob {
  const rawDescription = posting.descriptionPlain || stripHtml(posting.description ?? "")
  const additionalText = posting.additionalPlain || stripHtml(posting.additional ?? "")
  const fullDescription = [rawDescription, additionalText].filter(Boolean).join("\n\n")

  const location = posting.categories?.location ?? null
  const { countryCode, countryConfidence } = resolveCountryMetadata({ location })
  const workMode = detectWorkMode(location, fullDescription)
  const visaSponsorshipStatus = detectSponsorshipStatus(fullDescription)
  const employmentType = normalizeEmploymentType(posting.categories?.commitment)

  const tags: string[] = []
  if (posting.categories?.department) tags.push(posting.categories.department)
  if (posting.categories?.team) tags.push(posting.categories.team)

  let salaryMin: number | null = null
  let salaryMax: number | null = null
  let currency = "GBP"

  if (posting.salaryRange) {
    salaryMin = posting.salaryRange.min ?? null
    salaryMax = posting.salaryRange.max ?? null
    currency = posting.salaryRange.currency ?? "GBP"
  }

  return {
    url: posting.hostedUrl,
    title: posting.text,
    company:
      posting.categories?.team ??
      slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    description: fullDescription || null,
    salaryMin,
    salaryMax,
    currency,
    location,
    countryCode,
    countryConfidence,
    tags,
    eligibleCountries: countryCode ? [countryCode] : [],
    sourceType: "ats",
    sourceKey: "lever",
    sourceJobId: posting.id,
    applyAdapter: "lever",
    visaSponsorshipStatus,
    workMode,
    employmentType,
  }
}

export async function scrapeLever(slugs: string[]): Promise<IngestibleJob[]> {
  const all: IngestibleJob[] = []

  for (const slug of slugs) {
    try {
      console.log(`[lever] Fetching ${slug}...`)
      const postings = await fetchJson<LeverPosting[]>(
        `https://api.lever.co/v0/postings/${slug}?mode=json`,
        { minDelayMs: 800, maxDelayMs: 2000 }
      )

      // Empty array = valid slug but no open roles right now
      if (!Array.isArray(postings) || postings.length === 0) {
        console.log(`[lever] ${slug}: no open roles`)
        continue
      }

      console.log(`[lever] ${slug}: ${postings.length} postings`)

      for (const posting of postings) {
        all.push(normaliseJob(posting, slug))
      }
    } catch (err) {
      if (err instanceof NotFoundError) {
        console.warn(`[lever] ${slug}: not found on Lever — remove from list`)
      } else if (err instanceof BlockedError) {
        console.warn(`[lever] ${slug}: blocked`)
      } else {
        console.error(`[lever] ${slug}:`, err)
      }
    }

    await sleep(500)
  }

  return all
}

// Run directly: npx tsx src/adapters/lever.ts
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const listPath = join(__dirname, "../company-list/lever.json")
  const slugs: string[] = JSON.parse(readFileSync(listPath, "utf-8"))
  console.log(`[lever] Running against ${slugs.length} company slugs`)

  scrapeLever(slugs)
    .then((jobs) => pushJobs(jobs, { label: "lever" }))
    .catch(console.error)
}
