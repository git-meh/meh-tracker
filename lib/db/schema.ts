import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
} from "drizzle-orm/pg-core"

// ─── Enums ────────────────────────────────────────────────────────────────────

export const visibilityEnum = pgEnum("visibility", ["public", "private"])

export const availabilityEnum = pgEnum("availability", [
  "open",
  "closed",
  "unknown",
])

export const applicationStatusEnum = pgEnum("application_status", [
  "saved",
  "applied",
  "oa",
  "phone_screen",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
])

// ─── Tables ───────────────────────────────────────────────────────────────────

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // references auth.users.id
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  visibility: visibilityEnum("visibility").notNull().default("public"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  usedBy: uuid("used_by").references(() => profiles.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  company: text("company").notNull(),
  url: text("url").notNull(),
  description: text("description"),
  salaryRange: text("salary_range"),
  location: text("location"),
  tags: text("tags").array().notNull().default([]),
  postedBy: uuid("posted_by").references(() => profiles.id, {
    onDelete: "set null",
  }),
  availability: availabilityEnum("availability").notNull().default("unknown"),
  lastChecked: timestamp("last_checked", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const resumes = pgTable("resumes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const applications = pgTable("applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  jobId: uuid("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  resumeId: uuid("resume_id").references(() => resumes.id, {
    onDelete: "set null",
  }),
  status: applicationStatusEnum("status").notNull().default("saved"),
  notes: text("notes"),
  isPrivate: boolean("is_private").notNull().default(false),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const applicationStatusHistory = pgTable("application_status_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id")
    .notNull()
    .references(() => applications.id, { onDelete: "cascade" }),
  fromStatus: applicationStatusEnum("from_status"),
  toStatus: applicationStatusEnum("to_status").notNull(),
  note: text("note"),
  changedAt: timestamp("changed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  changedBy: uuid("changed_by")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
})

// ─── Type exports ─────────────────────────────────────────────────────────────

export type Profile = typeof profiles.$inferSelect
export type Job = typeof jobs.$inferSelect
export type Resume = typeof resumes.$inferSelect
export type Application = typeof applications.$inferSelect
export type ApplicationStatusHistory =
  typeof applicationStatusHistory.$inferSelect
export type Invite = typeof invites.$inferSelect

export type InsertJob = typeof jobs.$inferInsert
export type InsertApplication = typeof applications.$inferInsert
export type InsertResume = typeof resumes.$inferInsert
export type InsertInvite = typeof invites.$inferInsert

export type ApplicationStatus = (typeof applicationStatusEnum.enumValues)[number]
export type Availability = (typeof availabilityEnum.enumValues)[number]
