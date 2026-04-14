const BASE_URL = "https://openrouter.ai/api/v1"

// Free model — strong default for document-heavy writing tasks.
const DEFAULT_MODEL = "google/gemma-4-31b-it:free"
const DEFAULT_FALLBACK_MODELS = [
  "openai/gpt-oss-20b:free",
  "openrouter/free",
]
const DEFAULT_MAX_RETRIES = 1
const DEFAULT_RETRY_BASE_DELAY_MS = 750
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000

export type Message = {
  role: "system" | "user" | "assistant"
  content: string
}

export function isOpenRouterEnabled(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY)
}

function parseFallbackModels(value: string | undefined): string[] {
  return String(value ?? "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean)
}

function getModelCandidates(explicitModel?: string): string[] {
  const models = [
    explicitModel,
    process.env.OPENROUTER_MODEL,
    DEFAULT_MODEL,
    ...parseFallbackModels(process.env.OPENROUTER_FALLBACK_MODELS),
    ...DEFAULT_FALLBACK_MODELS,
  ].filter(Boolean) as string[]

  return [...new Set(models)]
}

function shouldFallback(status: number): boolean {
  return status === 404 || status === 408 || status === 429 || status >= 500
}

function getEnvNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function extractTextFromContent(content: unknown): string | null {
  if (typeof content === "string") {
    const trimmed = content.trim()
    return trimmed ? trimmed : null
  }

  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (typeof part === "string") return part
        if (part && typeof part === "object") {
          if ("text" in part && typeof part.text === "string") {
            return part.text
          }

          if ("content" in part && typeof part.content === "string") {
            return part.content
          }
        }

        return null
      })
      .filter(Boolean)
      .join("\n")
      .trim()

    return text ? text : null
  }

  return null
}

export async function chatComplete(
  messages: Message[],
  options: {
    model?: string
    temperature?: number
    maxTokens?: number
    jsonMode?: boolean
  } = {}
): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error("OPENROUTER_API_KEY is not configured")
  const models = getModelCandidates(options.model)
  const errors: string[] = []
  const maxRetries = getEnvNumber(
    process.env.OPENROUTER_MAX_RETRIES,
    DEFAULT_MAX_RETRIES
  )
  const retryBaseDelayMs = getEnvNumber(
    process.env.OPENROUTER_RETRY_BASE_DELAY_MS,
    DEFAULT_RETRY_BASE_DELAY_MS
  )
  const requestTimeoutMs = getEnvNumber(
    process.env.OPENROUTER_REQUEST_TIMEOUT_MS,
    DEFAULT_REQUEST_TIMEOUT_MS
  )

  for (const model of models) {
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      let response: Response

      try {
        response = await fetch(`${BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://localhost:3000",
            "X-Title": "Meh Tracker",
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: options.temperature ?? 0.4,
            max_tokens: options.maxTokens ?? 2048,
            ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
          }),
          signal: AbortSignal.timeout(requestTimeoutMs),
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        errors.push(`model=${model} attempt=${attempt + 1} network_error=${message}`)
        break
      }

      if (!response.ok) {
        const body = await response.text().catch(() => "(no body)")
        const message = `model=${model} attempt=${attempt + 1} status=${response.status} body=${body.slice(0, 300)}`

        if (response.status === 429 && attempt < maxRetries) {
          errors.push(`${message} retrying`)
          await sleep(retryBaseDelayMs * (attempt + 1))
          continue
        }

        errors.push(message)

        if (shouldFallback(response.status)) {
          break
        }

        throw new Error(`OpenRouter ${message}`)
      }

      const data = await response.json()
      const content = extractTextFromContent(data.choices?.[0]?.message?.content)
      if (content) {
        return content
      }

      errors.push(`model=${model} attempt=${attempt + 1} returned empty content`)

      if (attempt < maxRetries) {
        await sleep(retryBaseDelayMs * (attempt + 1))
        continue
      }

      break
    }
  }

  throw new Error(
    `OpenRouter failed across models: ${errors.join(" | ").slice(0, 1500)}`
  )
}
