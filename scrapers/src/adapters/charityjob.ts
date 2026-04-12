/**
 * CharityJob scraper (charityjob.co.uk).
 *
 * Largest UK charity and non-profit job board. Broad range of roles —
 * fundraising, social work, communications, finance, operations.
 */

import { fileURLToPath } from "url"
import { scrapeBoard, type BoardConfig } from "../lib/generic-board.js"
import { pushJobs } from "../lib/pusher.js"
import { log } from "../lib/log.js"

const CHARITY_SEARCH_TERMS: string[] = [
  "fundraiser",
  "fundraising manager",
  "communications manager",
  "social worker",
  "project manager",
  "finance manager",
  "hr manager",
  "marketing manager",
  "digital officer",
  "service manager",
  "data analyst",
  "policy officer",
  "programme manager",
  "volunteer coordinator",
  "chief executive",
  "operations manager",
  "administrator",
  "advocacy officer",
  "research officer",
]

const config: BoardConfig = {
  key: "charityjob",
  domain: "charityjob.co.uk",
  baseUrl: "https://www.charityjob.co.uk",
  isDetailUrl: (url) =>
    /charityjob\.co\.uk\/jobs\/[^/]+\/\d+/i.test(url),
  searchUrlTemplate:
    "https://www.charityjob.co.uk/jobs?keywords={keyword}",
  extractLinks: (html) => {
    const matches = [
      ...html.matchAll(/href="(\/jobs\/[^/]+\/\d+[^"?#]*)"/gi),
    ]
    return [...new Set(matches.map((m) => "https://www.charityjob.co.uk" + m[1]))]
  },
  defaultTags: ["Charity", "Non-Profit", "Third Sector"],
  sourceType: "approved_feed",
}

export async function scrapeCharityjob(
  keywords = CHARITY_SEARCH_TERMS,
  maxJobsPerKeyword = 15
) {
  log.info("charityjob_start", { keywords: keywords.length })
  return scrapeBoard(config, keywords, maxJobsPerKeyword)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  scrapeCharityjob()
    .then((jobs) => pushJobs(jobs, { label: "charityjob" }))
    .catch(console.error)
}
