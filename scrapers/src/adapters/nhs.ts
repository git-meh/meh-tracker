/**
 * NHS Jobs scraper.
 *
 * Primary: DuckDuckGo `site:jobs.nhs.uk {keyword}` → discover live job URLs.
 * Fallback: Direct search at jobs.nhs.uk/candidate/search/results?keyword=...
 *
 * Verified search endpoint (2026-04-12):
 *   https://www.jobs.nhs.uk/candidate/search/results?keyword=software+engineer&language=en
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

const BASE_URL = "https://www.jobs.nhs.uk"
const DOMAIN   = "jobs.nhs.uk"

const NHS_SEARCH_TERMS = [
  "frontend developer",
  "frontend engineer",
  "software engineer",
  "software developer",
  "web developer",
  "full stack developer",
  "data engineer",
  "data scientist",
  "devops engineer",
  "cloud engineer",
  "cyber security",
  "digital",
  "it support",
  "product manager",
  "business analyst",
  "systems engineer",
  "network engineer",
]

function isJobDetailUrl(url: string): boolean {
  return (
    url.includes("/candidate/jobad/view/") ||
    url.includes("/xi/vacancy/") ||
    /\/jobs\/\d+/.test(url)
  )
}

function extractDirectJobLinks(html: string, baseUrl: string): string[] {
  const matches = [
    ...html.matchAll(/href="(\/candidate\/jobad\/view\/[^"?#]+)"/gi),
    ...html.matchAll(/href="(\/xi\/vacancy\/[^"?#]+)"/gi),
  ]
  return [...new Set(matches.map((m) => baseUrl + m[1]))]
}

async function scrapeDetailPage(url: string): Promise<IngestibleJob | null> {
  const html = await fetchPage(url, { minDelayMs: 1500, maxDelayMs: 3000 })

  // Try JSON-LD first
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
        return {
          url: data.url ?? url,
          title: data.title.trim(),
          company: data.hiringOrganization?.name?.trim() ?? "NHS",
          description,
          salaryMin: data.baseSalary?.value?.minValue ?? null,
          salaryMax: data.baseSalary?.value?.maxValue ?? null,
          currency: "GBP",
          location,
          countryCode: "GB",
          countryConfidence: "source_default",
          tags: ["NHS", "Public Sector", "Healthcare"],
          eligibleCountries: ["GB"],
          sourceType: "employer_site",
          sourceKey: "nhs",
          sourceJobId: url.split("/").pop() ?? null,
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

  const descMatch = html.match(
    /<div[^>]+class="[^"]*job-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i
  )
  const description = descMatch ? stripHtml(descMatch[1]) : null

  return {
    url,
    title,
    company: "NHS",
    description,
    currency: "GBP",
    location: "United Kingdom",
    countryCode: "GB",
    countryConfidence: "source_default",
    tags: ["NHS", "Public Sector"],
    eligibleCountries: ["GB"],
    sourceType: "employer_site",
    sourceKey: "nhs",
    sourceJobId: url.split("/").pop() ?? null,
    applyAdapter: "manual_external",
    visaSponsorshipStatus: detectSponsorshipStatus(description ?? ""),
    workMode: detectWorkMode(null, description),
    employmentType: "unknown",
  }
}

async function scrapeKeyword(keyword: string, maxJobs = 30): Promise<IngestibleJob[]> {
  const results: IngestibleJob[] = []
  const seen = new Set<string>()

  // ── Step 1: search-engine discovery ──────────────────────────────────────────
  log.info("nhs_discover", { keyword })
  const discovered = await discoverJobUrls(DOMAIN, keyword, maxJobs)
  const jobUrls = discovered.map((d) => d.url).filter((u) => isJobDetailUrl(u))

  // ── Step 2: fallback to direct search if discovery yielded nothing ────────────
  if (jobUrls.length === 0) {
    log.info("nhs_fallback_search", { keyword })
    const searchUrl =
      `${BASE_URL}/candidate/search/results?keyword=${encodeURIComponent(keyword)}&language=en`
    try {
      const html = await fetchPage(searchUrl, { minDelayMs: 2000, maxDelayMs: 4000 })
      const directLinks = extractDirectJobLinks(html, BASE_URL)
      directLinks.forEach((u) => { if (!seen.has(u)) jobUrls.push(u) })
    } catch (err) {
      log.error("nhs_search_error", { keyword, error: String(err) })
    }
  }

  log.info("nhs_scraping", { keyword, urls: jobUrls.length })

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
        log.warn("nhs_blocked", { url })
        break
      }
      log.warn("nhs_detail_error", { url, error: String(err) })
    }
  }

  log.info("nhs_keyword_done", { keyword, count: results.length })
  return results
}

export async function scrapeNhs(
  keywords: string[] = NHS_SEARCH_TERMS,
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
  scrapeNhs()
    .then((jobs) => pushJobs(jobs, { label: "nhs" }))
    .catch(console.error)
}
