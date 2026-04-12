/**
 * Jobs.ac.uk scraper — academic, research, and higher education roles.
 *
 * Covers universities, research institutes, and education sector employers.
 * Detail pages at /jobs/{id}/{slug}
 */

import { fileURLToPath } from "url"
import { scrapeBoard, type BoardConfig } from "../lib/generic-board.js"
import { pushJobs } from "../lib/pusher.js"
import { log } from "../lib/log.js"

// Academic-focused search terms
const ACADEMIC_SEARCH_TERMS: string[] = [
  "lecturer",
  "professor",
  "researcher",
  "research fellow",
  "postdoctoral researcher",
  "teaching fellow",
  "academic",
  "data scientist",
  "software engineer",
  "it manager",
  "systems administrator",
  "research engineer",
  "laboratory technician",
  "student services",
  "admissions officer",
  "librarian",
  "finance officer",
  "hr advisor",
  "project manager",
  "communications officer",
]

const config: BoardConfig = {
  key: "jobs_ac_uk",
  domain: "jobs.ac.uk",
  baseUrl: "https://www.jobs.ac.uk",
  isDetailUrl: (url) =>
    /jobs\.ac\.uk\/job\/\w+/i.test(url),
  searchUrlTemplate:
    "https://www.jobs.ac.uk/search/?keywords={keyword}&location=United+Kingdom",
  extractLinks: (html) => {
    const matches = [
      ...html.matchAll(/href="(\/job\/[^"?#]+)"/gi),
    ]
    return [...new Set(matches.map((m) => "https://www.jobs.ac.uk" + m[1]))]
  },
  defaultTags: ["Academic", "Higher Education", "Research"],
  sourceType: "approved_feed",
}

export async function scrapeJobsAcUk(
  keywords = ACADEMIC_SEARCH_TERMS,
  maxJobsPerKeyword = 15
) {
  log.info("jobs_ac_uk_start", { keywords: keywords.length })
  return scrapeBoard(config, keywords, maxJobsPerKeyword)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  scrapeJobsAcUk()
    .then((jobs) => pushJobs(jobs, { label: "jobs-ac-uk" }))
    .catch(console.error)
}
