# 😑 meh-tracker

A UK-first visa job search and application platform. Browse jobs, ingest opportunities from external sources, track applications, tailor CVs, review AI-generated drafts, and keep a transparent audit trail of what was applied and when.

## Features

- **Job Discovery** - browse and filter jobs by sponsorship, source type, work mode, country, and salary
- **Candidate Workspace** - store visa preferences, target roles, CV versions, saved searches, and automation settings
- **AI Matches** - score jobs against each user profile and generate draft application packages
- **Application Audit Trail** - track generated artifacts, submission attempts, confirmations, and status history
- **External Job Ingestion** - accept normalized jobs from external scraper/feed workers
- **Group Feed** - keep optional accountability and shared progress visibility
- **Job Availability Checker** - background cron pings job URLs to detect closed listings

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router) |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| ORM | Drizzle ORM |
| Auth | Supabase Auth |
| Storage | Supabase Storage (CVs) |
| Realtime | Supabase Realtime |
| Job Checker | Supabase Edge Function (cron) |
| Deployment | Vercel |

## Getting Started

See [CONTRIBUTING.md](./CONTRIBUTING.md) for full setup instructions.

```bash
git clone https://github.com/your-org/meh-tracker.git
cd meh-tracker
npm install
cp .env.example .env.local
# fill in your Supabase credentials
npm run db:migrate
npm run dev
```

## Guides

- [Visa Platform Guide](./docs/visa-platform-guide.md) - full setup, env vars, ingestion flow, scraped-job loading, workspace usage, and match/draft workflow

## License

MIT
