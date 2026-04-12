/**
 * Totaljobs scraper (totaljobs.com).
 *
 * One of the UK's largest job boards. Detail pages include JSON-LD.
 * Search URL: https://www.totaljobs.com/jobs/{keyword}-jobs
 */

import { fileURLToPath } from "url"
import { scrapeBoard, type BoardConfig } from "../lib/generic-board.js"
import { pushJobs } from "../lib/pusher.js"
import { log } from "../lib/log.js"

const config: BoardConfig = {
  key: "totaljobs",
  domain: "totaljobs.com",
  baseUrl: "https://www.totaljobs.com",
  isDetailUrl: (url) =>
    /totaljobs\.com\/job\//i.test(url) ||
    /totaljobs\.com\/[\w-]+-jobs\/[\w-]+-job-\d+/i.test(url),
  searchUrlTemplate:
    "https://www.totaljobs.com/jobs/{keyword}-jobs",
  extractLinks: (html) => {
    const matches = [
      ...html.matchAll(/href="(\/job\/[^"?#]+)"/gi),
      ...html.matchAll(/href="(\/[\w-]+-jobs\/[\w-]+-job-\d+[^"?#]*)"/gi),
    ]
    return [...new Set(matches.map((m) => "https://www.totaljobs.com" + m[1]))]
  },
  defaultTags: ["Totaljobs"],
  sourceType: "approved_feed",
}

export async function scrapeTotaljobs(
  keywords?: string[],
  maxJobs = 30
) {
  log.info("totaljobs_start", { keywords: keywords?.length ?? 0, mode: keywords ? "keyword" : "location" })
  return scrapeBoard(config, keywords, maxJobs)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  scrapeTotaljobs()
    .then((jobs) => pushJobs(jobs, { label: "totaljobs" }))
    .catch(console.error)
}
