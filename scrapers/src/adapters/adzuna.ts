/**
 * Adzuna scraper (adzuna.co.uk).
 *
 * Adzuna aggregates from hundreds of job boards — great breadth.
 * Detail pages include JSON-LD. URLs: /jobs/en-gb/ads/{id}/{slug}
 */

import { fileURLToPath } from "url"
import { scrapeBoard, type BoardConfig } from "../lib/generic-board.js"
import { pushJobs } from "../lib/pusher.js"
import { log } from "../lib/log.js"

const config: BoardConfig = {
  key: "adzuna",
  domain: "adzuna.co.uk",
  baseUrl: "https://www.adzuna.co.uk",
  isDetailUrl: (url) =>
    /adzuna\.co\.uk\/jobs\/en-gb\/ads\/\d+/i.test(url),
  searchUrlTemplate:
    "https://www.adzuna.co.uk/search?q={keyword}&loc=United+Kingdom",
  extractLinks: (html) => {
    const matches = [
      ...html.matchAll(/href="(\/jobs\/en-gb\/ads\/\d+[^"?#]*)"/gi),
    ]
    return [...new Set(matches.map((m) => "https://www.adzuna.co.uk" + m[1]))]
  },
  defaultTags: ["Adzuna"],
  sourceType: "approved_feed",
}

export async function scrapeAdzuna(
  keywords?: string[],
  maxJobs = 30
) {
  log.info("adzuna_start", { keywords: keywords?.length ?? 0, mode: keywords ? "keyword" : "location" })
  return scrapeBoard(config, keywords, maxJobs)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  scrapeAdzuna()
    .then((jobs) => pushJobs(jobs, { label: "adzuna" }))
    .catch(console.error)
}
