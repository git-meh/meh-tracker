const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Safari/605.1.15",
]

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function jitter(minMs: number, maxMs: number): Promise<void> {
  const delay = minMs + Math.random() * (maxMs - minMs)
  return sleep(delay)
}

export type FetchOptions = {
  headers?: Record<string, string>
  method?: "GET" | "POST"
  body?: string
  retries?: number
  minDelayMs?: number
  maxDelayMs?: number
  timeoutMs?: number
}

export async function fetchPage(url: string, opts: FetchOptions = {}): Promise<string> {
  const {
    headers = {},
    method = "GET",
    body,
    retries = 3,
    minDelayMs = 1000,
    maxDelayMs = 3000,
    timeoutMs = 15_000,
  } = opts

  const defaultHeaders: Record<string, string> = {
    "User-Agent": randomUA(),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8",
    "Accept-Language": "en-GB,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Cache-Control": "no-cache",
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await jitter(minDelayMs, maxDelayMs)
    }
    try {
      const res = await fetch(url, {
        method,
        headers: { ...defaultHeaders, ...headers },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      })

      if (res.status === 404) {
        throw new NotFoundError(`404: ${url}`)
      }

      if (res.status === 429) {
        const retryAfter = res.headers.get("retry-after")
        const wait = retryAfter ? parseInt(retryAfter) * 1000 : 30_000 * (attempt + 1)
        console.warn(`[fetch] Rate limited on ${url}. Waiting ${wait}ms`)
        await sleep(wait)
        continue
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} on ${url}`)
      }

      const text = await res.text()

      // Detect CAPTCHA pages
      const lower = text.toLowerCase()
      if (lower.includes("captcha") || lower.includes("cf-chl-") || lower.includes("robot")) {
        throw new BlockedError(`CAPTCHA/bot block detected on ${url}`)
      }

      return text
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof BlockedError) throw err
      if (attempt === retries) throw err
      const wait = 2000 * Math.pow(2, attempt)
      console.warn(`[fetch] Attempt ${attempt + 1} failed for ${url}: ${err}. Retrying in ${wait}ms`)
      await sleep(wait)
    }
  }

  throw new Error(`All retries exhausted for ${url}`)
}

export async function fetchJson<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  const text = await fetchPage(url, {
    ...opts,
    headers: {
      "Accept": "application/json",
      ...opts.headers,
    },
  })
  return JSON.parse(text) as T
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "NotFoundError"
  }
}

export class BlockedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BlockedError"
  }
}

export { sleep, jitter }
