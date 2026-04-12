import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db"
import { savedSearches } from "@/lib/db/schema"

async function getUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const [search] = await db
    .select()
    .from(savedSearches)
    .where(eq(savedSearches.id, id))
    .limit(1)

  if (!search || search.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await db.delete(savedSearches).where(eq(savedSearches.id, id))
  return new NextResponse(null, { status: 204 })
}
