# Contributing to meh-tracker

Thanks for your interest! Here's how to get up and running.

## Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) account (free tier is fine)

## Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/your-org/meh-tracker.git
   cd meh-tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Fill in your Supabase project URL, anon key, and database URL (use the **Transaction Pooler** URL from Supabase → Settings → Database, port 6543).

4. **Set up the database**

   In your Supabase project, open the SQL Editor and run the contents of:
   ```
   supabase/migrations/0001_setup.sql
   ```

5. **Set up Supabase Storage**

   In Supabase → Storage → New Bucket:
   - Name: `resumes`
   - Toggle **private** (not public)
   - Add a policy: users can only read/write `storage.foldername(name)[1] = auth.uid()::text`

6. **Run the dev server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
app/
  (auth)/        Login, signup, invite pages
  (app)/         Main app — sidebar layout
  api/           All backend route handlers
components/      UI and feature components
lib/
  db/            Drizzle schema + queries
  supabase/      Browser + server Supabase clients
supabase/
  migrations/    SQL to run in Supabase SQL Editor
  functions/     Edge functions (job URL checker)
```

## Making Changes

- Keep PRs focused — one feature or fix per PR
- Run `npx tsc --noEmit` and `npm run lint` before opening a PR
- For new pages, follow the existing RSC (React Server Component) pattern
- API routes live in `app/api/` and use Zod for input validation

## Good First Issues

Look for issues labeled [`good first issue`](../../issues?q=label%3A"good+first+issue") on GitHub.
