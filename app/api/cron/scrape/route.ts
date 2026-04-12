import { NextResponse } from "next/server"

/**
 * GET /api/cron/scrape
 *
 * Lightweight status endpoint for the scraper system.
 * Actual scraper execution happens in the GitHub Actions workflow
 * (`.github/workflows/scrapers.yml`) which runs the scrapers package
 * directly and pushes results to `/api/job-sources/ingest`.
 *
 * This endpoint exists so the digest cron and health checks have
 * something to call. It can also be used as a manual trigger proxy.
 */

export async function GET(request: Request): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET?.trim()
  const authHeader = request.headers.get("authorization") ?? ""
  const secretParam = new URL(request.url).searchParams.get("secret") ?? ""
  const providedSecret = authHeader.replace(/^Bearer\s+/i, "").trim() || secretParam

  if (cronSecret && providedSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.json({
    ok: true,
    message: "Scraper runs are handled by GitHub Actions. Use the workflow_dispatch trigger or check the Actions tab.",
    docs: "See .github/workflows/scrapers.yml for schedule and adapter groups.",
  })
}
