import { NextResponse } from "next/server"

/**
 * GET /api/cron/scrape?adapter=<group>
 *
 * Groups (set via ?adapter= param):
 *
 *   fast        Greenhouse + Lever — JSON APIs, completes in ~30s.
 *               Run frequently (every 4 h in vercel.json).
 *
 *   aggregators Indeed, Adzuna, Totaljobs, CV-Library, Monster, Reed
 *               Broad boards, all job types. Run daily.
 *
 *   sector      NHS, Council, DWP, Guardian, CWJobs, jobs.ac.uk, CharityJob
 *               Sector-specific boards. Run daily (staggered from aggregators).
 *
 *   all         Everything above in sequence.
 *               WARNING: will exceed Vercel's cron timeout on Hobby plan.
 *               Use only if you have a Pro plan or run scrapers externally.
 *
 * Auth: Vercel passes CRON_SECRET as Bearer token automatically.
 *       Manual trigger: ?secret=<CRON_SECRET>
 *
 * NOTE: HTML scrapers are slow (each detail page = ~2 s delay).
 * On Vercel Hobby (10 s timeout) use only "fast".
 * On Vercel Pro (300 s timeout) "aggregators" and "sector" are fine.
 * For full "all" runs, use the scrapers/ package directly on a VPS or
 * GitHub Actions (free) — see docs/deployment.md.
 */

type ScraperResult = {
  adapter: string
  status: "ok" | "error"
  jobsFound?: number
  error?: string
}

