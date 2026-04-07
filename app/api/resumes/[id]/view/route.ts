import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { db } from "@/lib/db"
import { resumes } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

const PDF_TYPES = [".pdf"]

export async function GET(
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

  // Normalise to storage path — handle both old (full URL) and new (path only) formats
  let storagePath = resume.fileUrl
  const marker = "/object/public/resumes/"
  if (storagePath.includes(marker)) {
    storagePath = storagePath.split(marker)[1]
  }

  const ext = resume.fileName.split(".").pop()?.toLowerCase() ?? ""
  const isPdf = PDF_TYPES.includes(`.${ext}`)

  // Use admin client to generate signed URL — bypasses RLS for private bucket access
  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from("resumes")
    .createSignedUrl(storagePath, 60 * 60, {
      download: isPdf ? false : resume.fileName, // PDFs open in browser, others download with original name
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.redirect(data.signedUrl)
}
