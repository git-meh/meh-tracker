export const DEFAULT_INVITE_EXPIRY_DAYS = 7;
export const MIN_INVITE_EXPIRY_DAYS = 1;
export const MAX_INVITE_EXPIRY_DAYS = 30;

export type InviteFailureReason = "invalid" | "expired" | "used";
export type InviteLifecycleStatus = "active" | "expired" | "used";

const inviteFailureReasons: InviteFailureReason[] = [
  "invalid",
  "expired",
  "used"
];

type InviteLifecycleFields = {
  usedBy?: string | null;
  usedAt?: Date | string | null;
  expiresAt?: Date | string | null;
};

export function getInviterFirstName(name: string | null | undefined) {
  const trimmedName = name?.trim();
  return trimmedName ? trimmedName.split(/\s+/)[0] : null;
}

export function isInviteFailureReason(
  value: unknown
): value is InviteFailureReason {
  return inviteFailureReasons.includes(value as InviteFailureReason);
}

export function getInviteLifecycleStatus(
  invite: InviteLifecycleFields,
  now = new Date()
): InviteLifecycleStatus {
  if (invite.usedAt || invite.usedBy) return "used";

  if (
    invite.expiresAt &&
    new Date(invite.expiresAt).getTime() <= now.getTime()
  ) {
    return "expired";
  }

  return "active";
}