export async function GET(request: Request): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET?.trim()
  const authHeader = request.headers.get("authorization") ?? ""
  const secretParam = new URL(request.url).searchParams.get("secret") ?? ""
  const providedSecret = authHeader.replace(/^Bearer\s+/i, "").trim() || secretParam

  if (cronSecret && providedSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const ingestionKey = process.env.JOB_INGESTION_API_KEY

  if (!ingestionKey) {
    return NextResponse.json({ error: "JOB_INGESTION_API_KEY not configured" }, { status: 500 })
  }

  // Make sure pusher uses the correct URL and key (same process)
  process.env.APP_URL = appUrl
  process.env.JOB_INGESTION_API_KEY = ingestionKey

  const group = new URL(request.url).searchParams.get("adapter") ?? "fast"
  const results: ScraperResult[] = []

  async function run(name: string, fn: () => Promise<number>) {
    try {
      results.push({ adapter: name, status: "ok", jobsFound: await fn() })
    } catch (err) {
      results.push({
        adapter: name,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // ── fast: Greenhouse + Lever ────────────────────────────────────────────────
  if (group === "fast" || group === "all") {
    await run("greenhouse", async () => {
      const { scrapeGreenhouse } = await import("../../../../scrapers/src/adapters/greenhouse.js")
      const { pushJobs } = await import("../../../../scrapers/src/lib/pusher.js")
      const slugs = (await import("../../../../scrapers/src/company-list/greenhouse.json")).default as string[]
      const jobs = await scrapeGreenhouse(slugs)
      await pushJobs(jobs, { label: "greenhouse-cron" })
      return jobs.length
    })

    await run("lever", async () => {
      const { scrapeLever } = await import("../../../../scrapers/src/adapters/lever.js")
      const { pushJobs } = await import("../../../../scrapers/src/lib/pusher.js")
      const slugs = (await import("../../../../scrapers/src/company-list/lever.json")).default as string[]
      const jobs = await scrapeLever(slugs)
      await pushJobs(jobs, { label: "lever-cron" })
      return jobs.length
    })
  }

  // ── aggregators: major broad boards ────────────────────────────────────────
  if (group === "aggregators" || group === "all") {
    const { pushJobs } = await import("../../../../scrapers/src/lib/pusher.js")

    await run("indeed", async () => {
      const { scrapeIndeed } = await import("../../../../scrapers/src/adapters/indeed.js")
      const jobs = await scrapeIndeed(undefined, 10)
      await pushJobs(jobs, { label: "indeed-cron" })
      return jobs.length
    })

    await run("adzuna", async () => {
      const { scrapeAdzuna } = await import("../../../../scrapers/src/adapters/adzuna.js")
      const jobs = await scrapeAdzuna(undefined, 10)
      await pushJobs(jobs, { label: "adzuna-cron" })
      return jobs.length
    })

    await run("totaljobs", async () => {
      const { scrapeTotaljobs } = await import("../../../../scrapers/src/adapters/totaljobs.js")
      const jobs = await scrapeTotaljobs(undefined, 10)
      await pushJobs(jobs, { label: "totaljobs-cron" })
      return jobs.length
    })

    await run("cv-library", async () => {
      const { scrapeCvLibrary } = await import("../../../../scrapers/src/adapters/cv-library.js")
      const jobs = await scrapeCvLibrary(undefined, 10)
      await pushJobs(jobs, { label: "cv-library-cron" })
      return jobs.length
    })

    await run("monster", async () => {
      const { scrapeMonster } = await import("../../../../scrapers/src/adapters/monster.js")
      const jobs = await scrapeMonster(undefined, 10)
      await pushJobs(jobs, { label: "monster-cron" })
      return jobs.length
    })

    await run("reed", async () => {
      const { scrapeReed } = await import("../../../../scrapers/src/adapters/reed.js")
      const jobs = await scrapeReed(undefined, 2)
      await pushJobs(jobs, { label: "reed-cron" })
      return jobs.length
    })
  }

  // ── sector: specialist boards ───────────────────────────────────────────────
  if (group === "sector" || group === "all") {
    const { pushJobs } = await import("../../../../scrapers/src/lib/pusher.js")

    await run("cwjobs", async () => {
      const { scrapeCwjobs } = await import("../../../../scrapers/src/adapters/cwjobs.js")
      const jobs = await scrapeCwjobs(undefined, 10)
      await pushJobs(jobs, { label: "cwjobs-cron" })
      return jobs.length
    })

    await run("guardian", async () => {
      const { scrapeGuardian } = await import("../../../../scrapers/src/adapters/guardian.js")
      const jobs = await scrapeGuardian(undefined, 10)
      await pushJobs(jobs, { label: "guardian-cron" })
      return jobs.length
    })

    await run("nhs", async () => {
      const { scrapeNhs } = await import("../../../../scrapers/src/adapters/nhs.js")
      const jobs = await scrapeNhs(undefined, 2)
      await pushJobs(jobs, { label: "nhs-cron" })
      return jobs.length
    })

    await run("council", async () => {
      const { scrapeCouncil } = await import("../../../../scrapers/src/adapters/council.js")
      const jobs = await scrapeCouncil(undefined, 2)
      await pushJobs(jobs, { label: "council-cron" })
      return jobs.length
    })

    await run("dwp", async () => {
      const { scrapeDwp } = await import("../../../../scrapers/src/adapters/dwp.js")
      const jobs = await scrapeDwp(undefined, 2)
      await pushJobs(jobs, { label: "dwp-cron" })
      return jobs.length
    })

    await run("jobs-ac-uk", async () => {
      const { scrapeJobsAcUk } = await import("../../../../scrapers/src/adapters/jobs-ac-uk.js")
      const jobs = await scrapeJobsAcUk(undefined, 10)
      await pushJobs(jobs, { label: "jobs-ac-uk-cron" })
      return jobs.length
    })

    await run("charityjob", async () => {
      const { scrapeCharityjob } = await import("../../../../scrapers/src/adapters/charityjob.js")
      const jobs = await scrapeCharityjob(undefined, 10)
      await pushJobs(jobs, { label: "charityjob-cron" })
      return jobs.length
    })
  }

  if (results.length === 0) {
    return NextResponse.json(
      { error: `Unknown adapter group "${group}". Use: fast, aggregators, sector, all` },
      { status: 400 }
    )
  }

  const hadErrors = results.some((r) => r.status === "error")
  return NextResponse.json({ ok: !hadErrors, group, results }, { status: hadErrors ? 207 : 200 })
}
