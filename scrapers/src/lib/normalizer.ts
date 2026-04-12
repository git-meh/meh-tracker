import {
  detectCountryCodeFromLocation,
  resolveCountryMetadata as resolveCountryMetadataShared,
} from "../../../lib/visa-platform/countries.js"

export type ApplyAdapter =
  | "none"
  | "greenhouse"
  | "lever"
  | "workday"
  | "ashby"
  | "smartrecruiters"
  | "manual_external"

export type JobSourceType =
  | "manual"
  | "approved_feed"
  | "employer_site"
  | "ats"

export type VisaSponsorshipStatus =
  | "eligible"
  | "possible"
  | "not_available"
  | "unknown"

export type WorkMode = "remote" | "hybrid" | "onsite" | "unknown"

export type EmploymentType =
  | "full_time"
  | "part_time"
  | "contract"
  | "internship"
  | "temporary"
  | "apprenticeship"
  | "unknown"

export type IngestibleJob = {
  url: string
  title: string
  company: string
  description?: string | null
  salaryRange?: string | null
  salaryMin?: number | null
  salaryMax?: number | null
  currency?: string | null
  location?: string | null
  countryCode?: string | null
  countryConfidence?: string | null
  tags?: string[]
  eligibleCountries?: string[]
  sourceKey?: string | null
  sourceType?: JobSourceType
  sourceJobId?: string | null
  applyAdapter?: ApplyAdapter
  visaSponsorshipStatus?: VisaSponsorshipStatus
  workMode?: WorkMode
  employmentType?: EmploymentType
  closingAt?: Date | null
}

/**
 * Strip HTML tags and decode common HTML entities, preserving paragraph/list structure.
 */
export function stripHtml(html: string): string {
  return html
    // Block-level elements → newline before closing tag to preserve structure
    .replace(/<\/(p|div|li|h[1-6]|tr|blockquote|pre)>/gi, "\n")
    // <br> and <br/> → newline
    .replace(/<br\s*\/?>/gi, "\n")
    // <li> opening → bullet
    .replace(/<li[^>]*>/gi, "• ")
    // Strip remaining tags
    .replace(/<[^>]+>/g, "")
    // Decode entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    // Collapse more than 2 consecutive newlines
    .replace(/\n{3,}/g, "\n\n")
    // Trim trailing whitespace from each line
    .split("\n").map((l) => l.trim()).join("\n")
    .trim()
}

/**
 * Detect country code from a location string.
 * Defaults to "GB" when location contains UK city/country names.
 */
/**
 * Detect a two-letter country code from a location string.
 *
 * Returns `null` when the location is ambiguous or not recognised —
 * callers should then apply a board-level default (e.g. "GB" for UK boards).
 * NEVER blindly defaults to "GB" because that caused jobs from New York,
 * Bangalore, etc. to be mislabelled as UK jobs.
 */
export function detectCountryCode(location: string | null | undefined): string | null {
  return detectCountryCodeFromLocation(location)
}

export function resolveCountryMetadata(input: {
  countryCode?: string | null
  location?: string | null
}) {
  return resolveCountryMetadataShared(input)
}

/**
 * Detect work mode from location and description strings.
 */
export function detectWorkMode(
  location: string | null | undefined,
  description: string | null | undefined
): WorkMode {
  const combined = `${location ?? ""} ${description ?? ""}`.toLowerCase()

  if (combined.includes("fully remote") || combined.includes("100% remote")) return "remote"
  if (combined.includes("remote first") || combined.includes("remote-first")) return "remote"
  if (combined.includes(" remote") && !combined.includes("not remote")) {
    if (combined.includes("hybrid")) return "hybrid"
    return "remote"
  }
  if (combined.includes("hybrid")) return "hybrid"
  if (combined.includes("on-site") || combined.includes("onsite") || combined.includes("in office")) return "onsite"

  return "unknown"
}

/**
 * Normalise an employment type string from various sources to our enum.
 */
export function normalizeEmploymentType(raw: unknown): EmploymentType {
  if (!raw) return "unknown"
  // Guard against arrays or objects coming from ATS metadata fields
  const str = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] ?? "" : String(raw)
  if (!str) return "unknown"
  const lower = str.toLowerCase().replace(/[_\s-]+/g, "_")

  if (lower.includes("full") && lower.includes("time")) return "full_time"
  if (lower.includes("full_time") || lower === "permanent") return "full_time"
  if (lower.includes("part") && lower.includes("time")) return "part_time"
  if (lower.includes("part_time")) return "part_time"
  if (lower.includes("contract") || lower.includes("freelance")) return "contract"
  if (lower.includes("intern")) return "internship"
  if (lower.includes("temp") || lower.includes("temporary")) return "temporary"
  if (lower.includes("apprentice")) return "apprenticeship"

  return "unknown"
}

/**
 * Parse a salary range string and extract min/max values.
 * Handles: "£45,000 - £65,000", "Up to £80k", "£400-£500 per day", "$50k-$70k"
 */
export function parseSalaryRange(
  raw: string | null | undefined
): { salaryMin: number | null; salaryMax: number | null; currency: string } {
  if (!raw) return { salaryMin: null, salaryMax: null, currency: "GBP" }

  const lower = raw.toLowerCase()
  const isPerDay = lower.includes("per day") || lower.includes("/day") || lower.includes("p/d")
  const currency = raw.includes("$") ? "USD" : raw.includes("€") ? "EUR" : "GBP"

  // Remove currency symbols and commas
  const cleaned = raw.replace(/[£$€,]/g, "").replace(/k/gi, "000")

  // Extract all numbers
  const nums = [...cleaned.matchAll(/(\d+)/g)].map((m) => parseInt(m[1]))
  if (nums.length === 0) return { salaryMin: null, salaryMax: null, currency }

  let min = nums[0]
  let max = nums.length > 1 ? nums[nums.length - 1] : nums[0]

  // Day rate → annual equivalent (220 working days)
  if (isPerDay) {
    min = min * 220
    max = max * 220
  }

  // Sanity check — ignore implausibly small numbers (likely years)
  if (max < 1000) return { salaryMin: null, salaryMax: null, currency }

  return {
    salaryMin: min || null,
    salaryMax: max || null,
    currency,
  }
}
