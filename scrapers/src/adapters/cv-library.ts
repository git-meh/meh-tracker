/**
 * CV-Library scraper (cv-library.co.uk).
 *
 * Large UK job board, strong across all sectors.
 * Detail pages at /job/{id}/{slug}.
 */

import { fileURLToPath } from "url"
import { scrapeBoard, type BoardConfig } from "../lib/generic-board.js"
import { pushJobs } from "../lib/pusher.js"
import { log } from "../lib/log.js"

const config: BoardConfig = {
  key: "cv_library",
  domain: "cv-library.co.uk",
  baseUrl: "https://www.cv-library.co.uk",
  isDetailUrl: (url) =>
    /cv-library\.co\.uk\/job\/\d+/i.test(url) ||
    /cv-library\.co\.uk\/[\w-]+-job-\d+/i.test(url),
  searchUrlTemplate:
    "https://www.cv-library.co.uk/search-jobs?q={keyword}&country=1",
  extractLinks: (html) => {
    const matches = [
      ...html.matchAll(/href="(\/job\/\d+[^"?#]*)"/gi),
      ...html.matchAll(/href="(\/[\w-]+-job-\d+[^"?#]*)"/gi),
    ]
    return [...new Set(matches.map((m) => "https://www.cv-library.co.uk" + m[1]))]
  },
  defaultTags: ["CV-Library"],
  sourceType: "approved_feed",
}

export async function scrapeCvLibrary(
  keywords?: string[],
  maxJobs = 30
) {
  log.info("cv-library_start", { keywords: keywords?.length ?? 0, mode: keywords ? "keyword" : "location" })
  return scrapeBoard(config, keywords, maxJobs)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  scrapeCvLibrary()
    .then((jobs) => pushJobs(jobs, { label: "cv-library" }))
    .catch(console.error)
}
