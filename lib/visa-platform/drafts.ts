import type {
  CandidateProfile,
  Job,
  ResumeVersion,
} from "@/lib/db/schema"
import type { MatchResult } from "@/lib/visa-platform/matching"

function listOrFallback(values: string[] | null | undefined, fallback: string) {
  if (!values || values.length === 0) return fallback
  return values.join(", ")
}

function resumeBase(profile: CandidateProfile | null, resumeVersion: ResumeVersion | null) {
  return (
    resumeVersion?.normalizedText ||
    resumeVersion?.extractedText ||
    profile?.summary ||
    "Candidate summary not provided yet."
  )
}

export function buildTailoredResumeContent(
  job: Pick<Job, "title" | "company" | "description" | "tags" | "location">,
  profile: CandidateProfile | null,
  resumeVersion: ResumeVersion | null,
  match: Pick<MatchResult, "fitSignals" | "concerns" | "rationale">
) {
  const baseText = resumeBase(profile, resumeVersion)
  return [
    `# Tailored Resume`,
    ``,
    `## Target Role`,
    `${job.title} at ${job.company}${job.location ? ` · ${job.location}` : ""}`,
    ``,
    `## Professional Summary`,
    profile?.summary ||
      `Candidate targeting ${listOrFallback(profile?.targetRoles, job.title)} roles with emphasis on ${listOrFallback(profile?.skills, "transferable skills")}.`,
    ``,
    `## Core Skills`,
    listOrFallback(profile?.skills, "Add core skills here."),
    ``,
    `## Tailored Highlights`,
    ...(match.fitSignals.length > 0
      ? match.fitSignals.slice(0, 5).map((signal) => `- ${signal}`)
      : [`- Explain why your background is relevant to ${job.title}.`]),
    ``,
    `## Experience Evidence`,
    baseText,
    ``,
    `## Role Alignment Notes`,
    `- Emphasise experience most relevant to ${job.title}.`,
    `- Tie your strongest outcomes back to ${job.company}'s hiring context.`,
    `- Use tags such as ${job.tags.join(", ") || "role alignment"} as proof points.`,
    job.location ? `- Confirm suitability for ${job.location}.` : null,
    profile?.needsVisaSponsorship
      ? `- Mention visa sponsorship needs clearly and professionally where required.`
      : null,
    ``,
    match.concerns.length > 0
      ? `## Clarifications To Resolve\n${match.concerns.map((item) => `- ${item}`).join("\n")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n")
}

export function buildCoverLetterContent(
  job: Pick<Job, "title" | "company" | "location" | "visaSponsorshipStatus">,
  profile: CandidateProfile | null,
  match: Pick<MatchResult, "fitSignals" | "rationale">
) {
  return [
    `Dear Hiring Team at ${job.company},`,
    ``,
    `I am applying for the ${job.title} role${job.location ? ` in ${job.location}` : ""}. ${match.rationale}.`,
    ``,
    `My background is strongest across ${listOrFallback(profile?.skills, "the candidate's core skills")}. I am targeting ${listOrFallback(profile?.targetRoles, job.title)} roles and would bring a focused, outcome-driven approach to this position.`,
    ``,
    profile?.needsVisaSponsorship
      ? `I would require visa sponsorship support${job.visaSponsorshipStatus === "eligible" ? ", and this role appears to align with that requirement." : ". I would welcome confirmation that the role can support sponsorship."}`
      : `I am ready to progress through the standard hiring process without sponsorship constraints.`,
    ``,
    `Thank you for your time and consideration.`,
  ].join("\n")
}

export function buildApplicationAnswersContent(
  job: Pick<Job, "title" | "company" | "visaSponsorshipStatus">,
  profile: CandidateProfile | null,
  match: Pick<MatchResult, "fitSignals" | "concerns">
) {
  const answers = [
    `## Why this role?`,
    `This ${job.title} role stands out because it aligns with ${listOrFallback(profile?.targetRoles, "the candidate's target trajectory")} and offers a strong fit across ${match.fitSignals.slice(0, 3).join(", ") || "the documented strengths"}.`,
    ``,
    `## Why this company?`,
    `${job.company} fits the candidate's international search because the opportunity appears compatible with a UK-first visa strategy and a role scope that rewards practical execution.`,
    ``,
    `## Sponsorship / relocation`,
    profile?.needsVisaSponsorship
      ? job.visaSponsorshipStatus === "eligible"
        ? `The candidate would require visa sponsorship and this listing is tagged as sponsorship-eligible.`
        : `The candidate would require visa sponsorship, so confirmation is needed before submission.`
      : `The candidate does not currently require visa sponsorship.`,
  ]

  if (match.concerns.length > 0) {
    answers.push("", "## Clarifications to prepare", ...match.concerns.map((item) => `- ${item}`))
  }

  return answers.join("\n")
}
