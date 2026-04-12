# Visa Platform Guide

This guide explains:

1. What has already been built
2. What is not built yet
3. Which environment variables you must configure
4. How to load jobs into the platform, including scraped jobs
5. How users use the workspace, matching, draft review, and application tracking flows

## What Exists Now

The app now has these new capabilities:

- `Candidate workspace` at `/workspace`
  - candidate profile
  - visa preferences
  - salary / location / target-role preferences
  - CV library and version records
  - automation preferences
  - saved searches
  - notification event history

- `AI matches` at `/matches`
  - refresh per-user job matching
  - generate tailored draft packages for jobs
  - approve or reject drafts
  - create tracked applications from approved drafts

- `Job discovery` at `/jobs`
  - filters for sponsorship, country, source type, work mode, employment type, salary, and match-only
  - saved-search support
  - source metadata shown on job cards

- `Application audit trail` at `/applications/[id]`
  - generated package artifacts
  - automation attempts
  - external confirmation links
  - match reason and source details

- `Job ingestion foundation`
  - new schema for job sources, ingestion runs, candidate profiles, job matches, application drafts, artifacts, application runs, saved searches, and notification events
  - ingestion API at `POST /api/job-sources/ingest`
  - migration runner via `npm run db:migrate`

## What Is Not Built Yet

This is the important clarification:

- The platform can now **accept and serve scraped jobs**, dedupe them, filter them, match them, and let users apply/track them.
- The platform does **not yet include bundled board-specific scraper workers** for "lots of job boards".

In other words:

- `Built`: the intake pipe, storage model, search UI, matching flow, review flow, and audit flow
- `Not yet built`: the actual scrapers/adapters that go out to Greenhouse pages, Lever pages, Workday pages, employer sites, etc., fetch jobs, normalize them, and POST them into the intake pipe

That was deliberate because:

- scraping large job boards has legal and reliability constraints
- different sites need different adapters
- the first plan was "approved feeds first, scraping adapters second"

If you want broad coverage, the next implementation step is:

1. Build one or more external scraper workers
2. Normalize their output into the job JSON format below
3. Push those jobs into this app through the ingestion API

## Required Environment Variables

Add these to `.env.local` or your deployment environment.

### Already required

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### New optional / recommended

```env
# External worker that handles supported auto-apply flows
AUTOMATION_EXECUTOR_WEBHOOK_URL=

# External mailer / notification dispatcher
NOTIFICATION_WEBHOOK_URL=

# Secret used by external scraper/import workers
JOB_INGESTION_API_KEY=change-this-to-a-long-random-secret
```

### What each one does

- `AUTOMATION_EXECUTOR_WEBHOOK_URL`
  - used when a draft is approved and a job is eligible for automated submission
  - if empty, the app still tracks the workflow but marks it as manual-required

- `NOTIFICATION_WEBHOOK_URL`
  - used to send notification events to your email / queue / messaging worker
  - if empty, notification events are recorded but marked as skipped

- `JOB_INGESTION_API_KEY`
  - used by external scraper workers to call `POST /api/job-sources/ingest`
  - send it as the `x-job-ingestion-key` header

## First-Time Setup

### 1. Install and configure env

```bash
npm install
cp .env.example .env.local
```

Fill in all required values.

### 2. Apply database migrations

```bash
npm run db:migrate
```

This repo includes a migration runner:

- it marks the original baseline migration if your database already has it
- it then applies any new migration files in `supabase/migrations`

### 3. Start the app

```bash
npm run dev
```

## How to Use the New Product Flow

### Candidate setup

1. Sign in
2. Open `/workspace`
3. Fill out:
   - current country
   - visa status
   - whether sponsorship is needed
   - target countries
   - preferred locations
   - target roles
   - skills
   - years of experience
   - salary floor
4. Upload one or more CVs
5. Set your automation preferences

### Match and draft flow

1. Open `/matches`
2. Click `Refresh Matches`
3. Review scored jobs
4. Click `Generate Draft`
5. Review the generated package
6. Click `Approve`

On approval:

- a tracked application record is created if one does not exist
- generated artifacts are attached to it
- automation is attempted if the job and user settings allow it
- otherwise it remains manual-required and still fully tracked

### Job discovery flow

Users can go to `/jobs` and:

- search jobs by title / company / keyword
- filter by sponsorship
- filter by work mode
- filter by source type
- filter by salary
- filter by country
- show only matched jobs
- save searches for later

### Application audit flow

Each application page now shows:

- the CV/draft context used
- generated content artifacts
- automation attempts
- status history
- external confirmation links when available

