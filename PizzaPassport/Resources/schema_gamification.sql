-- Pizza Passport — Gamification schema (additive migration)
-- Run this in the Supabase Dashboard AFTER schema.sql, schema_social.sql,
-- and schema_moments.sql. Safe to re-run (every statement is idempotent).
--
-- Adds:
--   * entries.menu_photo_url — optional third check-in photo.
--   * entries.points_earned  — +100 base, +100 more with a menu photo.
--   * entries.country        — reverse-geocoded at check-in time, powers
--     the world map and country-level aggregation.
--   * profiles.points        — running total of points_earned, kept in
--     sync by a trigger so the leaderboard is a cheap indexed sort.
--   * public.leaderboard     — a view joining the two for the Explorers /
--     Points Leaders tabs.
--   * public.country_activity — a view aggregating check-ins by country
--     for the global map.

alter table public.entries add column if not exists menu_photo_url text;
alter table public.entries add column if not exists points_earned int not null default 100;
alter table public.entries add column if not exists country text;
alter table public.profiles add column if not exists points int not null default 0;

comment on column public.entries.menu_photo_url is
  'Optional third check-in photo of the pizzeria''s menu — never required, but worth a points bonus.';
comment on column public.entries.points_earned is
  '+100 for the base check-in (venue + selfie photo), +100 more if menu_photo_url is set.';
comment on column public.entries.country is
  'Reverse-geocoded at check-in time — powers the world map and country-level leaderboards.';
comment on column public.profiles.points is
  'Running total of this user''s entries.points_earned, kept in sync by trg_sync_profile_points.';

-- One-time backfill so profiles.points reflects any entries that already
-- exist before this trigger was installed. No-op on a fresh install.
update public.profiles p
set points = coalesce((select sum(e.points_earned) from public.entries e where e.user_id = p.id), 0);

-- Keeps profiles.points in sync with the sum of that user's
-- entries.points_earned on every insert/update/delete, so the leaderboard
-- never has to compute the aggregate itself.
create or replace function public.sync_profile_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_user uuid;
begin
  affected_user := coalesce(new.user_id, old.user_id);
  update public.profiles
  set points = coalesce((select sum(points_earned) from public.entries where user_id = affected_user), 0)
  where id = affected_user;
  return null;
end;
$$;

drop trigger if exists trg_sync_profile_points on public.entries;
create trigger trg_sync_profile_points
  after insert or update of points_earned or delete on public.entries
  for each row execute function public.sync_profile_points();

-- ============================================================
-- leaderboard
-- Public-only (same visibility rule as entries/moments elsewhere): a
-- private passport's owner never shows up for other visitors, but can
-- still see their own rank via a `id = auth.uid()` filter client-side.
-- ============================================================
create or replace view public.leaderboard as
select
  p.id,
  p.username,
  p.avatar_url,
  p.points,
  count(e.id) as total_checkins
from public.profiles p
left join public.entries e on e.user_id = p.id
where p.is_public
group by p.id, p.username, p.avatar_url, p.points;

-- ============================================================
-- country_activity
-- Powers the global map: one row per country with a check-in count.
-- ============================================================
create or replace view public.country_activity as
select
  e.country,
  count(*) as total_checkins,
  count(distinct e.user_id) as total_explorers
from public.entries e
join public.profiles p on p.id = e.user_id
where e.country is not null and p.is_public
group by e.country;
