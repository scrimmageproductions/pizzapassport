-- Pizza Passport — Supabase schema
-- Run this in the Supabase Dashboard: Project → SQL Editor → New query.
--
-- Sets up:
--   * public.profiles  — one row per user, exposes a public username + VIP flag
--   * public.entries   — one row per check-in ("Slice")
--   * the `pizza-photos` public Storage bucket + its access policies
--
-- Row Level Security is enabled on every table: anyone (including
-- anonymous/unauthenticated web visitors) can read, but only an
-- authenticated user can write — and only to their own rows.

create extension if not exists pgcrypto;

-- ============================================================
-- profiles
-- ============================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text not null unique,
  avatar_url  text,
  is_vip      boolean not null default false,
  -- Running total of entries.points_earned across this user's check-ins,
  -- kept in sync by the trigger in schema_gamification.sql. Denormalized
  -- here (rather than always summing entries) so the leaderboard is a
  -- cheap indexed sort instead of an aggregate over every check-in.
  points      int not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are publicly readable"
  on public.profiles for select
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ============================================================
-- entries
-- ============================================================
create table if not exists public.entries (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  restaurant_name   text not null,
  latitude          double precision not null,
  longitude         double precision not null,
  rating            numeric(2, 1) not null check (rating >= 1.0 and rating <= 5.0),
  crust_type        text not null,
  venue_photo_url   text not null,
  selfie_photo_url  text not null,
  -- Generated rubber-stamp artwork (see StampInkFilter.swift). Not part of
  -- the minimum spec, but required for the web StampGrid to render actual
  -- stamps rather than just restaurant cards — nullable so it can be
  -- dropped safely if unused.
  stamp_image_url   text,
  -- Optional third photo of the pizzeria's menu — never required to
  -- complete a check-in, but worth a points bonus (see points_earned).
  menu_photo_url    text,
  -- +100 for the base check-in, +100 more if menu_photo_url is set. Stored
  -- per-entry (rather than only summed into profiles.points) so a user's
  -- points history/breakdown stays reconstructable after the fact.
  points_earned     int not null default 100,
  ink_color         text not null,
  -- Reverse-geocoded at check-in time (see lib/geo.ts / LocationService.swift)
  -- so the world map and country leaderboards can aggregate without an
  -- expensive per-row geocode lookup. Nullable — older rows and offline
  -- check-ins may not have it.
  country           text,
  -- Set only via the security-definer public.submit_owner_reply() RPC
  -- (see schema_merchants.sql) — never through a direct client UPDATE, so
  -- a verified merchant can never overwrite the customer's own fields.
  owner_reply       text,
  owner_replied_at  timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists entries_user_id_idx on public.entries (user_id);
create index if not exists entries_created_at_idx on public.entries (created_at desc);

alter table public.entries enable row level security;

create policy "Entries are publicly readable"
  on public.entries for select
  using (true);

create policy "Users can insert their own entries"
  on public.entries for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own entries"
  on public.entries for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own entries"
  on public.entries for delete
  to authenticated
  using (auth.uid() = user_id);

-- ============================================================
-- Storage: pizza-photos
-- Public bucket holding venue photos, selfies, and generated stamps,
-- namespaced by entry id (see SupabaseService.uploadCheckInPhotos).
-- ============================================================
insert into storage.buckets (id, name, public)
values ('pizza-photos', 'pizza-photos', true)
on conflict (id) do nothing;

create policy "Pizza photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'pizza-photos');

create policy "Authenticated users can upload pizza photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'pizza-photos');

create policy "Authenticated users can update their own pizza photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'pizza-photos' and owner = auth.uid())
  with check (bucket_id = 'pizza-photos' and owner = auth.uid());

create policy "Authenticated users can delete their own pizza photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'pizza-photos' and owner = auth.uid());
