-- Pizza Passport — Social & Geo-checkin schema (additive migration)
-- Run this in the Supabase Dashboard AFTER schema.sql: Project → SQL Editor
-- → New query. Safe to re-run (every statement is idempotent).
--
-- Adds:
--   * profiles: bio, is_public, is_guest, claimed_at (guest→account upgrade)
--   * entries:  place_id (geocoded venue id from lib/geo.ts)
--   * public.friendships   — mutual friend requests
--   * public.activity_events — "X stamped Y" feed, auto-logged on check-in
--   * a check-in rate-limit trigger (max 5 per user per 10 minutes)
--   * privacy-aware RLS: profiles/entries are now visible if the owner's
--     profile is public, OR the viewer is the owner, OR the viewer is an
--     accepted friend — replacing the original "always public" policies.
--     Every existing profile defaults to is_public = true, so nothing
--     already-deployed loses visibility; this only adds an opt-out.
--
-- ============================================================
-- profiles: guest/claim + privacy fields
-- ============================================================
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists is_public boolean not null default true;
alter table public.profiles add column if not exists is_guest boolean not null default true;
alter table public.profiles add column if not exists claimed_at timestamptz;

comment on column public.profiles.is_guest is
  'true until the anonymous session is upgraded to a real email/OAuth identity — see mark_profile_claimed().';

-- Called by the client immediately after linking an email (magic link) or
-- Google identity to the current (previously anonymous) session, so the
-- upgrade preserves auth.uid() — and therefore every existing entries row —
-- with zero data migration.
create or replace function public.mark_profile_claimed()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set is_guest = false,
      claimed_at = coalesce(claimed_at, now())
  where id = auth.uid();
end;
$$;

-- ============================================================
-- entries: geocoded venue id
-- ============================================================
alter table public.entries add column if not exists place_id text;
create index if not exists entries_place_id_idx on public.entries (place_id);

comment on column public.entries.place_id is
  'Stable id for the geocoded venue (e.g. "osm:123456" from lib/geo.ts), for de-duplication and future "trending pizzerias" features. Null for manually-typed entries with no matched place.';

-- ============================================================
-- Check-in rate limiting (defense in depth against scripted spam;
-- the primary "are you actually there" guard is the client-side distance
-- check in lib/geo.ts, since the server has no independent way to verify a
-- device's true GPS position).
-- ============================================================
create or replace function public.enforce_checkin_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
begin
  select count(*) into recent_count
  from public.entries
  where user_id = new.user_id
    and created_at > now() - interval '10 minutes';

  if recent_count >= 5 then
    raise exception 'Too many check-ins — please wait a few minutes and try again.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_checkin_rate_limit on public.entries;
create trigger trg_enforce_checkin_rate_limit
  before insert on public.entries
  for each row execute function public.enforce_checkin_rate_limit();

-- ============================================================
-- Friendship helper — used by RLS policies below, so it's defined before
-- any policy that references it.
-- ============================================================
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select a is not null and b is not null and exists (
    select 1 from public.friendships
    where status = 'accepted'
      and ((requester_id = a and addressee_id = b) or (requester_id = b and addressee_id = a))
  );
$$;

-- ============================================================
-- friendships
-- pair_key collapses (A,B) and (B,A) into the same value so a unique index
-- on it prevents duplicate/opposite-direction requests between two users.
-- ============================================================
create table if not exists public.friendships (
  id             uuid primary key default gen_random_uuid(),
  requester_id   uuid not null references public.profiles (id) on delete cascade,
  addressee_id   uuid not null references public.profiles (id) on delete cascade,
  status         text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'blocked')),
  created_at     timestamptz not null default now(),
  responded_at   timestamptz,
  pair_key       text generated always as (
                   least(requester_id::text, addressee_id::text) || ':' ||
                   greatest(requester_id::text, addressee_id::text)
                 ) stored,
  constraint friendships_no_self check (requester_id <> addressee_id)
);

