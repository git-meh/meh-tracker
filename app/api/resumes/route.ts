import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db"
import { resumes } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ["application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userResumes = await db.select().from(resumes).where(eq(resumes.userId, user.id))
  return NextResponse.json(userResumes)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Ensure profile exists (handles users created before the trigger was in place)
  await supabase.from("profiles").upsert({
    id: user.id,
    name: user.user_metadata?.name ?? user.email?.split("@")[0] ?? "User",
    avatar_url: user.user_metadata?.avatar_url ?? null,
  }, { onConflict: "id", ignoreDuplicates: true })

  const formData = await request.formData()
  const file = formData.get("file") as File | null

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Only PDF and Word documents allowed" }, { status: 400 })
  }

  const ext = file.name.split(".").pop()
  const storagePath = `${user.id}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from("resumes")
    .upload(storagePath, file, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // Store the storage path (not a public URL - bucket is private, use signed URLs to view)
  const [resume] = await db
    .insert(resumes)
    .values({
      userId: user.id,
      fileName: file.name,
      fileUrl: storagePath,
      fileSize: file.size,
    })
    .returning()

  return NextResponse.json(resume, { status: 201 })
}
