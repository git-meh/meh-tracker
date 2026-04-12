/**
 * Guardian Jobs scraper (jobs.theguardian.com).
 *
 * Strong in public sector, media, education, charity, and professional roles.
 * Detail pages include JSON-LD.
 */

import { fileURLToPath } from "url"
import { scrapeBoard, type BoardConfig } from "../lib/generic-board.js"
import { pushJobs } from "../lib/pusher.js"
import { log } from "../lib/log.js"

const config: BoardConfig = {
  key: "guardian",
  domain: "jobs.theguardian.com",
  baseUrl: "https://jobs.theguardian.com",
  isDetailUrl: (url) =>
    /jobs\.theguardian\.com\/job\/\d+/i.test(url) ||
    /jobs\.theguardian\.com\/[\w-]+-\d+/i.test(url),
  searchUrlTemplate:
    "https://jobs.theguardian.com/jobs/{keyword}/",
  extractLinks: (html) => {
    const matches = [
      ...html.matchAll(/href="(\/job\/\d+[^"?#]*)"/gi),
    ]
    return [...new Set(matches.map((m) => "https://jobs.theguardian.com" + m[1]))]
  },
  defaultTags: ["Guardian Jobs", "Public Sector"],
  sourceType: "approved_feed",
}

export async function scrapeGuardian(
  keywords?: string[],
  maxJobs = 30
) {
  log.info("guardian_start", { keywords: keywords?.length ?? 0, mode: keywords ? "keyword" : "location" })
  return scrapeBoard(config, keywords, maxJobs)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  scrapeGuardian()
    .then((jobs) => pushJobs(jobs, { label: "guardian" }))
    .catch(console.error)
}
