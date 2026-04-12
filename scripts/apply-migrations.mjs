import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import postgres from "postgres"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, "..")

function loadEnvFile(filename) {
  const fullPath = path.join(projectRoot, filename)
  if (!fs.existsSync(fullPath)) {
    return {}
  }

  const content = fs.readFileSync(fullPath, "utf8")
  const env = {}

  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const separatorIndex = trimmed.indexOf("=")
    if (separatorIndex === -1) continue

    const key = trimmed.slice(0, separatorIndex).trim()
    let value = trimmed.slice(separatorIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    env[key] = value
  }

  return env
}

const env = {
  ...loadEnvFile(".env"),
  ...loadEnvFile(".env.local"),
  ...process.env,
}

const connectionString = env.DATABASE_URL

if (!connectionString) {
  console.error("DATABASE_URL is not set in process.env, .env, or .env.local")
  process.exit(1)
}

const migrationsDir = path.join(projectRoot, "supabase", "migrations")
const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort()

const sql = postgres(connectionString, {
  prepare: false,
  max: 1,
  onnotice: () => {},
})

const migrationProbes = {
  "0001_setup.sql": async () => {
    const [row] = await sql`
      select
        to_regclass('public.profiles') as profiles_table,
        to_regtype('visibility') as visibility_type
    `

    return Boolean(row?.profiles_table && row?.visibility_type)
  },
  "0002_visa_platform.sql": async () => {
    const [row] = await sql`
      select
        to_regclass('public.candidate_profiles') as candidate_profiles_table,
        to_regclass('public.job_sources') as job_sources_table
    `

    return Boolean(row?.candidate_profiles_table && row?.job_sources_table)
  },
}

try {
  await sql`
    create table if not exists public.meh_tracker_schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `

  const appliedRows = await sql`
    select name from public.meh_tracker_schema_migrations
  `
  const applied = new Set(appliedRows.map((row) => row.name))

  for (const file of migrationFiles) {
    if (applied.has(file)) {
      console.log(`Skipping ${file}`)
      continue
    }

    const probe = migrationProbes[file]
    if (probe && (await probe())) {
      console.log(`Marking ${file} as already applied`)
      await sql`
        insert into public.meh_tracker_schema_migrations (name)
        values (${file})
        on conflict (name) do nothing
      `
      continue
    }

    const migrationSql = fs.readFileSync(path.join(migrationsDir, file), "utf8")
    console.log(`Applying ${file}`)

    await sql.begin(async (tx) => {
      await tx.unsafe(migrationSql)
      await tx`
        insert into public.meh_tracker_schema_migrations (name)
        values (${file})
      `
    })
  }

  console.log("Migrations are up to date.")
} catch (error) {
  console.error("Migration failed.")
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await sql.end()
}
