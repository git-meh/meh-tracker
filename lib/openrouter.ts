const BASE_URL = "https://openrouter.ai/api/v1"

// Free model — strong default for document-heavy writing tasks.
const DEFAULT_MODEL = "google/gemma-4-31b-it:free"
const DEFAULT_FALLBACK_MODELS = [
  "openai/gpt-oss-20b:free",
  "openrouter/free",
]

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

  for (const model of models) {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
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
    })

    if (!response.ok) {
      const body = await response.text().catch(() => "(no body)")
      const message = `model=${model} status=${response.status} body=${body.slice(0, 300)}`
      errors.push(message)

      if (shouldFallback(response.status)) {
        continue
      }

      throw new Error(`OpenRouter ${message}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content as string | undefined
    if (content) {
      return content
    }

    errors.push(`model=${model} returned empty content`)
  }

  throw new Error(
    `OpenRouter failed across models: ${errors.join(" | ").slice(0, 1500)}`
  )
}
