/**
 * Search-engine job discovery.
 *
 * Instead of reverse-engineering each job board's pagination/URL format,
 * we search DuckDuckGo for `site:{board} {keyword}` and extract the real
 * job URLs from the search results HTML. This works across any board that
 * is indexed by search engines.
 *
 * DuckDuckGo lite (lite.duckduckgo.com) is the most scraper-friendly
 * option — no JavaScript required, no CAPTCHAs, returns plain HTML.
 */

import { fetchPage, sleep } from "./fetch.js"
import { log } from "./log.js"

const DDG_LITE = "https://lite.duckduckgo.com/lite"

export type DiscoveredUrl = {
  url: string
  title?: string
}

/**
 * Search DuckDuckGo for `site:{domain} {keyword}` and return matching URLs.
 *
 * @param domain  e.g. "jobs.nhs.uk" or "lgjobs.com"
 * @param keyword e.g. "frontend developer"
 * @param maxResults  stop after collecting this many URLs (default 30)
 */
export async function discoverJobUrls(
  domain: string,
  keyword: string,
  maxResults = 30
): Promise<DiscoveredUrl[]> {
  const found: DiscoveredUrl[] = []
  const seen = new Set<string>()

  // DDG paginates via s= offset (0, 20, 40, …)
  for (let offset = 0; found.length < maxResults; offset += 20) {
    const query = `site:${domain} ${keyword}`
    const url =
      offset === 0
        ? `${DDG_LITE}/?q=${encodeURIComponent(query)}`
        : `${DDG_LITE}/?q=${encodeURIComponent(query)}&s=${offset}&dc=${offset + 1}&o=json&api=d.js`

    log.info("search_discovery_query", { domain, keyword, offset })

    let html: string
    try {
      html = await fetchPage(url, {
        minDelayMs: 2000,
        maxDelayMs: 4000,
        headers: {
          Referer: "https://lite.duckduckgo.com/",
        },
      })
    } catch (err) {
      log.warn("search_discovery_fetch_error", { domain, keyword, offset, error: String(err) })
      break
    }

    // Extract result links — DDG lite wraps them in <a class="result-link"> or plain <a href="...">
    const linkMatches = [
      ...html.matchAll(/<a[^>]+class="[^"]*result[^"]*"[^>]+href="([^"]+)"/gi),
      ...html.matchAll(/href="(https?:\/\/[^"]*\b${domain.replace(".", "\\.")}[^"]*\b[^"]*)"/gi),
    ]

    // Also try extracting from result snippet URLs in DDG lite format
    const allHrefs = [...html.matchAll(/href="(https?:\/\/[^"]+)"/gi)].map((m) => m[1])

    const candidates = [
      ...linkMatches.map((m) => m[1]),
      ...allHrefs,
    ].filter((u) => u.includes(domain) && !seen.has(u))

    for (const candidate of candidates) {
      if (seen.has(candidate)) continue
      // Exclude search/filter pages — we want individual job listings
      if (candidate.includes("search") && !candidate.includes("results")) continue
      seen.add(candidate)
      found.push({ url: candidate })
      if (found.length >= maxResults) break
    }

    // If no new results on this page, stop
    if (candidates.length === 0) {
      log.info("search_discovery_exhausted", { domain, keyword, total: found.length })
      break
    }

    await sleep(2500)
  }

  log.info("search_discovery_done", { domain, keyword, found: found.length })
  return found
}
