-- ─── New enums ───────────────────────────────────────────────────────────────
do $$ begin
  create type job_source_type as enum ('manual', 'approved_feed', 'employer_site', 'ats');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type visa_sponsorship_status as enum ('eligible', 'possible', 'not_available', 'unknown');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type work_mode as enum ('remote', 'hybrid', 'onsite', 'unknown');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type employment_type as enum ('full_time', 'part_time', 'contract', 'internship', 'temporary', 'apprenticeship', 'unknown');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type apply_adapter as enum ('none', 'greenhouse', 'lever', 'workday', 'ashby', 'smartrecruiters', 'manual_external');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type ingestion_run_status as enum ('queued', 'running', 'succeeded', 'failed');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type resume_extraction_status as enum ('pending', 'ready', 'failed');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type artifact_type as enum ('tailored_resume', 'cover_letter', 'application_answers', 'email_digest');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type artifact_status as enum ('pending', 'ready', 'failed');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type draft_status as enum ('queued', 'ready_for_review', 'approved', 'rejected', 'submitted', 'failed');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type application_run_status as enum ('queued', 'ready_to_submit', 'manual_required', 'submitted', 'failed');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type notification_type as enum ('daily_digest', 'draft_ready', 'application_submitted', 'application_failed', 'job_closed', 'status_changed');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type notification_status as enum ('pending', 'sent', 'failed', 'skipped');
exception
  when duplicate_object then null;
end $$;

