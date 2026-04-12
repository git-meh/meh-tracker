/**
 * CWJobs scraper (cwjobs.co.uk).
 *
 * UK's leading IT & tech job board.
 * Detail pages at /job/{id}/{slug}.
 */

import { fileURLToPath } from "url"
import { scrapeBoard, type BoardConfig } from "../lib/generic-board.js"
import { pushJobs } from "../lib/pusher.js"
import { log } from "../lib/log.js"

const config: BoardConfig = {
  key: "cwjobs",
  domain: "cwjobs.co.uk",
  baseUrl: "https://www.cwjobs.co.uk",
  isDetailUrl: (url) =>
    /cwjobs\.co\.uk\/job\//i.test(url) ||
    /cwjobs\.co\.uk\/[\w-]+-job-\d+/i.test(url),
  searchUrlTemplate:
    "https://www.cwjobs.co.uk/jobs/{keyword}-jobs",
  extractLinks: (html) => {
    const matches = [
      ...html.matchAll(/href="(\/job\/[^"?#]+)"/gi),
    ]
    return [...new Set(matches.map((m) => "https://www.cwjobs.co.uk" + m[1]))]
  },
  defaultTags: ["CWJobs", "Tech"],
  sourceType: "approved_feed",
}

export async function scrapeCwjobs(
  keywords?: string[],
  maxJobs = 30
) {
  log.info("cwjobs_start", { keywords: keywords?.length ?? 0, mode: keywords ? "keyword" : "location" })
  return scrapeBoard(config, keywords, maxJobs)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  scrapeCwjobs()
    .then((jobs) => pushJobs(jobs, { label: "cwjobs" }))
    .catch(console.error)
}
