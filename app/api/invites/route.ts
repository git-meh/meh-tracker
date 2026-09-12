import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { invites, profiles } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import {
  DEFAULT_INVITE_EXPIRY_DAYS,
  getInviteLifecycleStatus,
  getInviterFirstName,
  type InviteFailureReason
} from "@/lib/invites";
import {
  createInviteExpiry,
  createInviteSchema,
  deleteInviteSchema,
  generateInviteCode
} from "@/lib/invites.server";

const inviteFailureMessages: Record<InviteFailureReason, string> = {
  invalid: "This invite link is invalid.",
  expired: "This invite link has expired.",
  used: "This invite link has already been used."
};

function inviteFailureResponse(reason: InviteFailureReason, status: 404 | 410) {
  return NextResponse.json(
    { valid: false, reason, message: inviteFailureMessages[reason] },
    { status }
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (searchParams.has("code")) {
    if (!code) return inviteFailureResponse("invalid", 404);

    const [invite] = await db
      .select({
        usedBy: invites.usedBy,
        usedAt: invites.usedAt,
        expiresAt: invites.expiresAt,
        inviterName: profiles.name
      })
      .from(invites)
      .leftJoin(profiles, eq(invites.createdBy, profiles.id))
      .where(eq(invites.code, code))
      .limit(1);

    if (!invite) return inviteFailureResponse("invalid", 404);

    const lifecycleStatus = getInviteLifecycleStatus(invite);
    if (lifecycleStatus === "used") return inviteFailureResponse("used", 410);
    if (lifecycleStatus === "expired")
      return inviteFailureResponse("expired", 410);

    return NextResponse.json({
      valid: true,
      inviterFirstName: getInviterFirstName(invite.inviterName)
    });
  }

  // List your own invites
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const myInvites = await db
    .select()
    .from(invites)
    .where(eq(invites.createdBy, user.id))
    .orderBy(desc(invites.createdAt));
  return NextResponse.json(myInvites);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = createInviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Expiry must be a whole number from 1 to 30 days" },
      { status: 400 }
    );
  }

  const expiresInDays = parsed.data.expiresInDays ?? DEFAULT_INVITE_EXPIRY_DAYS;

  const code = generateInviteCode();
  const expiresAt = createInviteExpiry(expiresInDays);

  const [invite] = await db
    .insert(invites)
    .values({ code, createdBy: user.id, expiresAt })
    .returning();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const inviteUrl = new URL(`/invite/${invite.code}`, appUrl).toString();
  return NextResponse.json({ ...invite, url: inviteUrl }, { status: 201 });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = deleteInviteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "A valid invite ID is required" },
      {
        status: 400
      }
    );
  }

  const [deletedInvite] = await db
    .delete(invites)
    .where(and(eq(invites.id, parsed.data.id), eq(invites.createdBy, user.id)))
    .returning({ id: invites.id });

  if (!deletedInvite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  return NextResponse.json({ id: deletedInvite.id });
}
