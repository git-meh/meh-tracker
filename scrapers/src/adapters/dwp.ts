/**
 * DWP / Find a Job scraper (UK Government job board).
 *
 * URL: https://findajob.dwp.gov.uk/search
 * Params: q={keyword}&loc=United+Kingdom&pp=50&sf=pd&so=d&pg={page}
 *
 * Note: This timed out in WebFetch test environment but should work in Node.js
 * with proper browser-like headers. The site is a UK government board with
 * no aggressive bot detection.
 *
 * High relevance for visa-sponsored UK jobs — government jobs often mention
 * sponsorship requirements explicitly.
 */

import { fileURLToPath } from "url"
import { fetchPage, NotFoundError, BlockedError, sleep } from "../lib/fetch.js"
import { detectSponsorshipStatus } from "../lib/visa-detect.js"
import {
  stripHtml,
  detectWorkMode,
  normalizeEmploymentType,
  type IngestibleJob,
} from "../lib/normalizer.js"
import { pushJobs } from "../lib/pusher.js"

// All tech categories — hyphen-separated for DWP query
const DWP_SEARCH_TERMS = [
  "software engineer",
  "backend developer",
  "frontend developer",
  "full stack developer",
  "data engineer",
  "data scientist",
  "data analyst",
  "machine learning",
  "devops engineer",
  "cloud engineer",
  "platform engineer",
  "site reliability",
  "network engineer",
  "security engineer",
  "cybersecurity",
  "product manager",
  "product designer",
  "ux designer",
  "qa engineer",
  "test engineer",
  "it support",
  "systems administrator",
  "engineering manager",
  "technical project manager",
  "business analyst",
  "scrum master",
]

const BASE_URL = "https://findajob.dwp.gov.uk"

function extractJobLinks(html: string): string[] {
  // DWP search results link to /details/{id} or /job/{id}
  const matches = [
    ...html.matchAll(/href="(\/details\/\d+[^"]*)"/gi),
    ...html.matchAll(/href="(\/job\/[^"]+)"/gi),
  ]
  const links = matches.map((m) => m[1])
  return [...new Set(links)]
}

function hasNextPage(html: string, currentPage: number): boolean {
  // Look for a link to the next page number
  return html.includes(`pg=${currentPage + 1}`) || html.includes(`page=${currentPage + 1}`)
}

async function scrapeDetailPage(path: string): Promise<IngestibleJob | null> {
  const url = `${BASE_URL}${path}`

  const html = await fetchPage(url, { minDelayMs: 1500, maxDelayMs: 3000 })

  // DWP detail pages use schema.org JSON-LD where available, otherwise HTML
  // Try JSON-LD first
  const jsonLdMatch = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i)
  if (jsonLdMatch) {
    try {
      const data = JSON.parse(jsonLdMatch[1])
      if (data["@type"] === "JobPosting") {
        return parseJsonLdJob(data, url, path)
      }
    } catch {
      // fall through to HTML parsing
    }
  }

  // HTML fallback parsing
  return parseHtmlJob(html, url, path)
}

type DwpJsonLd = {
  title?: string
  hiringOrganization?: { name?: string }
  baseSalary?: { value?: { minValue?: number; maxValue?: number }; currency?: string }
  employmentType?: string
  jobLocation?: { address?: { addressLocality?: string; addressCountry?: string } }
  datePosted?: string
  validThrough?: string
  description?: string
  url?: string
}

function parseJsonLdJob(data: DwpJsonLd, url: string, path: string): IngestibleJob | null {
  const title = data.title?.trim()
  const company = data.hiringOrganization?.name?.trim()
  if (!title || !company) return null

  const description = data.description ? stripHtml(data.description) : null
  const location = data.jobLocation?.address?.addressLocality ?? null
  const workMode = detectWorkMode(location, description)
  const visaSponsorshipStatus = detectSponsorshipStatus(description ?? "")
  const employmentType = normalizeEmploymentType(data.employmentType)

  const idMatch = path.match(/\/(\d+)\/?$/)
  const sourceJobId = idMatch ? idMatch[1] : null

  return {
    url: data.url ?? url,
    title,
    company,
    description,
    salaryMin: data.baseSalary?.value?.minValue ?? null,
    salaryMax: data.baseSalary?.value?.maxValue ?? null,
    currency: data.baseSalary?.currency ?? "GBP",
    location,
    countryCode: "GB",
    countryConfidence: "source_default",
    tags: [],
    eligibleCountries: ["GB"],
    sourceType: "approved_feed",
    sourceKey: "dwp",
    sourceJobId,
    applyAdapter: "manual_external",
    visaSponsorshipStatus,
    workMode,
    employmentType,
    closingAt: data.validThrough ? new Date(data.validThrough) : null,
  }
}

