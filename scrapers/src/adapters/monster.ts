/**
 * Monster UK scraper (monster.co.uk / monster.com).
 *
 * Global board with strong UK presence. Detail pages include JSON-LD.
 */

import { fileURLToPath } from "url"
import { scrapeBoard, type BoardConfig } from "../lib/generic-board.js"
import { pushJobs } from "../lib/pusher.js"
import { log } from "../lib/log.js"

const config: BoardConfig = {
  key: "monster",
  domain: "monster.co.uk",
  baseUrl: "https://www.monster.co.uk",
  isDetailUrl: (url) =>
    /monster\.co\.uk\/job-openings\//i.test(url) ||
    /monster\.co\.uk\/jobs\/search\/\d+/i.test(url),
  searchUrlTemplate:
    "https://www.monster.co.uk/jobs/search/?q={keyword}&where=United+Kingdom",
  extractLinks: (html) => {
    const matches = [
      ...html.matchAll(/href="(\/job-openings\/[^"?#]+)"/gi),
    ]
    return [...new Set(matches.map((m) => "https://www.monster.co.uk" + m[1]))]
  },
  defaultTags: ["Monster"],
  sourceType: "approved_feed",
}

export async function scrapeMonster(
  keywords?: string[],
  maxJobs = 30
) {
  log.info("monster_start", { keywords: keywords?.length ?? 0, mode: keywords ? "keyword" : "location" })
  return scrapeBoard(config, keywords, maxJobs)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  scrapeMonster()
    .then((jobs) => pushJobs(jobs, { label: "monster" }))
    .catch(console.error)
}
