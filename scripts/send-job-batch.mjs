import fs from "node:fs"
import path from "node:path"

function readArg(flag) {
  const index = process.argv.indexOf(flag)
  if (index === -1) return null
  return process.argv[index + 1] ?? null
}

const fileArg = readArg("--file")
const urlArg = readArg("--url") ?? process.env.NEXT_PUBLIC_APP_URL
const apiKeyArg = readArg("--api-key") ?? process.env.JOB_INGESTION_API_KEY
const sourceIdArg = readArg("--source-id")

if (!fileArg) {
  console.error("Usage: node scripts/send-job-batch.mjs --file ./jobs.json [--url http://localhost:3000] [--api-key your-key] [--source-id uuid]")
  process.exit(1)
}

if (!urlArg) {
  console.error("Missing --url and NEXT_PUBLIC_APP_URL is not set.")
  process.exit(1)
}

if (!apiKeyArg) {
  console.error("Missing --api-key and JOB_INGESTION_API_KEY is not set.")
  process.exit(1)
}

const filePath = path.resolve(process.cwd(), fileArg)
if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`)
  process.exit(1)
}

const raw = fs.readFileSync(filePath, "utf8")
const jobs = JSON.parse(raw)

if (!Array.isArray(jobs)) {
  console.error("Input file must contain a JSON array of job objects.")
  process.exit(1)
}

const endpoint = new URL("/api/job-sources/ingest", urlArg).toString()
const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-job-ingestion-key": apiKeyArg,
  },
  body: JSON.stringify({
    sourceId: sourceIdArg,
    jobs,
  }),
})

const data = await response.json().catch(() => ({}))

if (!response.ok) {
  console.error("Ingestion failed.")
  console.error(JSON.stringify(data, null, 2))
  process.exit(1)
}

console.log("Ingestion succeeded.")
console.log(JSON.stringify(data, null, 2))
