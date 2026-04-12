import type {
  ApplyAdapter,
  Availability,
  EmploymentType,
  JobSourceType,
  VisaSponsorshipStatus,
  WorkMode,
} from "@/lib/db/schema"

export const SUPPORTED_COUNTRIES = ["GB", "IE", "DE", "CA", "NL", "AU"] as const

export const JOB_SOURCE_TYPE_LABELS: Record<JobSourceType, string> = {
  manual: "Manual",
  approved_feed: "Approved Feed",
  employer_site: "Employer Site",
  ats: "ATS",
}

export const VISA_SPONSORSHIP_LABELS: Record<VisaSponsorshipStatus, string> = {
  eligible: "Visa Sponsor",
  possible: "Check Sponsorship",
  not_available: "No Sponsorship",
  unknown: "Unknown",
}

export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "Onsite",
  unknown: "Unknown",
}

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: "Full Time",
  part_time: "Part Time",
  contract: "Contract",
  internship: "Internship",
  temporary: "Temporary",
  apprenticeship: "Apprenticeship",
  unknown: "Unknown",
}

export const APPLY_ADAPTER_LABELS: Record<ApplyAdapter, string> = {
  none: "No automation",
  greenhouse: "Greenhouse",
  lever: "Lever",
  workday: "Workday",
  ashby: "Ashby",
  smartrecruiters: "SmartRecruiters",
  manual_external: "External manual flow",
}

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  open: "Open",
  closed: "Closed",
  unknown: "Unknown",
}

export const AUTO_SUBMIT_ELIGIBLE_ADAPTERS: ApplyAdapter[] = [
  "greenhouse",
  "lever",
  "ashby",
  "smartrecruiters",
]

export type BoardEntry = {
  key: string
  label: string
  sector: string
  sourceType?: JobSourceType
}

export const JOB_BOARDS: BoardEntry[] = [
  { key: "indeed", label: "Indeed", sector: "Aggregator", sourceType: "approved_feed" },
  { key: "adzuna", label: "Adzuna", sector: "Aggregator", sourceType: "approved_feed" },
  { key: "totaljobs", label: "Totaljobs", sector: "Aggregator", sourceType: "approved_feed" },
  { key: "cv-library", label: "CV-Library", sector: "Aggregator", sourceType: "approved_feed" },
  { key: "monster", label: "Monster", sector: "Aggregator", sourceType: "approved_feed" },
  { key: "reed", label: "Reed", sector: "General", sourceType: "approved_feed" },
  { key: "guardian-jobs", label: "Guardian Jobs", sector: "General", sourceType: "approved_feed" },
  { key: "cwjobs", label: "CWJobs", sector: "Tech", sourceType: "approved_feed" },
  { key: "nhs", label: "NHS Jobs", sector: "Public Sector", sourceType: "approved_feed" },
  { key: "local-government", label: "Council / lgjobs", sector: "Public Sector", sourceType: "approved_feed" },
  { key: "dwp", label: "DWP Find a Job", sector: "Public Sector", sourceType: "approved_feed" },
  { key: "jobs-ac-uk", label: "jobs.ac.uk", sector: "Education", sourceType: "approved_feed" },
  { key: "charityjob", label: "CharityJob", sector: "Charity / Third Sector", sourceType: "approved_feed" },
  { key: "greenhouse", label: "Greenhouse (company sites)", sector: "Company ATS", sourceType: "ats" },
  { key: "lever", label: "Lever (company sites)", sector: "Company ATS", sourceType: "ats" },
]

export const BOARD_SECTORS = [...new Set(JOB_BOARDS.map((b) => b.sector))]

export const JOB_BOARD_LABELS = Object.fromEntries(
  JOB_BOARDS.map((board) => [board.key, board.label])
) as Record<string, string>
