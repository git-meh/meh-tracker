import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
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

export const jobSourceTypeEnum = pgEnum("job_source_type", [
  "manual",
  "approved_feed",
  "employer_site",
  "ats",
])

export const visaSponsorshipStatusEnum = pgEnum("visa_sponsorship_status", [
  "eligible",
  "possible",
  "not_available",
  "unknown",
])

export const workModeEnum = pgEnum("work_mode", [
  "remote",
  "hybrid",
  "onsite",
  "unknown",
])

export const employmentTypeEnum = pgEnum("employment_type", [
  "full_time",
  "part_time",
  "contract",
  "internship",
  "temporary",
  "apprenticeship",
  "unknown",
])

export const applyAdapterEnum = pgEnum("apply_adapter", [
  "none",
  "greenhouse",
  "lever",
  "workday",
  "ashby",
  "smartrecruiters",
  "manual_external",
])

export const ingestionRunStatusEnum = pgEnum("ingestion_run_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
])

export const resumeExtractionStatusEnum = pgEnum("resume_extraction_status", [
  "pending",
  "ready",
  "failed",
])

export const artifactTypeEnum = pgEnum("artifact_type", [
  "tailored_resume",
  "cover_letter",
  "application_answers",
  "email_digest",
])

export const artifactStatusEnum = pgEnum("artifact_status", [
  "pending",
  "ready",
  "failed",
])

export const draftStatusEnum = pgEnum("draft_status", [
  "queued",
  "ready_for_review",
  "approved",
  "rejected",
  "submitted",
  "failed",
])

export const applicationRunStatusEnum = pgEnum("application_run_status", [
  "queued",
  "ready_to_submit",
  "manual_required",
  "submitted",
  "failed",
])

export const notificationTypeEnum = pgEnum("notification_type", [
  "daily_digest",
  "draft_ready",
  "application_submitted",
  "application_failed",
  "job_closed",
  "status_changed",
])

