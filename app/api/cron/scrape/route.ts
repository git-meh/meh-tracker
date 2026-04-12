import { NextResponse } from "next/server"

/**
 * GET /api/cron/scrape
 *
 * Triggered by Vercel Cron (configured in vercel.json) or called manually.
 * Runs the scraper scheduler inline using the same adapters as the scrapers/ package.
 *
 * Auth: Vercel automatically sets CRON_SECRET and passes it as a Bearer token.
 * Locally: call with ?secret=<CRON_SECRET> or Authorization: Bearer <CRON_SECRET>
 *
 * Schedule (set in vercel.json):
 *   Greenhouse + Lever: every 4 hours  → "0 *\/4 * * *"
 *   Reed + DWP: daily at 3am UTC       → "0 3 * * *"
 */

type ScraperResult = {
  adapter: string
  status: "ok" | "error"
  jobsFound?: number
  error?: string
}

export async function GET(request: Request): Promise<NextResponse> {
  // Verify cron secret
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

  const target = new URL(request.url).searchParams.get("adapter") ?? "fast"
  // "fast" = Greenhouse + Lever (JSON APIs, quick)
  // "html" = Reed + DWP (HTML scrapers, slower, run daily)
  // "all" = everything

  const results: ScraperResult[] = []

  async function runAdapter(name: string, fn: () => Promise<number>): Promise<void> {
    try {
      const count = await fn()
      results.push({ adapter: name, status: "ok", jobsFound: count })
    } catch (err) {
      results.push({
        adapter: name,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // Import dynamically to avoid bundling the full scraper tree into the Next.js bundle.
  // These imports resolve at runtime from the scrapers/ sibling package.
  // In production, scrapers should run as a separate service.
  // This cron route is a convenience trigger for small deployments.

  if (target === "fast" || target === "all") {
    await runAdapter("greenhouse", async () => {
      const { scrapeGreenhouse } = await import("../../../../scrapers/src/adapters/greenhouse.js")
      const { pushJobs } = await import("../../../../scrapers/src/lib/pusher.js")
      const companySlugs = await import("../../../../scrapers/src/company-list/greenhouse.json", {
        assert: { type: "json" },
      })
      const jobs = await scrapeGreenhouse(companySlugs.default as string[])
      // Override pusher to use internal URL (same process)
      process.env.APP_URL = appUrl
      process.env.JOB_INGESTION_API_KEY = ingestionKey
      await pushJobs(jobs, { label: "greenhouse-cron" })
      return jobs.length
    })

    await runAdapter("lever", async () => {
      const { scrapeLever } = await import("../../../../scrapers/src/adapters/lever.js")
      const { pushJobs } = await import("../../../../scrapers/src/lib/pusher.js")
      const companySlugs = await import("../../../../scrapers/src/company-list/lever.json", {
        assert: { type: "json" },
      })
      const jobs = await scrapeLever(companySlugs.default as string[])
      await pushJobs(jobs, { label: "lever-cron" })
      return jobs.length
    })
  }

  if (target === "html" || target === "all") {
    await runAdapter("reed", async () => {
      const { scrapeReed } = await import("../../../../scrapers/src/adapters/reed.js")
      const { pushJobs } = await import("../../../../scrapers/src/lib/pusher.js")
      const jobs = await scrapeReed(undefined, 2)
      await pushJobs(jobs, { label: "reed-cron" })
      return jobs.length
    })

    await runAdapter("dwp", async () => {
      const { scrapeDwp } = await import("../../../../scrapers/src/adapters/dwp.js")
      const { pushJobs } = await import("../../../../scrapers/src/lib/pusher.js")
      const jobs = await scrapeDwp(undefined, 2)
      await pushJobs(jobs, { label: "dwp-cron" })
      return jobs.length
    })
  }

  const hadErrors = results.some((r) => r.status === "error")
  return NextResponse.json(
    { ok: !hadErrors, results },
    { status: hadErrors ? 207 : 200 }
  )
}