create unique index if not exists friendships_pair_unique on public.friendships (pair_key);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id, status);
create index if not exists friendships_requester_idx on public.friendships (requester_id, status);

alter table public.friendships enable row level security;

create policy "Users can view their own friendships"
  on public.friendships for select
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "Users can send friend requests"
  on public.friendships for insert
  to authenticated
  with check (auth.uid() = requester_id and status = 'pending');

create policy "Addressee can accept or decline"
  on public.friendships for update
  to authenticated
  using (auth.uid() = addressee_id)
  with check (auth.uid() = addressee_id);

create policy "Requester can cancel a pending request"
  on public.friendships for delete
  to authenticated
  using (auth.uid() = requester_id and status = 'pending');

-- ============================================================
-- activity_events — "X stamped Y", auto-logged whenever a check-in is
-- saved. Readable by the actor, their accepted friends, or anyone if the
-- actor's profile is public.
-- ============================================================
create table if not exists public.activity_events (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid not null references public.profiles (id) on delete cascade,
  entry_id   uuid references public.entries (id) on delete cascade,
  event_type text not null default 'check_in',
  created_at timestamptz not null default now()
);

create index if not exists activity_events_actor_idx on public.activity_events (actor_id, created_at desc);

alter table public.activity_events enable row level security;

create policy "Activity is readable by the actor, friends, or if public"
  on public.activity_events for select
  using (
    actor_id = auth.uid()
    or public.are_friends(auth.uid(), actor_id)
    or exists (select 1 from public.profiles p where p.id = activity_events.actor_id and p.is_public)
  );

create or replace function public.log_checkin_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_events (actor_id, entry_id, event_type)
  values (new.user_id, new.id, 'check_in');
  return new;
end;
$$;

drop trigger if exists trg_log_checkin_activity on public.entries;
create trigger trg_log_checkin_activity
  after insert on public.entries
  for each row execute function public.log_checkin_activity();

-- ============================================================
-- Privacy-aware read policies — supersede the original "always public"
-- policies from schema.sql now that profiles.is_public exists.
-- ============================================================
drop policy if exists "Profiles are publicly readable" on public.profiles;
create policy "Profiles are readable if public, self, or friend"
  on public.profiles for select
  using (
    is_public
    or id = auth.uid()
    or public.are_friends(auth.uid(), id)
  );

drop policy if exists "Entries are publicly readable" on public.entries;
create policy "Entries are readable if owner is public, self, or friend"
  on public.entries for select
  using (
    user_id = auth.uid()
    or public.are_friends(auth.uid(), user_id)
    or exists (select 1 from public.profiles p where p.id = entries.user_id and p.is_public)
  );

-- ============================================================
-- RPCs for the friends UI (username search + activity feed). Both are
-- security definer so they can join across profiles/friendships safely
-- while still scoping results to what the *caller* (auth.uid()) may see.
-- ============================================================
create or replace function public.search_profiles(query text)
returns table (id uuid, username text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.avatar_url
  from public.profiles p
  where p.username ilike query || '%'
    and (p.is_public or p.id = auth.uid() or public.are_friends(auth.uid(), p.id))
  order by p.username
  limit 20;
$$;

create or replace function public.get_friend_activity(limit_count int default 20)
returns table (
  event_id        uuid,
  actor_id        uuid,
  actor_username  text,
  entry_id        uuid,
  restaurant_name text,
  stamp_image_url text,
  created_at      timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select ae.id, ae.actor_id, p.username, ae.entry_id, e.restaurant_name, e.stamp_image_url, ae.created_at
  from public.activity_events ae
  join public.profiles p on p.id = ae.actor_id
  left join public.entries e on e.id = ae.entry_id
  where ae.actor_id = auth.uid() or public.are_friends(auth.uid(), ae.actor_id)
  order by ae.created_at desc
  limit limit_count;
$$;