function parseHtmlJob(html: string, url: string, path: string): IngestibleJob | null {
  // Generic HTML selectors for DWP job detail pages
  // These may need updating if DWP changes their HTML structure

  // Job title
  const titleMatch =
    html.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
    html.match(/class="[^"]*job-title[^"]*"[^>]*>([^<]+)</i)
  const title = titleMatch ? titleMatch[1].trim() : null

  // Company / employer name
  const companyMatch =
    html.match(/class="[^"]*employer[^"]*"[^>]*>([^<]+)</i) ||
    html.match(/Employer[^:]*:[^<]*<[^>]+>([^<]+)/i)
  const company = companyMatch ? companyMatch[1].trim() : "Government / Public Sector"

  if (!title) return null

  // Description — grab the main content area
  const descMatch = html.match(/class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
  const description = descMatch ? stripHtml(descMatch[1]) : null

  // Salary
  const salaryMatch = html.match(/Salary[^:]*:[^<]*<[^>]+>([^<]+)/i)
  const salaryText = salaryMatch ? salaryMatch[1].trim() : null

  const idMatch = path.match(/\/(\d+)\/?$/)
  const sourceJobId = idMatch ? idMatch[1] : null

  return {
    url,
    title,
    company,
    description,
    salaryRange: salaryText,
    currency: "GBP",
    location: "United Kingdom",
    countryCode: "GB",
    countryConfidence: "source_default",
    tags: [],
    eligibleCountries: ["GB"],
    sourceType: "approved_feed",
    sourceKey: "dwp",
    sourceJobId,
    applyAdapter: "manual_external",
    visaSponsorshipStatus: detectSponsorshipStatus(description ?? ""),
    workMode: detectWorkMode("United Kingdom", description),
    employmentType: "unknown",
  }
}

async function scrapeSearchTerm(keyword: string, maxPages = 5): Promise<IngestibleJob[]> {
  const jobs: IngestibleJob[] = []
  const seenLinks = new Set<string>()

  for (let page = 1; page <= maxPages; page++) {
    // loc=United+Kingdom causes HTTP 400 since DWP changed their search API.
    // The site is UK-only so omitting loc still returns UK jobs.
    const searchUrl =
      `${BASE_URL}/search?q=${encodeURIComponent(keyword)}&pp=50&sf=pd&so=d&pg=${page}`
    console.log(`[dwp] ${keyword} page ${page}`)

    let html: string
    try {
      html = await fetchPage(searchUrl, { minDelayMs: 1500, maxDelayMs: 3500 })
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof BlockedError) {
        console.warn(`[dwp] ${keyword} page ${page}: ${err instanceof Error ? err.message : err} — stopping`)
        break
      }
      console.error(`[dwp] ${keyword} page ${page} error:`, err)
      break
    }

    const links = extractJobLinks(html).filter((l) => !seenLinks.has(l))
    if (links.length === 0) {
      console.log(`[dwp] ${keyword} page ${page}: no new links — stopping`)
      break
    }

    links.forEach((l) => seenLinks.add(l))
    console.log(`[dwp] ${keyword} page ${page}: ${links.length} jobs`)

    for (const link of links) {
      try {
        const job = await scrapeDetailPage(link)
        if (job) jobs.push(job)
      } catch (err) {
        console.warn(`[dwp] Failed ${link}:`, err)
      }
    }

    if (!hasNextPage(html, page)) break
    await sleep(2000)
  }

  return jobs
}

export async function scrapeDwp(
  keywords: string[] = DWP_SEARCH_TERMS,
  maxPagesPerKeyword = 3
): Promise<IngestibleJob[]> {
  const all: IngestibleJob[] = []

  for (const keyword of keywords) {
    console.log(`[dwp] Starting: ${keyword}`)
    const jobs = await scrapeSearchTerm(keyword, maxPagesPerKeyword)
    console.log(`[dwp] ${keyword}: ${jobs.length} jobs`)
    all.push(...jobs)
    await sleep(3000)
  }

  return all
}

// Run directly: npx tsx src/adapters/dwp.ts
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(`[dwp] Running across ${DWP_SEARCH_TERMS.length} search terms`)

  scrapeDwp()
    .then((jobs) => pushJobs(jobs, { label: "dwp" }))
    .catch(console.error)
}
