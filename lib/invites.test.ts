/// <reference types="bun" />

import { describe, expect, test } from "bun:test";
import {
  DEFAULT_INVITE_EXPIRY_DAYS,
  getInviteLifecycleStatus,
  getInviterFirstName,
  isInviteFailureReason
} from "@/lib/invites";
import {
  createInviteExpiry,
  createInviteSchema,
  generateInviteCode
} from "@/lib/invites.server";

describe("getInviterFirstName", () => {
  test("returns the first non-empty name token", () => {
    expect(getInviterFirstName("  Alex Morgan  ")).toBe("Alex");
  });

  test("returns null when no usable name is available", () => {
    expect(getInviterFirstName("   ")).toBeNull();
    expect(getInviterFirstName(null)).toBeNull();
  });
});

test("recognises only supported invite failure reasons", () => {
  expect(isInviteFailureReason("expired")).toBe(true);
  expect(isInviteFailureReason("unexpected")).toBe(false);
});

describe("getInviteLifecycleStatus", () => {
  const now = new Date("2026-09-11T12:00:00.000Z");

  test("marks an unused future invite as active", () => {
    expect(
      getInviteLifecycleStatus({ expiresAt: "2026-09-12T12:00:00.000Z" }, now)
    ).toBe("active");
  });

  test("marks an elapsed invite as expired", () => {
    expect(
      getInviteLifecycleStatus({ expiresAt: "2026-09-10T12:00:00.000Z" }, now)
    ).toBe("expired");
  });

  test("marks an invite expiring now as expired", () => {
    expect(
      getInviteLifecycleStatus({ expiresAt: "2026-09-11T12:00:00.000Z" }, now)
    ).toBe("expired");
  });

  test("treats usage as authoritative even after expiry", () => {
    expect(
      getInviteLifecycleStatus(
        {
          usedAt: "2026-09-09T12:00:00.000Z",
          expiresAt: "2026-09-10T12:00:00.000Z"
        },
        now
      )
    ).toBe("used");
  });
});

describe("invite creation", () => {
  test("accepts the default and configured expiry range", () => {
    expect(createInviteSchema.parse({}).expiresInDays).toBeUndefined();
    expect(createInviteSchema.parse({ expiresInDays: 1 }).expiresInDays).toBe(
      1
    );
    expect(createInviteSchema.parse({ expiresInDays: 30 }).expiresInDays).toBe(
      30
    );
    expect(DEFAULT_INVITE_EXPIRY_DAYS).toBe(7);
  });

  test("rejects invalid expiry values", () => {
    expect(createInviteSchema.safeParse({ expiresInDays: 0 }).success).toBe(
      false
    );
    expect(createInviteSchema.safeParse({ expiresInDays: 31 }).success).toBe(
      false
    );
    expect(createInviteSchema.safeParse({ expiresInDays: 1.5 }).success).toBe(
      false
    );
    expect(createInviteSchema.safeParse({ expiresInDays: "7" }).success).toBe(
      false
    );
  });

  test("generates a 128-bit hexadecimal invite code", () => {
    expect(generateInviteCode()).toMatch(/^[a-f0-9]{32}$/);
  });

  test("adds an exact number of 24-hour days to the expiry", () => {
    const now = new Date("2026-10-24T12:00:00.000Z");
    expect(createInviteExpiry(7, now).toISOString()).toBe(
      "2026-10-31T12:00:00.000Z"
    );
  });
});
