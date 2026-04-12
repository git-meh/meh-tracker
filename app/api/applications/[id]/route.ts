import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db"
import { applications } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { logger } from "@/lib/logger"

const updateSchema = z.object({
  notes: z.string().max(2000).optional(),
  resumeId: z.string().uuid().nullable().optional(),
  resumeVersionId: z.string().uuid().nullable().optional(),
  isPrivate: z.boolean().optional(),
  appliedAt: z.string().datetime().optional(),
  externalConfirmationUrl: z.string().url().nullable().optional(),
})

async function getOwnedApplication(id: string, userId: string) {
  const [app] = await db.select().from(applications).where(eq(applications.id, id)).limit(1)
  if (!app || app.userId !== userId) return null
  return app
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const app = await getOwnedApplication(id, user.id)
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(app)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const app = await getOwnedApplication(id, user.id)
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await request.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { appliedAt, ...rest } = parsed.data
  const [updated] = await db
    .update(applications)
    .set({
      ...rest,
      ...(appliedAt ? { appliedAt: new Date(appliedAt) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(applications.id, id))
    .returning()

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

  const app = await getOwnedApplication(id, user.id)
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await db.delete(applications).where(eq(applications.id, id))
  logger.info("application_deleted", { userId: user.id, applicationId: id })
  return new NextResponse(null, { status: 204 })
}
