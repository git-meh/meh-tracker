import type { CandidateProfile, Job } from "@/lib/db/schema"

export type MatchResult = {
  score: number
  rationale: string
  fitSignals: string[]
  concerns: string[]
}

type MatchableJob = Pick<
  Job,
  | "title"
  | "description"
  | "location"
  | "tags"
  | "countryCode"
  | "salaryMin"
  | "salaryMax"
  | "currency"
  | "workMode"
  | "employmentType"
  | "visaSponsorshipStatus"
  | "eligibleCountries"
>

const GENERIC_ROLE_WORDS = new Set([
  "and",
  "the",
  "for",
  "with",
  "lead",
  "senior",
  "junior",
  "mid",
  "manager",
  "specialist",
  "associate",
  "executive",
  "officer",
  "coordinator",
  "assistant",
])

function tokenize(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9+#./ -]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !GENERIC_ROLE_WORDS.has(token))
}

function uniq(values: string[]) {
  return [...new Set(values)]
}

function buildSurface(job: MatchableJob) {
  return uniq([
    ...tokenize(job.title),
    ...job.tags.flatMap((tag) => tokenize(tag)),
    ...tokenize(job.description),
    ...tokenize(job.location),
  ])
}

export function buildMatchResult(
  profile: CandidateProfile | null,
  job: MatchableJob
): MatchResult {
  const factors = {
    sponsorship: 0,
    country: 0,
    role: 0,
    skills: 0,
    location: 0,
    salary: 0,
  }
  const fitSignals: string[] = []
  const concerns: string[] = []

  const titleTokens = uniq(tokenize(job.title))
  const skillSurface = new Set(buildSurface(job))
  const roleSurface = new Set([...titleTokens, ...job.tags.flatMap((tag) => tokenize(tag))])

  if (profile?.needsVisaSponsorship) {
    switch (job.visaSponsorshipStatus) {
      case "eligible":
        factors.sponsorship += 35
        fitSignals.push("Confirmed visa sponsorship eligible")
        break
      case "possible":
        factors.sponsorship += 16
        fitSignals.push("Sponsorship may be available")
        concerns.push("Confirm visa sponsorship directly with the employer before submitting")
        break
      case "not_available":
        factors.sponsorship -= 45
        concerns.push("Role is marked as not offering visa sponsorship")
        break
      default:
        factors.sponsorship -= 6
        concerns.push("Visa sponsorship status is unknown")
    }
  } else if (job.visaSponsorshipStatus === "eligible") {
    factors.sponsorship += 6
    fitSignals.push("Sponsorship is available if needed later")
  }

  const targetRoleMatches = (profile?.targetRoles ?? [])
    .map((role) => {
      const roleTokens = uniq(tokenize(role))
      const hits = roleTokens.filter((token) => roleSurface.has(token))
      return {
        role,
        hits,
        coverage: roleTokens.length > 0 ? hits.length / roleTokens.length : 0,
      }
    })
    .sort((left, right) => right.coverage - left.coverage)

  const bestRole = targetRoleMatches[0]
  if (bestRole && bestRole.coverage > 0) {
    factors.role += bestRole.coverage >= 1 ? 24 : bestRole.coverage >= 0.66 ? 18 : 10
    fitSignals.push(`Title fit: ${bestRole.role}`)
  } else if ((profile?.targetRoles ?? []).length > 0) {
    factors.role -= 8
    concerns.push("Job title is outside your saved target roles")
  }

  const matchedSkills = uniq(
    (profile?.skills ?? []).filter((skill) => {
      const skillTokens = tokenize(skill)
      return skillTokens.some((token) => skillSurface.has(token))
    })
  )

  if (matchedSkills.length > 0) {
    factors.skills += Math.min(matchedSkills.length * 4, 18)
    fitSignals.push(`Skills overlap: ${matchedSkills.slice(0, 4).join(", ")}`)
  } else if ((profile?.skills ?? []).length > 0) {
    concerns.push("Few of your listed skills appear in the role title or description")
  }

  const targetCountries = profile?.targetCountries ?? []
  if (targetCountries.length > 0) {
    if (job.countryCode && targetCountries.includes(job.countryCode)) {
      factors.country += 12
      fitSignals.push(`Country fit: ${job.countryCode}`)
    } else if (
      job.eligibleCountries.some((countryCode) =>
        targetCountries.includes(countryCode)
      )
    ) {
      factors.country += 8
      fitSignals.push("Country fit: role is open to one of your target countries")
    } else if (job.countryCode) {
      factors.country -= 6
      concerns.push(`Job is outside your saved target countries (${job.countryCode})`)
    } else {
      concerns.push("Job country is unclear, so location fit needs manual review")
    }
  } else if (job.countryCode && profile?.currentCountry === job.countryCode) {
    factors.country += 4
    fitSignals.push(`Country fit: matches your current country (${job.countryCode})`)
  }

  if (profile?.preferredLocations?.length && job.location) {
    const locationHit = profile.preferredLocations.some((location) =>
      job.location?.toLowerCase().includes(location.toLowerCase())
    )
    if (locationHit) {
      factors.location += 6
      fitSignals.push(`Matches a preferred location (${job.location})`)
    }
  }

  if (profile?.prefersRemote) {
    if (job.workMode === "remote") {
      factors.location += 10
      fitSignals.push("Remote work matches your preference")
    } else if (job.workMode === "hybrid") {
      factors.location += 4
      fitSignals.push("Hybrid work partially matches your preference")
    } else if (job.workMode === "onsite") {
      factors.location -= 6
      concerns.push("Role is onsite but your profile prefers remote or hybrid work")
    }
  }

  if (typeof profile?.salaryFloor === "number" && profile.salaryFloor > 0) {
    if (
      profile.preferredCurrency &&
      job.currency &&
      profile.preferredCurrency !== job.currency
    ) {
      concerns.push(
        `Salary is listed in ${job.currency}, while your profile floor is saved in ${profile.preferredCurrency}`
      )
    } else if (typeof job.salaryMax === "number" && job.salaryMax >= profile.salaryFloor) {
      factors.salary += 8
      fitSignals.push(`Salary fit: up to ${job.currency} ${job.salaryMax.toLocaleString()}`)
    } else if (
      typeof job.salaryMin === "number" &&
      job.salaryMin > 0 &&
      job.salaryMin < profile.salaryFloor
    ) {
      factors.salary -= 6
      concerns.push("Published salary appears below your saved floor")
    }
  }

  const score = Object.values(factors).reduce((sum, value) => sum + value, 0)
  const boundedScore = Math.max(0, Math.min(100, score))
  const rationale = [
    fitSignals[0] ?? "Review this listing manually",
    fitSignals[1],
    concerns[0] ? `Watch-out: ${concerns[0]}` : null,
  ]
    .filter(Boolean)
    .join(". ")

  return {
    score: boundedScore,
    rationale,
    fitSignals,
    concerns,
  }
}
