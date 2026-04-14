import type { CandidateProfile, Job, ResumeVersion } from "@/lib/db/schema"
import { chatComplete, isOpenRouterEnabled } from "@/lib/openrouter"
import { logger } from "@/lib/logger"
import type { MatchResult } from "@/lib/visa-platform/matching"

// ─── Context builders ─────────────────────────────────────────────────────────

function candidateBlock(profile: CandidateProfile | null, cvText: string | null): string {
  return [
    `Name/identity: (not disclosed)`,
    `Skills: ${profile?.skills?.join(", ") || "not listed"}`,
    `Target roles: ${profile?.targetRoles?.join(", ") || "not specified"}`,
    `Target countries: ${profile?.targetCountries?.join(", ") || "not specified"}`,
    `Current country: ${profile?.currentCountry ?? "unknown"}`,
    `Years of experience: ${profile?.yearsExperience ?? "not specified"}`,
    `Needs visa sponsorship: ${profile?.needsVisaSponsorship ? "yes" : "no"}`,
    `Preferred work mode: ${profile?.prefersRemote ? "remote / hybrid" : "any"}`,
    `Salary floor: ${profile?.salaryFloor ? `${profile.preferredCurrency} ${profile.salaryFloor.toLocaleString()}` : "not set"}`,
    profile?.summary ? `\nProfessional summary:\n${profile.summary}` : "",
    cvText
      ? `\nFull CV content:\n${cvText.slice(0, 3500)}`
      : "\n(No CV uploaded — work from profile data and skills only)",
  ]
    .filter(Boolean)
    .join("\n")
}

function jobBlock(
  job: Pick<Job, "title" | "company" | "description" | "tags" | "location" | "visaSponsorshipStatus" | "workMode">
): string {
  return [
    `Role: ${job.title}`,
    `Company: ${job.company}`,
    job.location ? `Location: ${job.location}` : "",
    `Work mode: ${job.workMode}`,
    `Visa sponsorship: ${job.visaSponsorshipStatus}`,
    job.tags.length > 0 ? `Tags: ${job.tags.join(", ")}` : "",
    `\nJob description:\n${job.description?.slice(0, 2500) ?? "not provided"}`,
  ]
    .filter(Boolean)
    .join("\n")
}

function cvText(profile: CandidateProfile | null, resumeVersion: ResumeVersion | null): string | null {
  return (
    resumeVersion?.normalizedText ??
    resumeVersion?.extractedText ??
    profile?.summary ??
    null
  )
}

// ─── Fallback templates (only used when AI is unavailable or fails) ───────────

function fallbackTailoredResume(
  job: Pick<Job, "title" | "company" | "description" | "tags" | "location">,
  profile: CandidateProfile | null,
  resumeVersion: ResumeVersion | null,
  match: Pick<MatchResult, "fitSignals" | "concerns">
): string {
  const base = cvText(profile, resumeVersion) ?? "Add your experience here."
  const skills = profile?.skills?.join(", ") || "Add your core skills here."
  return [
    `# CV — ${job.title} at ${job.company}`,
    ``,
    `## Professional Summary`,
    profile?.summary ?? `${job.title} candidate with experience in ${skills}.`,
    ``,
    `## Core Skills`,
    skills,
    ``,
    `## Why This Role`,
    ...(match.fitSignals.length > 0
      ? match.fitSignals.slice(0, 5).map((s) => `- ${s}`)
      : [`- Strong alignment with ${job.title} responsibilities.`]),
    ``,
    `## Experience`,
    base,
    match.concerns.length > 0
      ? `\n## Points to Address\n${match.concerns.map((c) => `- ${c}`).join("\n")}`
      : "",
  ]
    .filter((l) => l !== "")
    .join("\n")
}

function fallbackCoverLetter(
  job: Pick<Job, "title" | "company" | "location" | "visaSponsorshipStatus">,
  profile: CandidateProfile | null,
  match: Pick<MatchResult, "rationale">
): string {
  return [
    `Dear Hiring Team at ${job.company},`,
    ``,
    `I am writing to apply for the ${job.title} position${job.location ? ` in ${job.location}` : ""}. ${match.rationale}`,
    ``,
    `I bring experience in ${profile?.skills?.slice(0, 4).join(", ") || "the relevant areas"} and am targeting ${profile?.targetRoles?.join(", ") || job.title} roles.`,
    ``,
    profile?.needsVisaSponsorship
      ? `I require visa sponsorship${job.visaSponsorshipStatus === "eligible" ? ", and I'm pleased this role supports it." : " and would welcome a conversation about this."}`
      : `I am fully eligible to work in the relevant jurisdiction.`,
    ``,
    `Thank you for your time.`,
  ].join("\n")
}

