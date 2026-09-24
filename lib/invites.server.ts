import { randomBytes } from "node:crypto";
import { z } from "zod";
import { MAX_INVITE_EXPIRY_DAYS, MIN_INVITE_EXPIRY_DAYS } from "@/lib/invites";

export const createInviteSchema = z
  .object({
    expiresInDays: z
      .number()
      .int()
      .min(MIN_INVITE_EXPIRY_DAYS)
      .max(MAX_INVITE_EXPIRY_DAYS)
      .optional()
  })
  .strict();

export const deleteInviteSchema = z.object({
  id: z.string().uuid()
});

export function generateInviteCode() {
  return randomBytes(16).toString("hex");
}

export function createInviteExpiry(expiresInDays: number, now = new Date()) {
  return new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);
}
