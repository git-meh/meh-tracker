import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db"
import { resumes } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [resume] = await db.select().from(resumes).where(eq(resumes.id, id)).limit(1)
  if (!resume || resume.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Normalise to storage path - handle both old (full URL) and new (path only) formats
  let storagePath = resume.fileUrl
  const marker = "/object/public/resumes/"
  if (storagePath.includes(marker)) {
    storagePath = storagePath.split(marker)[1]
  }
  await supabase.storage.from("resumes").remove([storagePath])

  await db.delete(resumes).where(eq(resumes.id, id))
  return new NextResponse(null, { status: 204 })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [resume] = await db.select().from(resumes).where(eq(resumes.id, id)).limit(1)
  if (!resume || resume.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = await request.json()
  const schema = z.object({ isDefault: z.boolean() })
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  if (parsed.data.isDefault) {
    // Unset all other defaults first
    await db
      .update(resumes)
      .set({ isDefault: false })
      .where(eq(resumes.userId, user.id))
  }

  const [updated] = await db
    .update(resumes)
    .set({ isDefault: parsed.data.isDefault })
    .where(eq(resumes.id, id))
    .returning()

  return NextResponse.json(updated)
}
