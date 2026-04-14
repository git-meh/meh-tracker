const BASE_URL = "https://openrouter.ai/api/v1"

// Free model — fast, large context, solid quality for document tasks
const DEFAULT_MODEL = "google/gemini-2.0-flash-exp:free"

export type Message = {
  role: "system" | "user" | "assistant"
  content: string
}

export function isOpenRouterEnabled(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY)
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

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://localhost:3000",
      "X-Title": "Meh Tracker",
    },
    body: JSON.stringify({
      model: options.model ?? DEFAULT_MODEL,
      messages,
      temperature: options.temperature ?? 0.4,
      max_tokens: options.maxTokens ?? 2048,
      ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "(no body)")
    throw new Error(`OpenRouter ${response.status}: ${body.slice(0, 300)}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content as string | undefined
  if (!content) throw new Error("OpenRouter returned empty content")
  return content
}
