import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db"
import { jobs } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

const updateJobSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  company: z.string().min(1).max(200).optional(),
  url: z.string().url().optional(),
  description: z.string().max(5000).optional(),
  salaryRange: z.string().max(100).optional(),
  location: z.string().max(200).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  availability: z.enum(["open", "closed", "unknown"]).optional(),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1)
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(job)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1)
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (job.postedBy !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const parsed = updateJobSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const [updated] = await db.update(jobs).set(parsed.data).where(eq(jobs.id, id)).returning()
  return NextResponse.json(updated)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1)
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (job.postedBy !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await db.delete(jobs).where(eq(jobs.id, id))
  return new NextResponse(null, { status: 204 })
}
