import type { CandidateProfile, Job } from "@/lib/db/schema"
import { chatComplete, isOpenRouterEnabled } from "@/lib/openrouter"
import { logger } from "@/lib/logger"

export type MatchResult = {
  score: number
  rationale: string
  fitSignals: string[]
  concerns: string[]
}

export type MatchableJob = Pick<
  Job,
  | "id"
  | "title"
  | "company"
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

// ─── Algorithmic matching (batch refresh — no AI cost) ────────────────────────

const GENERIC_ROLE_WORDS = new Set([
  "and", "the", "for", "with", "lead", "senior", "junior", "mid",
  "manager", "specialist", "associate", "executive", "officer",
  "coordinator", "assistant",
])

function tokenize(value: string | null | undefined) {
  return [...new Set(
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9+#./ -]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && !GENERIC_ROLE_WORDS.has(t))
  )]
}

function buildSurface(job: MatchableJob) {
  return new Set([
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
  const factors = { sponsorship: 0, country: 0, role: 0, skills: 0, location: 0, salary: 0 }
  const fitSignals: string[] = []
  const concerns: string[] = []

  const roleSurface = new Set([
    ...tokenize(job.title),
    ...job.tags.flatMap((tag) => tokenize(tag)),
  ])
  const skillSurface = buildSurface(job)

  // ── Visa sponsorship ───────────────────────────────────────────────────────
  // "unknown" is the default for most scraped jobs — we don't penalise it
  // because the absence of data is not the same as a refusal. We only hard-block
  // when the role is explicitly marked as not offering sponsorship.
  if (profile?.needsVisaSponsorship) {
    switch (job.visaSponsorshipStatus) {
      case "eligible":
        factors.sponsorship += 30
        fitSignals.push("Confirmed visa sponsorship eligible")
        break
      case "possible":
        factors.sponsorship += 12
        fitSignals.push("Sponsorship may be available")
        concerns.push("Confirm visa sponsorship directly with the employer before applying")
        break
      case "not_available":
        factors.sponsorship -= 60
        concerns.push("Role explicitly does not offer visa sponsorship")
        break
      default:
        // "unknown" — neutral, add a soft reminder
        concerns.push("Sponsorship status not listed — verify with employer before applying")
    }
  } else if (job.visaSponsorshipStatus === "eligible") {
    factors.sponsorship += 5
    fitSignals.push("Sponsorship available if needed later")
  }

  // ── Role / title match ────────────────────────────────────────────────────
  const targetRoles = profile?.targetRoles ?? []
  if (targetRoles.length > 0) {
    const roleMatches = targetRoles
      .map((role) => {
        const roleTokens = tokenize(role)
        const hits = roleTokens.filter((t) => roleSurface.has(t))
        return {
          role,
          coverage: roleTokens.length > 0 ? hits.length / roleTokens.length : 0,
        }
      })
      .sort((a, b) => b.coverage - a.coverage)

    const best = roleMatches[0]
    if (best.coverage >= 1) {
      factors.role += 25
      fitSignals.push(`Strong title match: ${best.role}`)
    } else if (best.coverage >= 0.66) {
      factors.role += 18
      fitSignals.push(`Good title match: ${best.role}`)
    } else if (best.coverage > 0) {
      factors.role += 10
      fitSignals.push(`Partial title match: ${best.role}`)
    } else {
      // User has saved target roles but this job matches none of them.
      // Use a moderate penalty — skills overlap can still save it (e.g. a
      // "Full Stack Developer" posting that uses all the right tech).
      factors.role -= 15
      concerns.push(
        `Job title does not directly match your target roles (${targetRoles.join(", ")})`
      )
    }
  }
  // No targetRoles saved → user is open to anything; no role penalty applied.

  // ── Skills match ──────────────────────────────────────────────────────────
  const profileSkills = profile?.skills ?? []
  if (profileSkills.length > 0) {
    const matchedSkills = [...new Set(
      profileSkills.filter((skill) =>
        tokenize(skill).some((t) => skillSurface.has(t))
      )
    )]
    if (matchedSkills.length > 0) {
      factors.skills += Math.min(matchedSkills.length * 5, 20)
      fitSignals.push(`Skills overlap: ${matchedSkills.slice(0, 5).join(", ")}`)
    } else {
      factors.skills -= 10
      concerns.push("None of your saved skills appear in this role's description or title")
    }
  }

  // ── Country / location ────────────────────────────────────────────────────
  const targetCountries = profile?.targetCountries ?? []
  if (targetCountries.length > 0) {
    if (job.countryCode && targetCountries.includes(job.countryCode)) {
      factors.country += 12
      fitSignals.push(`Country fit: ${job.countryCode}`)
    } else if (job.eligibleCountries.some((c) => targetCountries.includes(c))) {
      factors.country += 8
      fitSignals.push("Country fit: role is open to one of your target countries")
    } else if (job.countryCode) {
      factors.country -= 8
      concerns.push(`Job is in ${job.countryCode}, which is not in your target countries`)
    } else {
      concerns.push("Job country is unclear — confirm location before applying")
    }
  } else if (job.countryCode && profile?.currentCountry === job.countryCode) {
    factors.country += 4
    fitSignals.push(`Location matches your current country (${job.countryCode})`)
  }

  if (profile?.preferredLocations?.length && job.location) {
    const hit = profile.preferredLocations.some((loc) =>
      job.location?.toLowerCase().includes(loc.toLowerCase())
    )
    if (hit) {
      factors.location += 6
      fitSignals.push(`Preferred location match: ${job.location}`)
    }
  }

  if (profile?.prefersRemote) {
    if (job.workMode === "remote") {
      factors.location += 10
      fitSignals.push("Remote — matches your preference")
    } else if (job.workMode === "hybrid") {
      factors.location += 4
      fitSignals.push("Hybrid — partially matches your remote preference")
    } else if (job.workMode === "onsite") {
      factors.location -= 6
      concerns.push("Role is onsite; your profile prefers remote or hybrid")
    }
  }

  // ── Salary ────────────────────────────────────────────────────────────────
  if (typeof profile?.salaryFloor === "number" && profile.salaryFloor > 0) {
    if (profile.preferredCurrency && job.currency && profile.preferredCurrency !== job.currency) {
      concerns.push(
        `Salary listed in ${job.currency}; your floor is in ${profile.preferredCurrency} — verify before applying`
      )
    } else if (typeof job.salaryMax === "number" && job.salaryMax >= profile.salaryFloor) {
      factors.salary += 8
      fitSignals.push(`Salary fit: up to ${job.currency} ${job.salaryMax.toLocaleString()}`)
    } else if (typeof job.salaryMin === "number" && job.salaryMin > 0 && job.salaryMin < profile.salaryFloor) {
      factors.salary -= 6
      concerns.push("Published salary range appears below your saved floor")
    }
  }

  const score = Math.max(0, Math.min(100, Object.values(factors).reduce((s, v) => s + v, 0)))

  logger.debug("match_scored", {
    jobId: job.id,
    jobTitle: job.title,
    company: job.company,
    profileSkills: profileSkills.length,
    profileTargetRoles: targetRoles,
    factors,
    score,
  })

  const rationale = [
    fitSignals[0] ?? "Review this listing manually",
    fitSignals[1],
    concerns[0] ? `Note: ${concerns[0]}` : null,
  ]
    .filter(Boolean)
    .join(". ")

  return { score, rationale, fitSignals, concerns }
}

// ─── AI-powered matching (single-job draft generation) ────────────────────────

export async function buildAiMatchResult(
  profile: CandidateProfile | null,
  job: MatchableJob,
  resumeText: string | null
): Promise<MatchResult> {
  // Always run algorithmic first — it enforces visa/salary hard rules reliably.
  const baseline = buildMatchResult(profile, job)

  if (!isOpenRouterEnabled()) {
    logger.info("ai_match_skipped_no_key", { jobId: job.id })
    return baseline
  }

  const candidateContext = [
    `Skills: ${profile?.skills?.join(", ") || "not listed"}`,
    `Target roles: ${profile?.targetRoles?.join(", ") || "not specified — open to any role"}`,
    `Target countries: ${profile?.targetCountries?.join(", ") || "not specified"}`,
    `Current country: ${profile?.currentCountry ?? "unknown"}`,
    `Years of experience: ${profile?.yearsExperience ?? "not specified"}`,
    `Needs visa sponsorship: ${profile?.needsVisaSponsorship ? "yes" : "no"}`,
    `Prefers remote work: ${profile?.prefersRemote ? "yes" : "no"}`,
    `Salary floor: ${profile?.salaryFloor ? `${profile.preferredCurrency} ${profile.salaryFloor.toLocaleString()}` : "not set"}`,
    profile?.summary ? `\nProfessional summary:\n${profile.summary}` : "",
    resumeText ? `\nFull CV / Resume:\n${resumeText.slice(0, 3000)}` : "\n(No CV uploaded yet)",
  ]
    .filter(Boolean)
    .join("\n")

  const jobContext = [
    `Title: ${job.title}`,
    `Company: ${job.company}`,
    `Location: ${job.location ?? "not specified"} (country code: ${job.countryCode ?? "unknown"})`,
    `Work mode: ${job.workMode}`,
    `Employment type: ${job.employmentType}`,
    `Visa sponsorship: ${job.visaSponsorshipStatus}`,
    job.salaryMin || job.salaryMax
      ? `Salary: ${job.currency ?? ""} ${job.salaryMin ?? "?"} – ${job.salaryMax ?? "?"}`
      : "Salary: not disclosed",
    `Tags: ${job.tags.join(", ") || "none"}`,
    `\nFull job description:\n${job.description?.slice(0, 2500) ?? "not provided"}`,
  ].join("\n")

  logger.info("ai_match_started", {
    jobId: job.id,
    jobTitle: job.title,
    hasProfile: Boolean(profile),
    hasResume: Boolean(resumeText),
    profileSkillsCount: profile?.skills?.length ?? 0,
    profileTargetRoles: profile?.targetRoles ?? [],
    baselineScore: baseline.score,
  })

  try {
    const response = await chatComplete(
      [
        {
          role: "system",
          content: `You are a specialist UK visa-sponsored job matching engine. Your job is to score how well a candidate fits a specific job.

Evaluate the candidate's CV, skills, experience, and preferences against the job description. Be analytical and specific — no vague generalisations.

Return ONLY valid JSON with exactly this structure:
{
  "score": <integer 0–100>,
  "rationale": "<2–3 sentences: overall fit, strongest signal, main concern>",
  "fitSignals": ["<specific positive signal from CV or profile>", ...],
  "concerns": ["<specific gap or risk>", ...]
}

Scoring:
- 80–100: Excellent — strong CV match, role squarely in their target, visa handled
- 60–79: Good — solid match, minor gaps
- 40–59: Partial — worth reviewing, notable gaps
- 20–39: Weak — significant mismatch
- 0–19: Poor — major blocker (e.g. no sponsorship when candidate needs it, completely different field)

CRITICAL RULES:
- If candidate needs visa sponsorship AND role says "not_available": score must be ≤ 15
- If candidate has saved target roles AND this job title matches none of them: score cannot exceed 45 unless CV experience is a very strong direct match
- Use evidence from the actual CV text, not just the skills list
- fitSignals must reference specific things from the CV or job description, not generic phrases
- Be honest about concerns`,
        },
        {
          role: "user",
          content: `CANDIDATE PROFILE & CV:\n${candidateContext}\n\n---\n\nJOB:\n${jobContext}\n\n---\n\nAlgorithmic baseline score for reference: ${baseline.score}/100\nBaseline signals: ${baseline.fitSignals.join(", ") || "none"}\nBaseline concerns: ${baseline.concerns.join(", ") || "none"}`,
        },
      ],
      { temperature: 0.2, maxTokens: 600, jsonMode: true }
    )

    const parsed = JSON.parse(response) as Partial<MatchResult>
    const aiScore = Math.max(0, Math.min(100, Number(parsed.score ?? baseline.score)))

    logger.info("ai_match_done", {
      jobId: job.id,
      jobTitle: job.title,
      baselineScore: baseline.score,
      aiScore,
      fitSignals: parsed.fitSignals,
      concerns: parsed.concerns,
    })

    return {
      score: aiScore,
      rationale: parsed.rationale || baseline.rationale,
      fitSignals: Array.isArray(parsed.fitSignals) && parsed.fitSignals.length > 0
        ? parsed.fitSignals
        : baseline.fitSignals,
      concerns: Array.isArray(parsed.concerns) ? parsed.concerns : baseline.concerns,
    }
  } catch (err) {
    logger.error("ai_match_failed", { jobId: job.id, error: String(err) })
    return baseline
  }
}
