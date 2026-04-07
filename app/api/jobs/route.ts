import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db"
import { jobs } from "@/lib/db/schema"
import { desc } from "drizzle-orm"

const createJobSchema = z.object({
  url: z.string().url(),
  title: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  salaryRange: z.string().max(100).optional(),
  location: z.string().max(200).optional(),
  tags: z.array(z.string().max(50)).max(10).default([]),
})

function deriveFromUrl(url: string) {
  try {
    const { hostname, pathname } = new URL(url)
    const host = hostname.replace(/^www\./, "")
    const slug = pathname.split("/").filter(Boolean).pop() ?? ""
    const title = slug
      ? slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : host
    return { title, company: host }
  } catch {
    return { title: url, company: "Unknown" }
  }
}

export async function GET() {
  const allJobs = await db.select().from(jobs).orderBy(desc(jobs.createdAt))
  return NextResponse.json(allJobs)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = createJobSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const derived = deriveFromUrl(parsed.data.url)
  const [job] = await db
    .insert(jobs)
    .values({
      ...parsed.data,
      title: parsed.data.title || derived.title,
      company: parsed.data.company || derived.company,
      postedBy: user.id,
    })
    .returning()

  return NextResponse.json(job, { status: 201 })
}
