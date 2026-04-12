/** Structured JSON logger for scraper processes. */

type Level = "info" | "warn" | "error" | "debug"
type Payload = Record<string, unknown>

function write(level: Level, message: string, payload: Payload = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, message, ...payload })
  if (level === "error" || level === "warn") {
    process.stderr.write(line + "\n")
  } else {
    process.stdout.write(line + "\n")
  }
}

export const log = {
  info:  (message: string, payload?: Payload) => write("info",  message, payload),
  warn:  (message: string, payload?: Payload) => write("warn",  message, payload),
  error: (message: string, payload?: Payload) => write("error", message, payload),
  debug: (message: string, payload?: Payload) => {
    if (process.env.LOG_LEVEL === "debug") write("debug", message, payload)
  },
}
