import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const BATCH_SIZE = 20
const STALE_HOURS = 6

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  )

  const staleThreshold = new Date()
  staleThreshold.setHours(staleThreshold.getHours() - STALE_HOURS)

  // Fetch jobs that haven't been checked recently and aren't known-closed
  const { data: jobs, error } = await supabase
    .from("jobs")
    .select("id, url, availability")
    .neq("availability", "closed")
    .or(`last_checked.is.null,last_checked.lt.${staleThreshold.toISOString()}`)
    .limit(BATCH_SIZE)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  if (!jobs || jobs.length === 0) {
    return new Response(JSON.stringify({ checked: 0 }))
  }

  const results = await Promise.allSettled(
    jobs.map(async (job: { id: string; url: string; availability: string }) => {
      let availability = "unknown"

      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 8000)

        const res = await fetch(job.url, {
          method: "HEAD",
          signal: controller.signal,
          redirect: "follow",
          headers: { "User-Agent": "meh-tracker/1.0 (+https://meh-tracker.vercel.app)" },
        })

        clearTimeout(timeout)

        if (res.status === 404 || res.status === 410) {
          availability = "closed"
        } else if (res.ok || res.status === 405) {
          // 405 = Method Not Allowed but URL exists
          availability = "open"
        }
      } catch {
        // Network error / timeout — leave as unknown
      }

      await supabase
        .from("jobs")
        .update({ availability, last_checked: new Date().toISOString() })
        .eq("id", job.id)

      return { id: job.id, availability }
    })
  )

  const checked = results.filter((r) => r.status === "fulfilled").length
  return new Response(JSON.stringify({ checked, total: jobs.length }))
})
