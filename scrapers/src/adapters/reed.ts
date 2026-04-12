/**
 * Reed.co.uk HTML scraper.
 *
 * Confirmed working (verified 2026-04-11):
 * - Search pages: https://www.reed.co.uk/jobs/{keyword}-jobs?datecreatedoffset=3&pageno=1
 * - Job detail pages expose full data as JSON-LD (application/ld+json)
 *
 * JSON-LD fields confirmed on job detail pages:
 * {
 *   "@type": "JobPosting",
 *   "title": string,
 *   "hiringOrganization": { "name": string },
 *   "baseSalary": { "value": { "minValue", "maxValue", "unitText" }, "currency" },
 *   "employmentType": string,
 *   "jobLocation": { "address": { "addressLocality", "addressRegion", "addressCountry" } },
 *   "datePosted": string,
 *   "validThrough": string,
 *   "description": string,
 *   "url": string
 * }
 *
 * Rate limit: 2 second delay between detail page fetches. Be polite.
 */

import { fileURLToPath } from "url"
import { fetchPage, NotFoundError, BlockedError, sleep } from "../lib/fetch.js"
import { detectSponsorshipStatus } from "../lib/visa-detect.js"
import {
  stripHtml,
  detectWorkMode,
  normalizeEmploymentType,
  resolveCountryMetadata,
  type IngestibleJob,
} from "../lib/normalizer.js"
import { pushJobs } from "../lib/pusher.js"
import { log } from "../lib/log.js"

// Reed uses hyphenated keywords in its URL paths.
// Pass your own keyword list (user-defined roles), or omit to scrape broadly.
const toReedKeyword = (term: string) => term.replace(/\s+/g, "-")

type ReedJsonLd = {
  "@type": string
  title?: string
  hiringOrganization?: { name?: string }
  baseSalary?: {
    value?: { minValue?: number; maxValue?: number; unitText?: string }
    currency?: string
  }
  employmentType?: string
  jobLocation?: {
    address?: {
      addressLocality?: string
      addressRegion?: string
      addressCountry?: string
    }
  }
  datePosted?: string
  validThrough?: string
  description?: string
  url?: string
}

function extractJsonLd(html: string): ReedJsonLd | null {
  // Find all <script type="application/ld+json"> blocks
  const matches = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]

  for (const match of matches) {
    try {
      const parsed = JSON.parse(match[1].trim())

      // Handle both direct object and @graph array
      if (parsed["@type"] === "JobPosting") return parsed as ReedJsonLd

      if (Array.isArray(parsed["@graph"])) {
        const job = parsed["@graph"].find((item: { "@type": string }) => item["@type"] === "JobPosting")
        if (job) return job as ReedJsonLd
      }
    } catch {
      // Malformed JSON-LD — skip this block
    }
  }

  return null
}

function extractJobLinks(html: string): string[] {
  // Job links on search results pages follow the pattern /jobs/{title}/{numeric-id}
  const matches = [...html.matchAll(/href="(\/jobs\/[^"]+\/\d+)"/gi)]
  const links = matches.map((m) => m[1])

  // Dedupe
  return [...new Set(links)]
}