-- ─── New tables ───────────────────────────────────────────────────────────────
create table if not exists job_sources (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  source_type job_source_type not null default 'manual',
  base_url text,
  country_codes text[] not null default '{}',
  supports_visa_sponsorship boolean not null default false,
  default_adapter apply_adapter not null default 'none',
  is_active boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists job_ingestion_runs (
  id uuid primary key default uuid_generate_v4(),
  source_id uuid references job_sources(id) on delete set null,
  status ingestion_run_status not null default 'queued',
  jobs_seen integer not null default 0,
  jobs_inserted integer not null default 0,
  jobs_updated integer not null default 0,
  jobs_skipped integer not null default 0,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists resume_versions (
  id uuid primary key default uuid_generate_v4(),
  resume_id uuid not null references resumes(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  version_number integer not null,
  label text,
  extracted_text text,
  normalized_text text,
  extraction_status resume_extraction_status not null default 'pending',
  created_at timestamptz not null default now()
);

create unique index if not exists resume_versions_resume_version_idx
  on resume_versions(resume_id, version_number);

create table if not exists candidate_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  current_country text,
  visa_status text,
  needs_visa_sponsorship boolean not null default true,
  target_countries text[] not null default array['GB']::text[],
  preferred_locations text[] not null default '{}',
  target_roles text[] not null default '{}',
  years_experience integer,
  salary_floor integer,
  preferred_currency text not null default 'GBP',
  prefers_remote boolean not null default false,
  summary text,
  skills text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists automation_preferences (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  review_required boolean not null default true,
  auto_submit_enabled boolean not null default false,
  allowed_source_types text[] not null default array['approved_feed', 'employer_site', 'ats']::text[],
  supported_countries text[] not null default array['GB']::text[],
  email_notifications_enabled boolean not null default true,
  daily_digest_enabled boolean not null default true,
  instant_updates_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists job_matches (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  score integer not null,
  rationale text not null,
  fit_signals text[] not null default '{}',
  concerns text[] not null default '{}',
  refreshed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists job_matches_user_job_idx
  on job_matches(user_id, job_id);

create table if not exists application_drafts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  application_id uuid references applications(id) on delete set null,
  job_match_id uuid references job_matches(id) on delete set null,
  status draft_status not null default 'ready_for_review',
  review_notes text,
  generated_at timestamptz not null default now(),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists application_drafts_user_job_idx
  on application_drafts(user_id, job_id);

create table if not exists generated_artifacts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  application_id uuid references applications(id) on delete set null,
  draft_id uuid references application_drafts(id) on delete set null,
  source_resume_version_id uuid references resume_versions(id) on delete set null,
  type artifact_type not null,
  status artifact_status not null default 'ready',
  title text not null,
  content text,
  created_at timestamptz not null default now()
);

create table if not exists application_runs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  application_id uuid not null references applications(id) on delete cascade,
  draft_id uuid references application_drafts(id) on delete set null,
  status application_run_status not null default 'queued',
  mode text not null default 'review_required',
  adapter apply_adapter not null default 'none',
  attempt_number integer not null default 1,
  log text,
  external_url text,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists saved_searches (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  query text,
  filters jsonb not null default '{}'::jsonb,
  email_daily boolean not null default true,
  last_digest_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists notification_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  type notification_type not null,
  status notification_status not null default 'pending',
  subject text not null,
  body text not null,
  job_id uuid references jobs(id) on delete set null,
  application_id uuid references applications(id) on delete set null,
  draft_id uuid references application_drafts(id) on delete set null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- ─── Extend existing tables ───────────────────────────────────────────────────
alter table jobs add column if not exists salary_min integer;
alter table jobs add column if not exists salary_max integer;
alter table jobs add column if not exists currency text not null default 'GBP';
alter table jobs add column if not exists country_code text not null default 'GB';
alter table jobs add column if not exists eligible_countries text[] not null default '{}';
alter table jobs add column if not exists source_id uuid references job_sources(id) on delete set null;
alter table jobs add column if not exists source_type job_source_type not null default 'manual';
alter table jobs add column if not exists source_job_id text;
alter table jobs add column if not exists dedupe_key text;
alter table jobs add column if not exists apply_adapter apply_adapter not null default 'none';
alter table jobs add column if not exists visa_sponsorship_status visa_sponsorship_status not null default 'unknown';
alter table jobs add column if not exists work_mode work_mode not null default 'unknown';
alter table jobs add column if not exists employment_type employment_type not null default 'unknown';
alter table jobs add column if not exists closing_at timestamptz;
alter table jobs add column if not exists ingested_at timestamptz not null default now();
alter table jobs add column if not exists updated_at timestamptz not null default now();

create unique index if not exists jobs_dedupe_key_idx on jobs(dedupe_key)
  where dedupe_key is not null;
create index if not exists jobs_source_id_idx on jobs(source_id);
create index if not exists jobs_source_type_idx on jobs(source_type);
create index if not exists jobs_country_sponsorship_idx on jobs(country_code, visa_sponsorship_status);
create index if not exists jobs_closing_at_idx on jobs(closing_at);

alter table applications add column if not exists resume_version_id uuid references resume_versions(id) on delete set null;
alter table applications add column if not exists source_job_id text;
alter table applications add column if not exists job_source_type job_source_type not null default 'manual';
alter table applications add column if not exists matched_score integer;
alter table applications add column if not exists match_reason text;
alter table applications add column if not exists submission_attempts integer not null default 0;
alter table applications add column if not exists automation_mode text not null default 'review_required';
alter table applications add column if not exists external_application_id text;
alter table applications add column if not exists external_confirmation_url text;
alter table applications add column if not exists last_submission_at timestamptz;

create index if not exists applications_resume_version_idx on applications(resume_version_id);
create index if not exists applications_last_submission_idx on applications(last_submission_at);

-- ─── Backfill existing data ───────────────────────────────────────────────────
update jobs
set ingested_at = created_at,
    updated_at = created_at
where source_type = 'manual'
  and (ingested_at is null or updated_at is null);

insert into resume_versions (
  resume_id,
  user_id,
  version_number,
  label,
  extraction_status,
  created_at
)
select
  r.id,
  r.user_id,
  1,
  'Imported v1',
  'pending'::resume_extraction_status,
  r.created_at
from resumes r
where not exists (
  select 1 from resume_versions rv
  where rv.resume_id = r.id and rv.version_number = 1
);

update applications a
set resume_version_id = rv.id
from resume_versions rv
where rv.resume_id = a.resume_id
  and rv.version_number = 1
  and a.resume_version_id is null;

update applications a
set source_job_id = j.source_job_id,
    job_source_type = j.source_type
from jobs j
where j.id = a.job_id
  and a.source_job_id is null;

insert into automation_preferences (user_id)
select p.id
from profiles p
where not exists (
  select 1 from automation_preferences ap where ap.user_id = p.id
);

-- ─── Indexes for new tables ──────────────────────────────────────────────────
create index if not exists job_ingestion_runs_source_idx on job_ingestion_runs(source_id, created_at desc);
create index if not exists candidate_profiles_user_idx on candidate_profiles(user_id);
create index if not exists automation_preferences_user_idx on automation_preferences(user_id);
create index if not exists job_matches_user_score_idx on job_matches(user_id, score desc);
create index if not exists application_drafts_user_status_idx on application_drafts(user_id, status, updated_at desc);
create index if not exists generated_artifacts_draft_idx on generated_artifacts(draft_id, type);
create index if not exists generated_artifacts_application_idx on generated_artifacts(application_id, type);
create index if not exists application_runs_application_idx on application_runs(application_id, created_at desc);
create index if not exists saved_searches_user_idx on saved_searches(user_id, created_at desc);
create index if not exists notification_events_user_idx on notification_events(user_id, created_at desc);

-- ─── RLS for new tables ───────────────────────────────────────────────────────
alter table job_sources enable row level security;
alter table job_ingestion_runs enable row level security;
alter table resume_versions enable row level security;
alter table candidate_profiles enable row level security;
alter table automation_preferences enable row level security;
alter table job_matches enable row level security;
alter table application_drafts enable row level security;
alter table generated_artifacts enable row level security;
alter table application_runs enable row level security;
alter table saved_searches enable row level security;
alter table notification_events enable row level security;

drop policy if exists "job_sources: read" on job_sources;
create policy "job_sources: read" on job_sources for select using (true);
drop policy if exists "job_sources: insert" on job_sources;
create policy "job_sources: insert" on job_sources
  for insert with check (auth.uid() = created_by);
drop policy if exists "job_sources: update own" on job_sources;
create policy "job_sources: update own" on job_sources
  for update using (auth.uid() = created_by);
drop policy if exists "job_sources: delete own" on job_sources;
create policy "job_sources: delete own" on job_sources
  for delete using (auth.uid() = created_by);

drop policy if exists "job_ingestion_runs: read" on job_ingestion_runs;
create policy "job_ingestion_runs: read" on job_ingestion_runs for select using (auth.uid() is not null);

drop policy if exists "resume_versions: owner" on resume_versions;
create policy "resume_versions: owner" on resume_versions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "candidate_profiles: owner" on candidate_profiles;
create policy "candidate_profiles: owner" on candidate_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "automation_preferences: owner" on automation_preferences;
create policy "automation_preferences: owner" on automation_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "job_matches: owner" on job_matches;
create policy "job_matches: owner" on job_matches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "application_drafts: owner" on application_drafts;
create policy "application_drafts: owner" on application_drafts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "generated_artifacts: owner" on generated_artifacts;
create policy "generated_artifacts: owner" on generated_artifacts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "application_runs: owner" on application_runs;
create policy "application_runs: owner" on application_runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "saved_searches: owner" on saved_searches;
create policy "saved_searches: owner" on saved_searches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "notification_events: owner" on notification_events;
create policy "notification_events: owner" on notification_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
