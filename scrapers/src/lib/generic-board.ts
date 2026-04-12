/**
 * Generic job-board scraper factory.
 *
 * Design principle: scrapers should NOT need to know what job types exist.
 * Instead they scrape BROADLY (by location, by board browse pages, or via
 * DuckDuckGo with a location bias) and let the matching algorithm handle
 * relevance per user.
 *
 * If you need keyword-narrowed scraping (e.g. to reduce volume from huge
 * boards), pass an optional `keywords` array — but these should come from
 * user profiles, not a hardcoded list.
 */

import { fetchPage, NotFoundError, BlockedError, sleep } from "./fetch.js"
import { discoverJobUrls } from "./search-discovery.js"
import { detectSponsorshipStatus } from "./visa-detect.js"
import {
  stripHtml,
  detectWorkMode,
  resolveCountryMetadata,
  normalizeEmploymentType,
  type IngestibleJob,
  type JobSourceType,
} from "./normalizer.js"
import { log } from "./log.js"

export type BoardConfig = {
  /** Unique key for this board, used in log messages */
  key: string
  /** Domain to search within DuckDuckGo, e.g. "totaljobs.com" */
  domain: string
  /** Base URL used when resolving relative job links */
  baseUrl: string
  /** Return true if a URL is a job DETAIL page (not a search/listing page) */
  isDetailUrl: (url: string) => boolean
  /** Extract job links from a direct search/browse page (fallback) */
  extractLinks?: (html: string) => string[]
  /**
   * Direct fallback search URL — used when DuckDuckGo finds nothing.
   * Use `{keyword}` as a placeholder (omit if keyword-free).
   * Should include a UK location bias wherever possible.
   */
  searchUrlTemplate?: string
  /** Tags to attach to every job from this board (e.g. board name, sector) */
  defaultTags?: string[]
  /** Source type for DB */
  sourceType?: JobSourceType
  /** Default company name when not found in JSON-LD */
  defaultCompany?: string
  /** Custom HTML parser for boards without JSON-LD (returns partial IngestibleJob) */
  parseHtmlFallback?: (html: string, url: string) => Partial<IngestibleJob> | null
}

// ─── Core scraping logic ────────────────────────────────────────────────────

