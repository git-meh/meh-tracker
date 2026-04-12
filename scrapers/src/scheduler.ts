/**
 * Scraper scheduler — runs all adapters in sequence.
 *
 * Usage:
 *   npx tsx src/scheduler.ts              (run all)
 *   npx tsx src/scheduler.ts indeed       (run one adapter by key)
 *
 * Or trigger via GET /api/cron/scrape in the Next.js app.
 *
 * Adapter groups:
 *   fast  — JSON APIs (Greenhouse, Lever)
 *   broad — Major aggregators (Indeed, Adzuna, Totaljobs, CV-Library, Monster, Reed)
 *   sector — Sector-specific boards (NHS, Council/lgjobs, Guardian, CWJobs, jobs.ac.uk, CharityJob, DWP)
 */

import { scrapeGreenhouse } from "./adapters/greenhouse.js"
import { scrapeLever } from "./adapters/lever.js"
import { scrapeReed } from "./adapters/reed.js"
import { scrapeDwp } from "./adapters/dwp.js"
import { scrapeNhs } from "./adapters/nhs.js"
import { scrapeCouncil } from "./adapters/council.js"
import { scrapeIndeed } from "./adapters/indeed.js"
import { scrapeTotaljobs } from "./adapters/totaljobs.js"
import { scrapeCvLibrary } from "./adapters/cv-library.js"
import { scrapeGuardian } from "./adapters/guardian.js"
import { scrapeCwjobs } from "./adapters/cwjobs.js"
import { scrapeAdzuna } from "./adapters/adzuna.js"
import { scrapeMonster } from "./adapters/monster.js"
import { scrapeJobsAcUk } from "./adapters/jobs-ac-uk.js"
import { scrapeCharityjob } from "./adapters/charityjob.js"
import { pushJobs } from "./lib/pusher.js"
import { log } from "./lib/log.js"
import { sleep } from "./lib/fetch.js"
import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Adapter runners ────────────────────────────────────────────────────────

async function runGreenhouse(): Promise<void> {
  log.info("scheduler_adapter_start", { adapter: "greenhouse" })
  const slugs: string[] = JSON.parse(
    readFileSync(join(__dirname, "company-list/greenhouse.json"), "utf-8")
  )
  const jobs = await scrapeGreenhouse(slugs)
  await pushJobs(jobs, { label: "greenhouse" })
}

async function runLever(): Promise<void> {
  log.info("scheduler_adapter_start", { adapter: "lever" })
  const slugs: string[] = JSON.parse(
    readFileSync(join(__dirname, "company-list/lever.json"), "utf-8")
  )
  const jobs = await scrapeLever(slugs)
  await pushJobs(jobs, { label: "lever" })
}

async function runReed(): Promise<void> {
  log.info("scheduler_adapter_start", { adapter: "reed" })
  const jobs = await scrapeReed(undefined, 2)
  await pushJobs(jobs, { label: "reed" })
}

async function runDwp(): Promise<void> {
  log.info("scheduler_adapter_start", { adapter: "dwp" })
  const jobs = await scrapeDwp(undefined, 2)
  await pushJobs(jobs, { label: "dwp" })
}

async function runNhs(): Promise<void> {
  log.info("scheduler_adapter_start", { adapter: "nhs" })
  const jobs = await scrapeNhs(undefined, 2)
  await pushJobs(jobs, { label: "nhs" })
}

async function runCouncil(): Promise<void> {
  log.info("scheduler_adapter_start", { adapter: "council" })
  const jobs = await scrapeCouncil(undefined, 2)
  await pushJobs(jobs, { label: "council" })
}

async function runIndeed(): Promise<void> {
  log.info("scheduler_adapter_start", { adapter: "indeed" })
  const jobs = await scrapeIndeed(undefined, 10)
  await pushJobs(jobs, { label: "indeed" })
}

async function runTotaljobs(): Promise<void> {
  log.info("scheduler_adapter_start", { adapter: "totaljobs" })
  const jobs = await scrapeTotaljobs(undefined, 10)
  await pushJobs(jobs, { label: "totaljobs" })
}