async function scrapeJobPage(url: string): Promise<IngestibleJob | null> {
  const fullUrl = url.startsWith("http") ? url : `https://www.reed.co.uk${url}`

  const html = await fetchPage(fullUrl, { minDelayMs: 1500, maxDelayMs: 3000 })
  const jsonLd = extractJsonLd(html)

  if (!jsonLd || jsonLd["@type"] !== "JobPosting") return null

  const title = jsonLd.title ?? null
  const company = jsonLd.hiringOrganization?.name ?? null

  if (!title || !company) return null

  const rawDescription = jsonLd.description ? stripHtml(jsonLd.description) : null
  const locationParts = [
    jsonLd.jobLocation?.address?.addressLocality,
    jsonLd.jobLocation?.address?.addressRegion,
  ].filter(Boolean)
  const location = locationParts.length > 0 ? locationParts.join(", ") : null
  const { countryCode, countryConfidence } = resolveCountryMetadata({
    countryCode: jsonLd.jobLocation?.address?.addressCountry,
    location,
  })
  const workMode = detectWorkMode(location, rawDescription)
  const visaSponsorshipStatus = detectSponsorshipStatus(rawDescription ?? "")
  const employmentType = normalizeEmploymentType(jsonLd.employmentType)

  // Salary
  let salaryMin: number | null = null
  let salaryMax: number | null = null
  let salaryRange: string | null = null
  const currency = jsonLd.baseSalary?.currency ?? "GBP"

  if (jsonLd.baseSalary?.value) {
    salaryMin = jsonLd.baseSalary.value.minValue ?? null
    salaryMax = jsonLd.baseSalary.value.maxValue ?? null
    if (salaryMin || salaryMax) {
      salaryRange = [
        salaryMin ? `£${salaryMin.toLocaleString("en-GB")}` : null,
        salaryMax ? `£${salaryMax.toLocaleString("en-GB")}` : null,
      ]
        .filter(Boolean)
        .join(" - ") + " per annum"
    }
  }

  // Source job ID from URL (last numeric segment)
  const idMatch = fullUrl.match(/\/(\d+)\/?$/)
  const sourceJobId = idMatch ? idMatch[1] : null

  const closingAt = jsonLd.validThrough ? new Date(jsonLd.validThrough) : null

  return {
    url: jsonLd.url ?? fullUrl,
    title,
    company,
    description: rawDescription,
    salaryRange,
    salaryMin,
    salaryMax,
    currency,
    location,
    countryCode,
    countryConfidence,
    tags: [],
    eligibleCountries: countryCode ? [countryCode] : [],
    sourceType: "approved_feed",
    sourceKey: "reed",
    sourceJobId,
    applyAdapter: "manual_external",
    visaSponsorshipStatus,
    workMode,
    employmentType,
    closingAt,
  }
}

async function scrapeSearchTerm(keyword: string, maxPages = 5): Promise<IngestibleJob[]> {
  const jobs: IngestibleJob[] = []
  const seenLinks = new Set<string>()

  for (let page = 1; page <= maxPages; page++) {
    // When no keyword — browse all new UK jobs today
    const searchUrl = keyword
      ? `https://www.reed.co.uk/jobs/${keyword}-jobs?datecreatedoffset=3&pageno=${page}`
      : `https://www.reed.co.uk/jobs/all-jobs?datecreatedoffset=1&pageno=${page}`
    log.info("reed_search", { keyword: keyword || "(all)", page, url: searchUrl })

    let html: string
    try {
      html = await fetchPage(searchUrl, { minDelayMs: 1000, maxDelayMs: 2500 })
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof BlockedError) {
        log.warn("reed_search_stopped", { keyword, page, reason: String(err) })
        break
      }
      log.error("reed_search_error", { keyword, page, error: String(err) })
      break
    }

    const links = extractJobLinks(html).filter((link) => !seenLinks.has(link))

    if (links.length === 0) {
      log.info("reed_page_empty", { keyword, page })
      break
    }

    links.forEach((l) => seenLinks.add(l))
    log.info("reed_page_links", { keyword, page, count: links.length })

    for (const link of links) {
      try {
        const job = await scrapeJobPage(link)
        if (job) jobs.push(job)
      } catch (err) {
        if (err instanceof BlockedError) {
          log.warn("reed_blocked", { link })
          await sleep(30_000)
        } else {
          log.warn("reed_detail_error", { link, error: String(err) })
        }
      }
    }

    if (links.length < 10) break
  }

  return jobs
}

/**
 * Scrape Reed.co.uk.
 *
 * @param keywords  Optional role keywords (user-defined). When omitted, Reed is
 *                  scraped via the "new jobs today" browse page rather than
 *                  keyword search — so NO job type assumptions are baked in.
 * @param maxPagesPerKeyword  Pages per keyword (or per broad browse pass).
 */
export async function scrapeReed(
  keywords?: string[],
  maxPagesPerKeyword = 3
): Promise<IngestibleJob[]> {
  const all: IngestibleJob[] = []

  if (!keywords || keywords.length === 0) {
    // Broad scrape: browse all new UK jobs posted today
    log.info("reed_broad_start", {})
    const jobs = await scrapeSearchTerm("", maxPagesPerKeyword)
    log.info("reed_broad_done", { count: jobs.length })
    all.push(...jobs)
  } else {
    for (const kw of keywords) {
      const reedKw = toReedKeyword(kw)
      log.info("reed_keyword_start", { keyword: reedKw })
      const jobs = await scrapeSearchTerm(reedKw, maxPagesPerKeyword)
      log.info("reed_keyword_done", { keyword: reedKw, count: jobs.length })
      all.push(...jobs)
      await sleep(3000)
    }
  }

  return all
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  log.info("reed_standalone_start", { mode: "broad" })
  scrapeReed()
    .then((jobs) => pushJobs(jobs, { label: "reed" }))
    .catch(console.error)
}