function fallbackApplicationAnswers(
  job: Pick<Job, "title" | "company" | "visaSponsorshipStatus">,
  profile: CandidateProfile | null,
  match: Pick<MatchResult, "fitSignals" | "concerns">
): string {
  return [
    `## Why this role?`,
    `This ${job.title} role aligns with my target direction and key strengths: ${match.fitSignals.slice(0, 3).join(", ") || "see profile"}.`,
    ``,
    `## Why ${job.company}?`,
    `${job.company} represents a strong fit for my international career goals. [Personalise with company research before submitting.]`,
    ``,
    `## Visa / right to work`,
    profile?.needsVisaSponsorship
      ? job.visaSponsorshipStatus === "eligible"
        ? `I require visa sponsorship. This role is listed as sponsorship-eligible.`
        : `I require visa sponsorship — please confirm before proceeding.`
      : `I do not require visa sponsorship.`,
    match.concerns.length > 0
      ? `\n## Points to clarify\n${match.concerns.map((c) => `- ${c}`).join("\n")}`
      : "",
  ]
    .filter((l) => l !== "")
    .join("\n")
}

function fallbackPersonalStatement(
  job: Pick<Job, "title">,
  profile: CandidateProfile | null
): string {
  return [
    `I am a ${profile?.targetRoles?.join(" / ") || job.title} professional with ${profile?.yearsExperience ? `${profile.yearsExperience} years` : "several years"} of experience in ${profile?.skills?.slice(0, 4).join(", ") || "my field"}. I am driven by [add your motivation], committed to [add your value], and currently seeking my next role in ${profile?.targetCountries?.join(", ") || "my target market"}.`,
    ``,
    `[Expand with 2–3 specific achievements before submitting.]`,
  ].join("\n")
}

function fallbackWhyCompany(
  job: Pick<Job, "title" | "company">,
  profile: CandidateProfile | null
): string {
  return [
    `${job.company} is a strong fit for my next step as a ${profile?.targetRoles?.[0] ?? job.title} professional. The scope of this role aligns with where I want to take my career.`,
    ``,
    `[Add specific reasons — e.g. company mission, products, recent news, or culture — before submitting.]`,
  ].join("\n")
}

function fallbackInterviewQA(
  job: Pick<Job, "title" | "company">,
  profile: CandidateProfile | null
): string {
  return [
    `## Interview Prep — ${job.title} at ${job.company}`,
    ``,
    `**Q: Tell me about yourself.**`,
    `A: I am a ${profile?.targetRoles?.[0] ?? job.title} professional with experience in ${profile?.skills?.slice(0, 4).join(", ") || "my field"}. [Expand with a specific career narrative.]`,
    ``,
    `**Q: Why do you want this role?**`,
    `A: [Tailor to the specific responsibilities listed in the job description.]`,
    ``,
    `**Q: What is your greatest strength?**`,
    `A: [Choose one skill from your profile and back it with a specific example from your CV.]`,
    ``,
    `**Q: Do you require visa sponsorship?**`,
    `A: ${profile?.needsVisaSponsorship ? "Yes — I require sponsorship and am experienced navigating this process." : "No — I am fully authorised to work in the target country."}`,
    ``,
    `[Add role-specific technical and behavioural questions from the job description.]`,
  ].join("\n")
}

// ─── AI generators ────────────────────────────────────────────────────────────

type ArtifactJob = Pick<
  Job,
  "title" | "company" | "description" | "tags" | "location" | "visaSponsorshipStatus" | "workMode"
>

