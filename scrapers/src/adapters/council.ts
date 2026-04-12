/**
 * Local Government Jobs scraper — lgjobs.com (by Jobs Go Public).
 *
 * Primary: DuckDuckGo `site:lgjobs.com {keyword}` → discover live job URLs.
 * Fallback: Direct search at lgjobs.com/jobs?keyword=...
 *
 * Verified search endpoint (2026-04-12):
 *   https://www.lgjobs.com/jobs?keyword=software+engineer&page=1
 *   (pagination: /75 pages found — very active board)
 */

import { fileURLToPath } from "url"
import { fetchPage, NotFoundError, BlockedError, sleep } from "../lib/fetch.js"
import { discoverJobUrls } from "../lib/search-discovery.js"
import { detectSponsorshipStatus } from "../lib/visa-detect.js"
import {
  stripHtml,
  detectWorkMode,
  normalizeEmploymentType,
  type IngestibleJob,
} from "../lib/normalizer.js"
import { pushJobs } from "../lib/pusher.js"
import { log } from "../lib/log.js"

const BASE_URL = "https://www.lgjobs.com"
const DOMAIN   = "lgjobs.com"

const COUNCIL_SEARCH_TERMS = [
  "frontend developer",
  "frontend engineer",
  "software engineer",
  "software developer",
  "web developer",
  "data analyst",
  "data engineer",
  "digital",
  "it support",
  "systems engineer",
  "network engineer",
  "cyber security",
  "project manager",
  "business analyst",
  "product manager",
  "cloud engineer",
  "devops",
]

function isJobDetailUrl(url: string): boolean {
  // lgjobs detail URLs: /jobs/{id}/{slug}
  return /\/jobs\/\d+\//.test(url)
}

function extractDirectJobLinks(html: string): string[] {
  const matches = [
    ...html.matchAll(/href="(\/jobs\/\d+\/[^"?#]+)"/gi),
  ]
  return [...new Set(matches.map((m) => BASE_URL + m[1]))]
}

async function scrapeDetailPage(url: string): Promise<IngestibleJob | null> {
  const html = await fetchPage(url, { minDelayMs: 1500, maxDelayMs: 3500 })

  // Try JSON-LD
  const jsonLdMatch = html.match(
    /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i
  )
  if (jsonLdMatch) {
    try {
      const data = JSON.parse(jsonLdMatch[1])
      if (data["@type"] === "JobPosting" && data.title) {
        const description = data.description ? stripHtml(data.description) : null
        const location =
          data.jobLocation?.address?.addressLocality ??
          data.jobLocation?.address?.addressRegion ??
          "United Kingdom"
        const idMatch = url.match(/\/jobs\/(\d+)\//i)
        return {
          url: data.url ?? url,
          title: data.title.trim(),
          company: data.hiringOrganization?.name?.trim() ?? "Local Authority",
          description,
          salaryMin: data.baseSalary?.value?.minValue ?? null,
          salaryMax: data.baseSalary?.value?.maxValue ?? null,
          currency: data.baseSalary?.currency ?? "GBP",
          location,
          countryCode: "GB",
          countryConfidence: "source_default",
          tags: ["Public Sector", "Local Government", "Council"],
          eligibleCountries: ["GB"],
          sourceType: "approved_feed",
          sourceKey: "council",
          sourceJobId: idMatch ? idMatch[1] : null,
          applyAdapter: "manual_external",
          visaSponsorshipStatus: detectSponsorshipStatus(description ?? ""),
          workMode: detectWorkMode(location, description),
          employmentType: normalizeEmploymentType(data.employmentType),
          closingAt: data.validThrough ? new Date(data.validThrough) : null,
        }
      }
    } catch { /* fall through */ }
  }

  // HTML fallback
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
  const title = titleMatch?.[1]?.trim()
  if (!title) return null

  const companyMatch = html.match(/class="[^"]*employer[^"]*"[^>]*>([^<]+)/i)
  const company = companyMatch?.[1]?.trim() ?? "Local Authority"

  return {
    url,
    title,
    company,
    currency: "GBP",
    location: "United Kingdom",
    countryCode: "GB",
    countryConfidence: "source_default",
    tags: ["Public Sector", "Local Government"],
    eligibleCountries: ["GB"],
    sourceType: "approved_feed",
    sourceKey: "council",
    sourceJobId: null,
    applyAdapter: "manual_external",
    visaSponsorshipStatus: "unknown",
    workMode: "unknown",
    employmentType: "unknown",
  }
}

async function scrapeKeyword(keyword: string, maxJobs = 30): Promise<IngestibleJob[]> {
  const results: IngestibleJob[] = []
  const seen = new Set<string>()

  // ── Step 1: search-engine discovery ──────────────────────────────────────────
  log.info("council_discover", { keyword })
  const discovered = await discoverJobUrls(DOMAIN, keyword, maxJobs)
  const jobUrls = discovered.map((d) => d.url).filter((u) => isJobDetailUrl(u))

  // ── Step 2: fallback to direct search ────────────────────────────────────────
  if (jobUrls.length === 0) {
    log.info("council_fallback_search", { keyword })
    const searchUrl = `${BASE_URL}/jobs?keyword=${encodeURIComponent(keyword)}&page=1`
    try {
      const html = await fetchPage(searchUrl, { minDelayMs: 2000, maxDelayMs: 4000 })
      const directLinks = extractDirectJobLinks(html)
      directLinks.forEach((u) => { if (!seen.has(u)) jobUrls.push(u) })
    } catch (err) {
      log.error("council_search_error", { keyword, error: String(err) })
    }
  }

  log.info("council_scraping", { keyword, urls: jobUrls.length })

  for (const url of jobUrls) {
    if (seen.has(url)) continue
    seen.add(url)
    try {
      const job = await scrapeDetailPage(url)
      if (job) results.push(job)
      await sleep(1500)
    } catch (err) {
      if (err instanceof NotFoundError) continue
      if (err instanceof BlockedError) {
        log.warn("council_blocked", { url })
        break
      }
      log.warn("council_detail_error", { url, error: String(err) })
    }
  }

  log.info("council_keyword_done", { keyword, count: results.length })
  return results
}

export async function scrapeCouncil(
  keywords: string[] = COUNCIL_SEARCH_TERMS,
  maxJobsPerKeyword = 25
): Promise<IngestibleJob[]> {
  const all: IngestibleJob[] = []
  for (const keyword of keywords) {
    const jobs = await scrapeKeyword(keyword, maxJobsPerKeyword)
    all.push(...jobs)
    await sleep(3000)
  }
  return all
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  scrapeCouncil()
    .then((jobs) => pushJobs(jobs, { label: "council" }))
    .catch(console.error)
}
