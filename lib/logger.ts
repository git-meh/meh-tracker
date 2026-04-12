/**
 * Structured JSON logger.
 * Every log line is a single JSON object written to stdout.
 * In production use `pino`, in dev this is zero-dependency.
 */

type Level = "info" | "warn" | "error" | "debug"

type LogPayload = Record<string, unknown>

function write(level: Level, message: string, payload: LogPayload = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    message,
    ...payload,
  })
  if (level === "error" || level === "warn") {
    process.stderr.write(line + "\n")
  } else {
    process.stdout.write(line + "\n")
  }
}

export const logger = {
  info: (message: string, payload?: LogPayload) => write("info", message, payload),
  warn: (message: string, payload?: LogPayload) => write("warn", message, payload),
  error: (message: string, payload?: LogPayload) => write("error", message, payload),
  debug: (message: string, payload?: LogPayload) => {
    if (process.env.LOG_LEVEL === "debug") write("debug", message, payload)
  },
}

/** Wrap an API route handler with request/response logging. */
export function withLogging(
  handler: (req: Request, ctx: unknown) => Promise<Response>,
  route: string
) {
  return async (req: Request, ctx: unknown): Promise<Response> => {
    const start = Date.now()
    let status = 500
    try {
      const res = await handler(req, ctx)
      status = res.status
      return res
    } finally {
      logger.info("api_request", {
        route,
        method: req.method,
        status,
        durationMs: Date.now() - start,
      })
    }
  }
}
