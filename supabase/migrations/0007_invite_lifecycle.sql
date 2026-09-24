-- Atomically consume optional invite codes while creating a new profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite_code text := nullif(btrim(new.raw_user_meta_data->>'invite_code'), '');
  v_claimed_invite_id uuid;
begin
  insert into public.profiles (id, name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );

  if v_invite_code is not null then
    update public.invites
    set
      used_by = new.id,
      used_at = now()
    where code = v_invite_code
      and used_by is null
      and used_at is null
      and (expires_at is null or expires_at > now())
    returning id into v_claimed_invite_id;

    if v_claimed_invite_id is null then
      raise exception 'Invite code is invalid, expired, or already used'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

-- Keep a redeemed invite marked as used if its recipient later deletes their
-- account, while allowing the profile deletion to complete.
alter table public.invites
  drop constraint if exists invites_used_by_fkey;
alter table public.invites
  add constraint invites_used_by_fkey
  foreign key (used_by) references public.profiles(id) on delete set null;

-- A creator may manage an invite, but a redeemed code must never be reopened.
create or replace function public.prevent_invite_reuse()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.used_at is not null and new.used_at is null then
    raise exception 'A redeemed invite cannot be made active again'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists preserve_invite_redemption on public.invites;
create trigger preserve_invite_redemption
  before update on public.invites
  for each row execute function public.prevent_invite_reuse();

-- Invite codes are bearer credentials. Only their creator may read table rows;
-- unauthenticated recipients validate codes through the server route handler.
drop policy if exists "invites: read by code" on public.invites;
drop policy if exists "invites: read own" on public.invites;
create policy "invites: read own" on public.invites
  for select using (auth.uid() = created_by);

drop policy if exists "invites: insert" on public.invites;
create policy "invites: insert own" on public.invites
  for insert with check (auth.uid() = created_by);

drop policy if exists "invites: update own" on public.invites;
create policy "invites: update own" on public.invites
  for update
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

drop policy if exists "invites: delete own" on public.invites;
create policy "invites: delete own" on public.invites
  for delete using (auth.uid() = created_by);
