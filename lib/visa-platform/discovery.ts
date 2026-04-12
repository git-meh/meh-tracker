import { z } from "zod"
import type {
  Availability,
  EmploymentType,
  JobSourceType,
  SavedSearchFilters,
  VisaSponsorshipStatus,
  WorkMode,
} from "@/lib/db/schema"
import { normalizeCountryFilter } from "@/lib/visa-platform/countries"

const rawJobDiscoverySchema = z.object({
  q: z.string().trim().optional().default(""),
  availability: z.enum(["open", "closed", "unknown"]).optional(),
  sponsorship: z
    .enum(["eligible", "possible", "not_available", "unknown"])
    .optional(),
  country: z.string().trim().max(120).optional(),
  workMode: z.enum(["remote", "hybrid", "onsite", "unknown"]).optional(),
  employmentType: z
    .enum([
      "full_time",
      "part_time",
      "contract",
      "internship",
      "temporary",
      "apprenticeship",
      "unknown",
    ])
    .optional(),
  sourceType: z.enum(["manual", "approved_feed", "employer_site", "ats"]).optional(),
  minSalary: z.coerce.number().int().min(0).optional(),
  onlyMatched: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((value) => value === true || value === "true")
    .optional(),
})

export type JobDiscoveryFilters = {
  q: string
  availability?: Availability
  sponsorship?: VisaSponsorshipStatus
  country?: string
  workMode?: WorkMode
  employmentType?: EmploymentType
  sourceType?: JobSourceType
  minSalary?: number
  onlyMatched?: boolean
}

export function parseJobDiscoveryFilters(
  raw: Record<string, string | string[] | undefined>
): JobDiscoveryFilters {
  const normalised = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ])
  )

  const parsed = rawJobDiscoverySchema.safeParse(normalised)

  if (!parsed.success) {
    return { q: "" }
  }

  const country = normalizeCountryFilter(parsed.data.country)

  return {
    q: parsed.data.q,
    availability: parsed.data.availability,
    sponsorship: parsed.data.sponsorship,
    country,
    workMode: parsed.data.workMode,
    employmentType: parsed.data.employmentType,
    sourceType: parsed.data.sourceType,
    minSalary: parsed.data.minSalary,
    onlyMatched: parsed.data.onlyMatched,
  }
}

export function toSavedSearchFilters(filters: JobDiscoveryFilters): SavedSearchFilters {
  return {
    q: filters.q || null,
    availability: filters.availability ?? null,
    sponsorship: filters.sponsorship ?? null,
    country: filters.country ?? null,
    workMode: filters.workMode ?? null,
    employmentType: filters.employmentType ?? null,
    sourceType: filters.sourceType ?? null,
    minSalary: filters.minSalary ?? null,
    onlyMatched: Boolean(filters.onlyMatched),
  }
}

type FilterableJob = {
  title: string
  company: string
  description: string | null
  location: string | null
  tags: string[]
  availability: Availability
  visaSponsorshipStatus: VisaSponsorshipStatus
  countryCode: string | null
  workMode: WorkMode
  employmentType: EmploymentType
  sourceType: JobSourceType
  salaryMin: number | null
  eligibleCountries: string[]
  matchScore?: number | null
}

export function filterJobs<T extends FilterableJob>(
  jobs: T[],
  filters: JobDiscoveryFilters
) {
  const queryWords = filters.q
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)

  return jobs.filter((job) => {
    if (queryWords.length > 0) {
      const haystack = [
        job.title,
        job.company,
        job.description ?? "",
        job.location ?? "",
        ...job.tags,
      ]
        .join(" ")
        .toLowerCase()

      if (!queryWords.every((word) => haystack.includes(word))) {
        return false
      }
    }

    if (filters.availability && job.availability !== filters.availability) {
      return false
    }

    if (
      filters.sponsorship &&
      job.visaSponsorshipStatus !== filters.sponsorship
    ) {
      return false
    }

    if (filters.country && job.countryCode !== filters.country) {
      return false
    }

    if (filters.workMode && job.workMode !== filters.workMode) {
      return false
    }

    if (
      filters.employmentType &&
      job.employmentType !== filters.employmentType
    ) {
      return false
    }

    if (filters.sourceType && job.sourceType !== filters.sourceType) {
      return false
    }

    if (
      typeof filters.minSalary === "number" &&
      typeof job.salaryMin === "number" &&
      job.salaryMin < filters.minSalary
    ) {
      return false
    }

    if (filters.onlyMatched && !(job.matchScore && job.matchScore > 0)) {
      return false
    }

    return true
  })
}