export const notificationStatusEnum = pgEnum("notification_status", [
  "pending",
  "sent",
  "failed",
  "skipped",
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

export const jobSources = pgTable("job_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  sourceType: jobSourceTypeEnum("source_type").notNull().default("manual"),
  baseUrl: text("base_url"),
  countryCodes: text("country_codes").array().notNull().default([]),
  supportsVisaSponsorship: boolean("supports_visa_sponsorship")
    .notNull()
    .default(false),
  defaultAdapter: applyAdapterEnum("default_adapter").notNull().default("none"),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: uuid("created_by").references(() => profiles.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const jobIngestionRuns = pgTable("job_ingestion_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceId: uuid("source_id").references(() => jobSources.id, {
    onDelete: "set null",
  }),
  status: ingestionRunStatusEnum("status").notNull().default("queued"),
  jobsSeen: integer("jobs_seen").notNull().default(0),
  jobsInserted: integer("jobs_inserted").notNull().default(0),
  jobsUpdated: integer("jobs_updated").notNull().default(0),
  jobsSkipped: integer("jobs_skipped").notNull().default(0),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
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
  salaryMin: integer("salary_min"),
  salaryMax: integer("salary_max"),
  currency: text("currency").notNull().default("GBP"),
  location: text("location"),
  countryCode: text("country_code"),
  countryConfidence: text("country_confidence").notNull().default("unknown"),
  tags: text("tags").array().notNull().default([]),
  eligibleCountries: text("eligible_countries").array().notNull().default([]),
  sourceId: uuid("source_id").references(() => jobSources.id, {
    onDelete: "set null",
  }),
  sourceType: jobSourceTypeEnum("source_type").notNull().default("manual"),
  sourceKey: text("source_key").notNull().default("manual"),
  sourceJobId: text("source_job_id"),
  dedupeKey: text("dedupe_key").unique(),
  applyAdapter: applyAdapterEnum("apply_adapter").notNull().default("none"),
  visaSponsorshipStatus: visaSponsorshipStatusEnum("visa_sponsorship_status")
    .notNull()
    .default("unknown"),
  workMode: workModeEnum("work_mode").notNull().default("unknown"),
  employmentType: employmentTypeEnum("employment_type")
    .notNull()
    .default("unknown"),
  postedBy: uuid("posted_by").references(() => profiles.id, {
    onDelete: "set null",
  }),
  availability: availabilityEnum("availability").notNull().default("unknown"),
  closingAt: timestamp("closing_at", { withTimezone: true }),
  lastChecked: timestamp("last_checked", { withTimezone: true }),
  ingestedAt: timestamp("ingested_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
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

export const resumeVersions = pgTable(
  "resume_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resumeId: uuid("resume_id")
      .notNull()
      .references(() => resumes.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    label: text("label"),
    extractedText: text("extracted_text"),
    normalizedText: text("normalized_text"),
    extractionStatus: resumeExtractionStatusEnum("extraction_status")
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    resumeVersionUnique: uniqueIndex("resume_versions_resume_version_idx").on(
      table.resumeId,
      table.versionNumber
    ),
  })
)

export const candidateProfiles = pgTable("candidate_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" })
    .unique(),
  currentCountry: text("current_country"),
  visaStatus: text("visa_status"),
  needsVisaSponsorship: boolean("needs_visa_sponsorship")
    .notNull()
    .default(true),
  targetCountries: text("target_countries").array().notNull().default([]),
  preferredLocations: text("preferred_locations").array().notNull().default([]),
  targetRoles: text("target_roles").array().notNull().default([]),
  yearsExperience: integer("years_experience"),
  salaryFloor: integer("salary_floor"),
  preferredCurrency: text("preferred_currency").notNull().default("GBP"),
  prefersRemote: boolean("prefers_remote").notNull().default(false),
  summary: text("summary"),
  skills: text("skills").array().notNull().default([]),
  // Board names to include in feed (e.g. "Indeed", "NHS", "Guardian Jobs").
  // Empty = show all boards.
  preferredBoards: text("preferred_boards").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const automationPreferences = pgTable("automation_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" })
    .unique(),
  reviewRequired: boolean("review_required").notNull().default(true),
  autoSubmitEnabled: boolean("auto_submit_enabled").notNull().default(false),
  allowedSourceTypes: text("allowed_source_types")
    .array()
    .notNull()
    .default(["approved_feed", "employer_site", "ats"]),
  supportedCountries: text("supported_countries")
    .array()
    .notNull()
    .default([]),
  emailNotificationsEnabled: boolean("email_notifications_enabled")
    .notNull()
    .default(true),
  dailyDigestEnabled: boolean("daily_digest_enabled").notNull().default(true),
  instantUpdatesEnabled: boolean("instant_updates_enabled")
    .notNull()
    .default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
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
  resumeVersionId: uuid("resume_version_id").references(() => resumeVersions.id, {
    onDelete: "set null",
  }),
  status: applicationStatusEnum("status").notNull().default("saved"),
  notes: text("notes"),
  isPrivate: boolean("is_private").notNull().default(false),
  sourceJobId: text("source_job_id"),
  jobSourceType: jobSourceTypeEnum("job_source_type")
    .notNull()
    .default("manual"),
  matchedScore: integer("matched_score"),
  matchReason: text("match_reason"),
  submissionAttempts: integer("submission_attempts").notNull().default(0),
  automationMode: text("automation_mode").notNull().default("review_required"),
  externalApplicationId: text("external_application_id"),
  externalConfirmationUrl: text("external_confirmation_url"),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  lastSubmissionAt: timestamp("last_submission_at", { withTimezone: true }),
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

export const jobMatches = pgTable(
  "job_matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    rationale: text("rationale").notNull(),
    fitSignals: text("fit_signals").array().notNull().default([]),
    concerns: text("concerns").array().notNull().default([]),
    refreshedAt: timestamp("refreshed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    jobMatchUserJobUnique: uniqueIndex("job_matches_user_job_idx").on(
      table.userId,
      table.jobId
    ),
  })
)

export const applicationDrafts = pgTable(
  "application_drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    applicationId: uuid("application_id").references(() => applications.id, {
      onDelete: "set null",
    }),
    jobMatchId: uuid("job_match_id").references(() => jobMatches.id, {
      onDelete: "set null",
    }),
    status: draftStatusEnum("status").notNull().default("ready_for_review"),
    reviewNotes: text("review_notes"),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    applicationDraftUserJobUnique: uniqueIndex("application_drafts_user_job_idx").on(
      table.userId,
      table.jobId
    ),
  })
)