async function runCvLibrary(): Promise<void> {
  log.info("scheduler_adapter_start", { adapter: "cv-library" })
  const jobs = await scrapeCvLibrary(undefined, 10)
  await pushJobs(jobs, { label: "cv-library" })
}

async function runGuardian(): Promise<void> {
  log.info("scheduler_adapter_start", { adapter: "guardian" })
  const jobs = await scrapeGuardian(undefined, 10)
  await pushJobs(jobs, { label: "guardian" })
}

async function runCwjobs(): Promise<void> {
  log.info("scheduler_adapter_start", { adapter: "cwjobs" })
  const jobs = await scrapeCwjobs(undefined, 10)
  await pushJobs(jobs, { label: "cwjobs" })
}

async function runAdzuna(): Promise<void> {
  log.info("scheduler_adapter_start", { adapter: "adzuna" })
  const jobs = await scrapeAdzuna(undefined, 10)
  await pushJobs(jobs, { label: "adzuna" })
}

async function runMonster(): Promise<void> {
  log.info("scheduler_adapter_start", { adapter: "monster" })
  const jobs = await scrapeMonster(undefined, 10)
  await pushJobs(jobs, { label: "monster" })
}

async function runJobsAcUk(): Promise<void> {
  log.info("scheduler_adapter_start", { adapter: "jobs-ac-uk" })
  const jobs = await scrapeJobsAcUk(undefined, 10)
  await pushJobs(jobs, { label: "jobs-ac-uk" })
}

async function runCharityjob(): Promise<void> {
  log.info("scheduler_adapter_start", { adapter: "charityjob" })
  const jobs = await scrapeCharityjob(undefined, 10)
  await pushJobs(jobs, { label: "charityjob" })
}

// ─── Registry ────────────────────────────────────────────────────────────────

const ADAPTERS: Record<string, () => Promise<void>> = {
  greenhouse: runGreenhouse,
  lever: runLever,
  reed: runReed,
  dwp: runDwp,
  nhs: runNhs,
  council: runCouncil,
  indeed: runIndeed,
  totaljobs: runTotaljobs,
  "cv-library": runCvLibrary,
  guardian: runGuardian,
  cwjobs: runCwjobs,
  adzuna: runAdzuna,
  monster: runMonster,
  "jobs-ac-uk": runJobsAcUk,
  charityjob: runCharityjob,
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const target = process.argv[2]?.toLowerCase()

  if (target && ADAPTERS[target]) {
    await ADAPTERS[target]()
    return
  }

  if (target) {
    log.error("scheduler_unknown_adapter", { target, available: Object.keys(ADAPTERS) })
    process.exit(1)
  }

  const start = Date.now()

  // ── Group 1: Fast JSON/ATS scrapers ───────────────────────────────────────
  log.info("scheduler_group_start", { group: "ats" })
  await runGreenhouse()
  await sleep(5000)
  await runLever()
  await sleep(5000)

  // ── Group 2: Major aggregators ────────────────────────────────────────────
  log.info("scheduler_group_start", { group: "aggregators" })
  await runIndeed()
  await sleep(8000)
  await runAdzuna()
  await sleep(8000)
  await runReed()
  await sleep(8000)
  await runTotaljobs()
  await sleep(8000)
  await runCvLibrary()
  await sleep(8000)
  await runMonster()
  await sleep(8000)

  // ── Group 3: Sector-specific boards ──────────────────────────────────────
  log.info("scheduler_group_start", { group: "sector" })
  await runCwjobs()
  await sleep(5000)
  await runGuardian()
  await sleep(5000)
  await runNhs()
  await sleep(5000)
  await runCouncil()
  await sleep(5000)
  await runDwp()
  await sleep(5000)
  await runJobsAcUk()
  await sleep(5000)
  await runCharityjob()

  const elapsed = Math.round((Date.now() - start) / 1000)
  log.info("scheduler_done", { elapsed, adapters: Object.keys(ADAPTERS).length })
}

main().catch((err) => {
  console.error("Scheduler failed:", err)
  process.exit(1)
})
