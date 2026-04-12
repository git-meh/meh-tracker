/**
 * Indeed UK scraper (indeed.co.uk / indeed.com/jobs).
 *
 * Indeed serves JSON-LD on job detail pages under /viewjob?jk={id}.
 * DuckDuckGo discovers these via `site:indeed.co.uk {keyword}`.
 */

import { fileURLToPath } from "url"
import { scrapeBoard, type BoardConfig } from "../lib/generic-board.js"
import { pushJobs } from "../lib/pusher.js"
import { log } from "../lib/log.js"

const config: BoardConfig = {
  key: "indeed",
  domain: "indeed.co.uk",
  baseUrl: "https://uk.indeed.com",
  isDetailUrl: (url) =>
    url.includes("/viewjob") ||
    url.includes("/rc/clk") ||
    /indeed\.co\.uk\/.*\?jk=/.test(url) ||
    /indeed\.com\/.*\?jk=/.test(url),
  searchUrlTemplate:
    "https://uk.indeed.com/jobs?q={keyword}&l=United+Kingdom&sort=date",
  extractLinks: (html) => {
    const matches = [
      ...html.matchAll(/href="(\/viewjob\?[^"]+)"/gi),
      ...html.matchAll(/href="(\/rc\/clk\?[^"]+)"/gi),
    ]
    return [...new Set(matches.map((m) => "https://uk.indeed.com" + m[1]))]
  },
  defaultTags: ["Indeed"],
  sourceType: "approved_feed",
}

export async function scrapeIndeed(
  keywords?: string[],
  maxJobs = 30
) {
  log.info("indeed_start", { keywords: keywords?.length ?? 0, mode: keywords ? "keyword" : "location" })
  return scrapeBoard(config, keywords, maxJobs)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  scrapeIndeed()
    .then((jobs) => pushJobs(jobs, { label: "indeed" }))
    .catch(console.error)
}