async function scrapeDetailPage(
  url: string,
  config: BoardConfig
): Promise<IngestibleJob | null> {
  const html = await fetchPage(url, { minDelayMs: 1500, maxDelayMs: 3500 })

  // ── Try JSON-LD first ────────────────────────────────────────────────────
  const jsonLdMatches = [
    ...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi),
  ]
  for (const match of jsonLdMatches) {
    try {
      const raw = JSON.parse(match[1].trim())
      const data = raw["@type"] === "JobPosting"
        ? raw
        : Array.isArray(raw["@graph"])
          ? raw["@graph"].find((x: { "@type": string }) => x["@type"] === "JobPosting")
          : null
      if (!data?.title) continue

      const description = data.description ? stripHtml(data.description) : null
      const locationStr =
        data.jobLocation?.address?.addressLocality ??
        data.jobLocation?.address?.addressRegion ??
        null

      // Prefer explicit addressCountry from JSON-LD; fall back to text detection
      const { countryCode, countryConfidence } = resolveCountryMetadata({
        countryCode: data.jobLocation?.address?.addressCountry,
        location: locationStr,
      })

      const idMatch = url.match(/\/(\d+)\/?(?:[?#].*)?$/)

      return {
        url: data.url ?? url,
        title: String(data.title).trim(),
        company: data.hiringOrganization?.name?.trim() ?? config.defaultCompany ?? "Unknown",
        description,
        salaryMin: data.baseSalary?.value?.minValue ?? null,
        salaryMax: data.baseSalary?.value?.maxValue ?? null,
        currency: data.baseSalary?.currency ?? "GBP",
        location: locationStr ?? null,
        countryCode,
        countryConfidence,
        tags: config.defaultTags ?? [],
        eligibleCountries: countryCode ? [countryCode] : [],
        sourceType: config.sourceType ?? "approved_feed",
        sourceKey: config.key,
        sourceJobId: idMatch ? idMatch[1] : url.split("/").pop() ?? null,
        applyAdapter: "manual_external",
        visaSponsorshipStatus: detectSponsorshipStatus(description ?? ""),
        workMode: detectWorkMode(locationStr, description),
        employmentType: normalizeEmploymentType(data.employmentType),
        closingAt: data.validThrough ? new Date(data.validThrough) : null,
      }
    } catch { /* fall through to next block */ }
  }

  // ── Custom HTML fallback ─────────────────────────────────────────────────
  if (config.parseHtmlFallback) {
    const partial = config.parseHtmlFallback(html, url)
    if (partial?.title) {
      const { countryCode, countryConfidence } = resolveCountryMetadata({
        countryCode: partial.countryCode ?? null,
        location: partial.location ?? null,
      })
      return {
        url,
        company: config.defaultCompany ?? "Unknown",
        currency: "GBP",
        location: partial.location ?? null,
        tags: config.defaultTags ?? [],
        eligibleCountries: countryCode ? [countryCode] : [],
        sourceType: config.sourceType ?? "approved_feed",
        sourceKey: config.key,
        sourceJobId: null,
        applyAdapter: "manual_external",
        visaSponsorshipStatus: "unknown",
        workMode: "unknown",
        employmentType: "unknown",
        countryConfidence,
        ...partial,
        countryCode,
      } as IngestibleJob
    }
  }

  // ── Generic HTML fallback ────────────────────────────────────────────────
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
  const title = titleMatch?.[1]?.trim()
  if (!title) return null

  const descMatch = html.match(/<div[^>]+(?:class|id)="[^"]*(?:job-desc|description|vacancy-desc|content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
  const description = descMatch ? stripHtml(descMatch[1]) : null

  return {
    url,
    title,
    company: config.defaultCompany ?? "Unknown",
    description,
    currency: "GBP",
    location: null,
    countryCode: null,
    countryConfidence: "unknown",
    tags: config.defaultTags ?? [],
    eligibleCountries: [],
    sourceType: config.sourceType ?? "approved_feed",
    sourceKey: config.key,
    sourceJobId: null,
    applyAdapter: "manual_external",
    visaSponsorshipStatus: detectSponsorshipStatus(description ?? ""),
    workMode: detectWorkMode(null, description),
    employmentType: "unknown",
  }
}

async function scrapeWithKeyword(
  keyword: string | null,
  config: BoardConfig,
  maxJobs: number
): Promise<IngestibleJob[]> {
  const results: IngestibleJob[] = []
  const seen = new Set<string>()

  // ── Step 1: DuckDuckGo discovery ─────────────────────────────────────────
  // Always include "United Kingdom" in the query to bias results geographically.
  const discoveryKeyword = keyword
    ? `"United Kingdom" ${keyword}`
    : '"United Kingdom"'

  log.info(`${config.key}_discover`, { keyword: keyword ?? "(location only)" })
  const discovered = await discoverJobUrls(config.domain, discoveryKeyword, maxJobs)
  const jobUrls = discovered.map((d) => d.url).filter((u) => config.isDetailUrl(u))

  // ── Step 2: fallback to direct search ────────────────────────────────────
  if (jobUrls.length === 0 && config.searchUrlTemplate) {
    log.info(`${config.key}_fallback_search`, { keyword })
    const searchUrl = keyword
      ? config.searchUrlTemplate.replace("{keyword}", encodeURIComponent(keyword))
      : config.searchUrlTemplate.replace("{keyword}", "").replace(/[?&]q=$/, "")
    try {
      const html = await fetchPage(searchUrl, { minDelayMs: 2000, maxDelayMs: 4000 })
      const links = config.extractLinks ? config.extractLinks(html) : []
      links.forEach((u) => { if (!seen.has(u)) jobUrls.push(u) })
    } catch (err) {
      log.error(`${config.key}_search_error`, { keyword, error: String(err) })
    }
  }

  log.info(`${config.key}_scraping`, { keyword, urls: jobUrls.length })

  for (const url of jobUrls) {
    if (seen.has(url)) continue
    seen.add(url)
    try {
      const job = await scrapeDetailPage(url, config)
      if (job) results.push(job)
      await sleep(1500)
    } catch (err) {
      if (err instanceof NotFoundError) continue
      if (err instanceof BlockedError) {
        log.warn(`${config.key}_blocked`, { url })
        break
      }
      log.warn(`${config.key}_detail_error`, { url, error: String(err) })
    }
  }

  log.info(`${config.key}_keyword_done`, { keyword, count: results.length })
  return results
}

/**
 * Scrape a job board.
 *
 * @param config     Board configuration
 * @param keywords   Optional list of role keywords to search for.
 *                   When empty/undefined, scrapes broadly by UK location only.
 * @param maxJobsPerKeyword  Max jobs to collect per keyword (or per location pass)
 */
export async function scrapeBoard(
  config: BoardConfig,
  keywords?: string[],
  maxJobsPerKeyword = 30
): Promise<IngestibleJob[]> {
  const all: IngestibleJob[] = []

  if (!keywords || keywords.length === 0) {
    // Broad location-only scrape — no keyword filter
    const jobs = await scrapeWithKeyword(null, config, maxJobsPerKeyword)
    all.push(...jobs)
  } else {
    for (const keyword of keywords) {
      const jobs = await scrapeWithKeyword(keyword, config, maxJobsPerKeyword)
      all.push(...jobs)
      await sleep(3000)
    }
  }

  log.info(`${config.key}_done`, { total: all.length })
  return all
}