export const generatedArtifacts = pgTable("generated_artifacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  jobId: uuid("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  applicationId: uuid("application_id").references(() => applications.id, {
    onDelete: "set null",
  }),
  draftId: uuid("draft_id").references(() => applicationDrafts.id, {
    onDelete: "set null",
  }),
  sourceResumeVersionId: uuid("source_resume_version_id").references(
    () => resumeVersions.id,
    {
      onDelete: "set null",
    }
  ),
  type: artifactTypeEnum("type").notNull(),
  status: artifactStatusEnum("status").notNull().default("ready"),
  title: text("title").notNull(),
  content: text("content"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const applicationRuns = pgTable("application_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  applicationId: uuid("application_id")
    .notNull()
    .references(() => applications.id, { onDelete: "cascade" }),
  draftId: uuid("draft_id").references(() => applicationDrafts.id, {
    onDelete: "set null",
  }),
  status: applicationRunStatusEnum("status").notNull().default("queued"),
  mode: text("mode").notNull().default("review_required"),
  adapter: applyAdapterEnum("adapter").notNull().default("none"),
  attemptNumber: integer("attempt_number").notNull().default(1),
  log: text("log"),
  externalUrl: text("external_url"),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export type SavedSearchFilters = Record<string, unknown>

export const savedSearches = pgTable("saved_searches", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  query: text("query"),
  filters: jsonb("filters").$type<SavedSearchFilters>().notNull().default({}),
  emailDaily: boolean("email_daily").notNull().default(true),
  lastDigestAt: timestamp("last_digest_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const notificationEvents = pgTable("notification_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  type: notificationTypeEnum("type").notNull(),
  status: notificationStatusEnum("status").notNull().default("pending"),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  jobId: uuid("job_id").references(() => jobs.id, {
    onDelete: "set null",
  }),
  applicationId: uuid("application_id").references(() => applications.id, {
    onDelete: "set null",
  }),
  draftId: uuid("draft_id").references(() => applicationDrafts.id, {
    onDelete: "set null",
  }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// ─── Type exports ─────────────────────────────────────────────────────────────

export type Profile = typeof profiles.$inferSelect
export type JobSource = typeof jobSources.$inferSelect
export type JobIngestionRun = typeof jobIngestionRuns.$inferSelect
export type Job = typeof jobs.$inferSelect
export type Resume = typeof resumes.$inferSelect
export type ResumeVersion = typeof resumeVersions.$inferSelect
export type CandidateProfile = typeof candidateProfiles.$inferSelect
export type AutomationPreference = typeof automationPreferences.$inferSelect
export type Application = typeof applications.$inferSelect
export type ApplicationStatusHistory =
  typeof applicationStatusHistory.$inferSelect
export type JobMatch = typeof jobMatches.$inferSelect
export type ApplicationDraft = typeof applicationDrafts.$inferSelect
export type GeneratedArtifact = typeof generatedArtifacts.$inferSelect
export type ApplicationRun = typeof applicationRuns.$inferSelect
export type Invite = typeof invites.$inferSelect
export type SavedSearch = typeof savedSearches.$inferSelect
export type NotificationEvent = typeof notificationEvents.$inferSelect

export type InsertJobSource = typeof jobSources.$inferInsert
export type InsertJob = typeof jobs.$inferInsert
export type InsertResume = typeof resumes.$inferInsert
export type InsertResumeVersion = typeof resumeVersions.$inferInsert
export type InsertCandidateProfile = typeof candidateProfiles.$inferInsert
export type InsertAutomationPreference = typeof automationPreferences.$inferInsert
export type InsertApplication = typeof applications.$inferInsert
export type InsertApplicationDraft = typeof applicationDrafts.$inferInsert
export type InsertGeneratedArtifact = typeof generatedArtifacts.$inferInsert
export type InsertApplicationRun = typeof applicationRuns.$inferInsert
export type InsertSavedSearch = typeof savedSearches.$inferInsert
export type InsertInvite = typeof invites.$inferInsert

export type ApplicationStatus = (typeof applicationStatusEnum.enumValues)[number]
export type Availability = (typeof availabilityEnum.enumValues)[number]
export type JobSourceType = (typeof jobSourceTypeEnum.enumValues)[number]
export type VisaSponsorshipStatus =
  (typeof visaSponsorshipStatusEnum.enumValues)[number]
export type WorkMode = (typeof workModeEnum.enumValues)[number]
export type EmploymentType = (typeof employmentTypeEnum.enumValues)[number]
export type ApplyAdapter = (typeof applyAdapterEnum.enumValues)[number]
export type DraftStatus = (typeof draftStatusEnum.enumValues)[number]
export type ArtifactType = (typeof artifactTypeEnum.enumValues)[number]
export type ArtifactStatus = (typeof artifactStatusEnum.enumValues)[number]
export type ApplicationRunStatus =
  (typeof applicationRunStatusEnum.enumValues)[number]
export type NotificationType =
  (typeof notificationTypeEnum.enumValues)[number]
export type NotificationStatus =
  (typeof notificationStatusEnum.enumValues)[number]
