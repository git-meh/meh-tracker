# 😑 meh-tracker

A collaborative job application tracker for friend groups. Browse job listings anonymously, sign in to track your applications, share progress with your crew, and upload your CV — all in one place.

## Features

- **Job Board** — post and browse job listings, public to everyone (no account needed)
- **Application Tracker** — personal pipeline with kanban view and full status history
- **CV Manager** — upload multiple CVs, set a default, link one to each application
- **Group Feed** — see what your friends are applying to (opt-in visibility)
- **Realtime** — live updates when jobs are posted or statuses change
- **Invite System** — invite-link based onboarding
- **Job Availability Checker** — background cron pings job URLs to detect closed listings

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
npm run dev
```

## License

MIT