## How Scraped Jobs Enter the Platform

This is the current ingestion path for scraped jobs.

### Option A: External scraper worker posts directly into the app

Your scraper service should:

1. scrape job pages from your chosen sources
2. normalize each job into the app’s JSON shape
3. POST batches to:

```text
POST /api/job-sources/ingest
```

with header:

```text
x-job-ingestion-key: <JOB_INGESTION_API_KEY>
```

### Example request

```bash
curl -X POST "http://localhost:3000/api/job-sources/ingest" \
  -H "Content-Type: application/json" \
  -H "x-job-ingestion-key: your-secret" \
  -d '{
    "jobs": [
      {
        "url": "https://company.example/jobs/backend-engineer-123",
        "title": "Backend Engineer",
        "company": "Example Co",
        "description": "Build internal and external platform services.",
        "salaryRange": "£55,000 - £75,000",
        "salaryMin": 55000,
        "salaryMax": 75000,
        "currency": "GBP",
        "location": "London, UK",
        "countryCode": "GB",
        "tags": ["node", "typescript", "backend"],
        "eligibleCountries": ["GB"],
        "sourceType": "employer_site",
        "sourceJobId": "backend-engineer-123",
        "applyAdapter": "greenhouse",
        "visaSponsorshipStatus": "eligible",
        "workMode": "hybrid",
        "employmentType": "full_time"
      }
    ]
  }'
```

### What happens after ingestion

When a batch is accepted:

- jobs are deduped using `sourceJobId` or URL-derived keys
- jobs are written to `jobs`
- the batch is recorded in `job_ingestion_runs`
- the jobs become searchable on `/jobs`
- users can save them, match against them, generate drafts, and apply/track them

## Local Batch Import Script

This repo now includes a helper script for local or CI ingestion:

```bash
npm run jobs:ingest -- --file ./jobs.json --url http://localhost:3000 --api-key your-secret
```

You can also pass a source id:

```bash
npm run jobs:ingest -- --file ./jobs.json --url http://localhost:3000 --api-key your-secret --source-id your-source-uuid
```

### Expected input file format

The file must contain a JSON array:

```json
[
  {
    "url": "https://company.example/jobs/backend-engineer-123",
    "title": "Backend Engineer",
    "company": "Example Co",
    "description": "Build platform services",
    "salaryRange": "£55,000 - £75,000",
    "salaryMin": 55000,
    "salaryMax": 75000,
    "currency": "GBP",
    "location": "London, UK",
    "countryCode": "GB",
    "tags": ["node", "typescript", "backend"],
    "eligibleCountries": ["GB"],
    "sourceType": "employer_site",
    "sourceJobId": "backend-engineer-123",
    "applyAdapter": "greenhouse",
    "visaSponsorshipStatus": "eligible",
    "workMode": "hybrid",
    "employmentType": "full_time"
  }
]
```

## Recommended Scraper Architecture

If your goal is "lots of jobs from lots of boards", build scraping outside this Next.js app.

Recommended architecture:

1. `Scraper workers`
   - one worker per source family
   - examples: Greenhouse boards, Lever boards, Workday pages, direct employer career pages

2. `Normalizer`
   - convert each scraped result into the ingestion JSON shape
   - set `sourceType`, `sourceJobId`, `applyAdapter`, `countryCode`, `visaSponsorshipStatus`, and compensation fields

3. `Scheduler`
   - run scrapers on cron
   - retry failures
   - remove / mark stale jobs if sources close them

4. `Ingestion push`
   - send jobs to this app via `POST /api/job-sources/ingest`

5. `Search and apply in app`
   - users search on `/jobs`
   - matching and drafting happen inside this app

## Best Sources To Start With

If you want a lot of jobs quickly with manageable complexity, start in this order:

1. Greenhouse-hosted company boards
2. Lever-hosted company boards
3. Employer career pages with stable HTML or JSON
4. Workday only after you are ready for a more complex adapter

That gives you broad employer coverage without starting with the hardest sites first.

## Important Limitation Right Now

The current codebase does not yet include:

- Greenhouse scraper code
- Lever scraper code
- Workday scraper code
- employer-site crawler code
- scheduled scraper workers
- queueing / retry workers for scraping

It only includes the app-side infrastructure that those workers should post into.

## Next Build Step For Full Scraping Coverage

If you want me to do the next logical implementation, it should be:

1. add a `scrapers/` worker package
2. implement `greenhouse` and `lever` adapters first
3. normalize results into the ingestion JSON shape
4. run them on a schedule
5. POST the results into `/api/job-sources/ingest`

That is the missing "lots of job boards" part.
