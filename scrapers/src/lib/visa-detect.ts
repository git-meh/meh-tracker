const ELIGIBLE_PHRASES = [
  "visa sponsorship",
  "skilled worker visa",
  "tier 2 visa",
  "tier 2 sponsor",
  "sponsor licence",
  "certificate of sponsorship",
  "we will sponsor",
  "sponsorship available",
  "sponsorship provided",
  "sponsorship is available",
  "we can sponsor",
  "we are able to sponsor",
  "offer sponsorship",
  "visa support",
  "relocation package",
  "relocation support",
  "we support relocation",
  "global mobility",
]

const NOT_AVAILABLE_PHRASES = [
  "no sponsorship",
  "unable to offer sponsorship",
  "unable to sponsor",
  "not able to sponsor",
  "cannot sponsor",
  "does not offer sponsorship",
  "sponsorship is not available",
  "no visa sponsorship",
  "no visa support",
  "right to work in the uk required",
  "must already have the right to work",
  "must have the right to work",
  "already have right to work",
  "uk right to work is required",
  "without sponsorship",
  "no relocation",
]

const POSSIBLE_KEYWORDS = [
  "visa",
  "sponsorship",
  "right to work",
  "work permit",
  "immigration",
  "relocation",
  "biometric residence",
  "brp",
]

export type SponsorshipStatus = "eligible" | "possible" | "not_available" | "unknown"

export function detectSponsorshipStatus(text: string): SponsorshipStatus {
  const lower = text.toLowerCase()

  for (const phrase of ELIGIBLE_PHRASES) {
    if (lower.includes(phrase)) return "eligible"
  }

  for (const phrase of NOT_AVAILABLE_PHRASES) {
    if (lower.includes(phrase)) return "not_available"
  }

  for (const keyword of POSSIBLE_KEYWORDS) {
    if (lower.includes(keyword)) return "possible"
  }

  return "unknown"
}
