-- ─── Enable required extensions ─────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Enums ────────────────────────────────────────────────────────────────────
create type visibility as enum ('public', 'private');
create type availability as enum ('open', 'closed', 'unknown');
create type application_status as enum (
  'saved', 'applied', 'oa', 'phone_screen',
  'interview', 'offer', 'rejected', 'withdrawn'
);

-- ─── Tables ───────────────────────────────────────────────────────────────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  avatar_url text,
  visibility visibility not null default 'public',
  created_at timestamptz not null default now()
);

create table invites (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  created_by uuid not null references profiles(id) on delete cascade,
  used_by uuid references profiles(id),
  expires_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table jobs (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  company text not null,
  url text not null,
  description text,
  salary_range text,
  location text,
  tags text[] not null default '{}',
  posted_by uuid references profiles(id) on delete set null,
  availability availability not null default 'unknown',
  last_checked timestamptz,
  created_at timestamptz not null default now()
);

create table resumes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  file_size integer not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table applications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  resume_id uuid references resumes(id) on delete set null,
  status application_status not null default 'saved',
  notes text,
  is_private boolean not null default false,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, job_id)
);

create table application_status_history (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid not null references applications(id) on delete cascade,
  from_status application_status,
  to_status application_status not null,
  note text,
  changed_at timestamptz not null default now(),
  changed_by uuid not null references profiles(id) on delete cascade
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
create index on applications(user_id);
create index on applications(job_id);
create index on application_status_history(application_id);
create index on jobs(availability);
create index on invites(code);

-- ─── Auto-create profile on signup ───────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table profiles enable row level security;
alter table invites enable row level security;
alter table jobs enable row level security;
alter table resumes enable row level security;
alter table applications enable row level security;
alter table application_status_history enable row level security;

-- profiles: anyone authenticated can read, owner can update
create policy "profiles: read" on profiles for select using (true);
create policy "profiles: update own" on profiles for update using (auth.uid() = id);

-- jobs: public read, authenticated write
create policy "jobs: read" on jobs for select using (true);
create policy "jobs: insert" on jobs for insert with check (auth.uid() = posted_by);
create policy "jobs: update own" on jobs for update using (auth.uid() = posted_by);
create policy "jobs: delete own" on jobs for delete using (auth.uid() = posted_by);

-- applications: owner always; others only if not private
create policy "applications: read own" on applications
  for select using (auth.uid() = user_id);
create policy "applications: read public" on applications
  for select using (is_private = false and auth.uid() is not null);
create policy "applications: insert" on applications
  for insert with check (auth.uid() = user_id);
create policy "applications: update own" on applications
  for update using (auth.uid() = user_id);
create policy "applications: delete own" on applications
  for delete using (auth.uid() = user_id);

-- application_status_history: readable if parent application is readable
create policy "history: read" on application_status_history
  for select using (
    exists (
      select 1 from applications a
      where a.id = application_id
        and (a.user_id = auth.uid() or (a.is_private = false and auth.uid() is not null))
    )
  );
create policy "history: insert own" on application_status_history
  for insert with check (auth.uid() = changed_by);

-- resumes: owner only
create policy "resumes: owner" on resumes
  for all using (auth.uid() = user_id);

-- invites: creator can manage; anyone authenticated can read by code
create policy "invites: read by code" on invites
  for select using (auth.uid() is not null);
create policy "invites: insert" on invites
  for insert with check (auth.uid() = created_by);
create policy "invites: update own" on invites
  for update using (auth.uid() = created_by);

-- ─── Supabase Storage bucket for resumes ─────────────────────────────────────
-- Run this in the Supabase dashboard → Storage → New Bucket
-- Name: resumes, Private: true (no public access by default)
-- Policy: users can only access their own folder: storage.foldername(name)[1] = auth.uid()::text