async function generateWithFallback(
  artifactType: string,
  job: ArtifactJob,
  profile: CandidateProfile | null,
  aiCall: () => Promise<string>,
  fallbackCall: () => string
): Promise<{ content: string; aiGenerated: boolean }> {
  if (!isOpenRouterEnabled()) {
    logger.info("artifact_ai_skipped", { artifactType, reason: "no_api_key" })
    return { content: fallbackCall(), aiGenerated: false }
  }

  try {
    logger.info("artifact_ai_started", {
      artifactType,
      jobTitle: job.title,
      company: job.company,
      hasProfile: Boolean(profile),
      hasSkills: (profile?.skills?.length ?? 0) > 0,
      hasTargetRoles: (profile?.targetRoles?.length ?? 0) > 0,
    })
    const content = await aiCall()
    logger.info("artifact_ai_done", { artifactType, jobTitle: job.title, chars: content.length })
    return { content, aiGenerated: true }
  } catch (err) {
    logger.error("artifact_ai_failed_using_fallback", {
      artifactType,
      jobTitle: job.title,
      error: String(err),
    })
    return { content: fallbackCall(), aiGenerated: false }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type ArtifactOutput = {
  type:
    | "tailored_resume"
    | "cover_letter"
    | "application_answers"
    | "personal_statement"
    | "why_company"
    | "interview_qa"
  title: string
  content: string
  aiGenerated: boolean
}

export async function generateAllArtifacts(
  job: ArtifactJob,
  profile: CandidateProfile | null,
  resumeVersion: ResumeVersion | null,
  match: MatchResult
): Promise<ArtifactOutput[]> {
  const cv = cvText(profile, resumeVersion)
  const candidate = candidateBlock(profile, cv)
  const jobCtx = jobBlock(job)
  const matchCtx = `Match score: ${match.score}/100\nFit signals: ${match.fitSignals.join(", ") || "none"}\nConcerns: ${match.concerns.join(", ") || "none"}`

  logger.info("generate_artifacts_started", {
    jobTitle: job.title,
    company: job.company,
    hasCV: Boolean(cv),
    cvChars: cv?.length ?? 0,
    profileSkills: profile?.skills?.length ?? 0,
    profileTargetRoles: profile?.targetRoles ?? [],
    matchScore: match.score,
    aiEnabled: isOpenRouterEnabled(),
  })

  const [tailoredResume, coverLetter, applicationAnswers, personalStatement, whyCompany, interviewQA] =
    await Promise.all([
      generateWithFallback(
        "tailored_resume",
        job,
        profile,
        () =>
          chatComplete(
            [
              {
                role: "system",
                content: `You are an expert CV writer specialising in UK visa-sponsored roles. Rewrite and restructure the candidate's CV to specifically target this job.

Rules:
- Mirror the job's language naturally — do not keyword-stuff
- Lead with a strong, tailored professional summary (3–4 sentences)
- Reorder and reframe experience bullet points to foreground the most relevant work
- Do NOT fabricate experience — only restructure and reframe what exists in the CV
- If no CV is provided, build from the profile skills and summary
- Format in clean markdown
- Aim for one-page length equivalent`,
              },
              {
                role: "user",
                content: `JOB:\n${jobCtx}\n\nCANDIDATE:\n${candidate}\n\n${matchCtx}`,
              },
            ],
            { temperature: 0.4, maxTokens: 2048 }
          ),
        () => fallbackTailoredResume(job, profile, resumeVersion, match)
      ),

      generateWithFallback(
        "cover_letter",
        job,
        profile,
        () =>
          chatComplete(
            [
              {
                role: "system",
                content: `You are a professional career coach writing cover letters for UK job applications (including visa-sponsored roles).

Rules:
- 3–4 paragraphs, under 350 words
- Open with a strong hook — no "I am writing to apply for..."
- Be specific to this company and role — reference real things from the job description
- Paragraph 2: lead evidence from the CV that directly addresses this role's needs
- Paragraph 3: why this specific company, not just the role
- Close: confident call to action
- If visa sponsorship is needed, handle it in one sentence — brief, factual, confident
- No clichés, no filler phrases`,
              },
              {
                role: "user",
                content: `JOB:\n${jobCtx}\n\nCANDIDATE:\n${candidate}\n\n${matchCtx}`,
              },
            ],
            { temperature: 0.6, maxTokens: 1024 }
          ),
        () => fallbackCoverLetter(job, profile, match)
      ),

      generateWithFallback(
        "application_answers",
        job,
        profile,
        () =>
          chatComplete(
            [
              {
                role: "system",
                content: `You are a job application coach. Generate model answers to the most likely application form questions for this specific role.

Format:
**Q: [question]**
A: [answer — 2–4 sentences, grounded in the candidate's actual CV and profile]

Cover these question types (customise to this specific role):
1. Why do you want this role?
2. Why do you want to work at [company]?
3. Describe relevant experience
4. Your greatest achievement
5. How do you handle [relevant challenge for this role]
6. Salary expectations (if known)
7. Visa / right-to-work status
8. Any concerns or gaps (address the match concerns directly)

Base answers on the actual CV content. Be specific.`,
              },
              {
                role: "user",
                content: `JOB:\n${jobCtx}\n\nCANDIDATE:\n${candidate}\n\n${matchCtx}`,
              },
            ],
            { temperature: 0.5, maxTokens: 2000 }
          ),
        () => fallbackApplicationAnswers(job, profile, match)
      ),

      generateWithFallback(
        "personal_statement",
        job,
        profile,
        () =>
          chatComplete(
            [
              {
                role: "system",
                content: `You are a career advisor. Write a 150–200 word professional personal statement for a CV or application form.

Rules:
- Confident, first-person, professional tone
- No clichés ("passionate", "hardworking", "team player" without evidence)
- Sentence 1–2: who the candidate is + core expertise
- Sentence 3–4: what they specifically bring + standout achievement or capability from CV
- Sentence 5: what they are seeking and why this role/company
- Grounded in the actual CV content`,
              },
              {
                role: "user",
                content: `TARGET JOB:\n${jobCtx}\n\nCANDIDATE:\n${candidate}`,
              },
            ],
            { temperature: 0.5, maxTokens: 512 }
          ),
        () => fallbackPersonalStatement(job, profile)
      ),

      generateWithFallback(
        "why_company",
        job,
        profile,
        () =>
          chatComplete(
            [
              {
                role: "system",
                content: `You are an interview coach. Write a compelling answer (150–200 words) to "Why do you want to work at [company]?" for this specific role.

Rules:
- Extract clues from the job description about company focus, culture, values, product, or mission
- Connect those specifically to the candidate's goals and CV background
- Be concrete — reference things actually in the job description
- First person, interview-ready tone
- Do NOT write generic praise ("innovative company", "market leader")`,
              },
              {
                role: "user",
                content: `JOB:\n${jobCtx}\n\nCANDIDATE:\n${candidate}`,
              },
            ],
            { temperature: 0.6, maxTokens: 512 }
          ),
        () => fallbackWhyCompany(job, profile)
      ),

      generateWithFallback(
        "interview_qa",
        job,
        profile,
        () =>
          chatComplete(
            [
              {
                role: "system",
                content: `You are an interview preparation coach. Generate 8–10 likely interview questions for this specific role and write model answers based on the candidate's CV.

Format:
**Q: [question]**
A: [model answer — 2–4 sentences, STAR format for behavioural questions, grounded in actual CV content]

Include:
- 3 role-specific technical questions (based on job description requirements)
- 3 behavioural questions (STAR format)
- 2 motivation questions (why role, why company)
- 1 visa/right-to-work question if applicable
- 1 wildcard (e.g. weakness, failure, disagreement)

Base every answer on the candidate's actual background. Do not fabricate.`,
              },
              {
                role: "user",
                content: `JOB:\n${jobCtx}\n\nCANDIDATE:\n${candidate}\n\n${matchCtx}`,
              },
            ],
            { temperature: 0.5, maxTokens: 2500 }
          ),
        () => fallbackInterviewQA(job, profile)
      ),
    ])

  return [
    {
      type: "tailored_resume",
      title: `${job.title} at ${job.company} — tailored CV`,
      ...tailoredResume,
    },
    {
      type: "cover_letter",
      title: `Cover letter — ${job.title} at ${job.company}`,
      ...coverLetter,
    },
    {
      type: "application_answers",
      title: `Application answers — ${job.title} at ${job.company}`,
      ...applicationAnswers,
    },
    {
      type: "personal_statement",
      title: `Personal statement — ${job.title} at ${job.company}`,
      ...personalStatement,
    },
    {
      type: "why_company",
      title: `Why ${job.company}?`,
      ...whyCompany,
    },
    {
      type: "interview_qa",
      title: `Interview prep — ${job.title} at ${job.company}`,
      ...interviewQA,
    },
  ]
}
