import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db"
import { invites } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { randomBytes } from "crypto"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")

  if (code) {
    const [invite] = await db
      .select()
      .from(invites)
      .where(eq(invites.code, code))
      .limit(1)

    if (!invite) return NextResponse.json({ error: "Invalid code" }, { status: 404 })
    if (invite.usedBy) return NextResponse.json({ error: "Already used" }, { status: 410 })
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      return NextResponse.json({ error: "Expired" }, { status: 410 })
    }

    return NextResponse.json({ valid: true })
  }

  // List your own invites
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const myInvites = await db.select().from(invites).where(eq(invites.createdBy, user.id))
  return NextResponse.json(myInvites)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const expiresInDays = body.expiresInDays ?? 7

  const code = randomBytes(8).toString("hex")
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + expiresInDays)

  const [invite] = await db
    .insert(invites)
    .values({ code, createdBy: user.id, expiresAt })
    .returning()

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${invite.code}`
  return NextResponse.json({ ...invite, url: inviteUrl }, { status: 201 })
}
