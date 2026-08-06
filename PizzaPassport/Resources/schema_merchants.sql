-- Pizza Passport — Merchant Portal schema (additive migration)
-- Run this in the Supabase Dashboard AFTER schema.sql and schema_moments.sql
-- (merchants.place_id references public.pizzerias). Safe to re-run.
--
-- Adds:
--   * public.merchants — a verified business account claiming ownership of
--     one pizzeria (keyed by the same `place_id` used everywhere else in
--     this app — see schema_moments.sql — not a Google-only identifier,
--     since most venues here are matched via the free OpenStreetMap tiers
--     rather than Google Places).
--   * entries.owner_reply / entries.owner_replied_at (also declared on the
--     base table in schema.sql for a fresh install; the alters below cover
--     upgrading an existing database).
--   * public.submit_owner_reply() — the ONLY way a merchant can attach a
--     reply to a customer's check-in. A verified merchant only ever needs
--     to write two columns on an otherwise customer-owned row; giving them
--     a normal RLS UPDATE policy on `entries` would let a compromised or
--     buggy merchant client overwrite the customer's rating, photos, or
--     anything else on that row. Routing writes through a `security
--     definer` function that touches only `owner_reply`/`owner_replied_at`
--     closes that off entirely — there is deliberately no merchant UPDATE
--     policy on `public.entries` in this file.
--   * public.story_share_events — one row per successful story share (see
--     web/lib/socialSharing.ts), powering the dashboard's "Total Story
--     Shares" metric. Low-stakes, anonymous-writable by design (worst case
--     of abuse is an inflated count, same trust model as a page-view
--     counter).
--
-- ============================================================
-- merchants
-- ============================================================
create table if not exists public.merchants (
  id                      uuid primary key references auth.users (id) on delete cascade,
  business_name           text not null,
  business_email          text not null,
  phone_number            text,
  -- The venue this account claims — same id space as entries.place_id /
  -- pizzerias.place_id (an "osm:...", "google:...", or "manual:..." id).
  place_id                text not null unique references public.pizzerias (place_id),
  is_verified             boolean not null default false,
  official_logo_url       text,
  custom_stamp_ink_color  text not null default 'red' check (custom_stamp_ink_color in ('red', 'blue', 'charcoal')),
  custom_stamp_style      text not null default 'classic_distressed',
  -- 0..1 sliders for the stamp customizer (see app/biz/stamp/page.tsx and
  -- generateInkStamp's grungeIntensity/bleedRadius options).
  stamp_texture_density   real not null default 0.6 check (stamp_texture_density between 0 and 1),
  stamp_edge_distress     real not null default 0.5 check (stamp_edge_distress between 0 and 1),
  created_at              timestamptz not null default now()
);

create index if not exists merchants_place_id_idx on public.merchants (place_id);

alter table public.merchants enable row level security;

create policy "Public can view verified merchants"
  on public.merchants for select
  using (is_verified = true);

create policy "Merchants can view their own profile"
  on public.merchants for select
  to authenticated
  using (auth.uid() = id);

-- Deliberately no INSERT policy for `authenticated` here: a new merchant
-- row (and its initial `is_verified` value) is only ever created by
-- /api/merchants/claim using the service-role key, after a server-side
-- domain-match check — never trusted from a client-supplied `is_verified`.
create policy "Merchants can update their own profile"
  on public.merchants for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- Pins is_verified to its current value so this policy can only ever
    -- be used to edit business/stamp fields, never to self-verify.
    and is_verified = (select m.is_verified from public.merchants m where m.id = auth.uid())
  );

comment on table public.merchants is
  'One row per verified pizzeria owner account. Created exclusively via /api/merchants/claim (service role) — see the policy comments above for why there is no client-facing insert path.';

-- ============================================================
-- entries: owner replies (idempotent for databases created before this
-- migration existed — schema.sql already declares these on a fresh install)
-- ============================================================
alter table public.entries add column if not exists owner_reply text;
alter table public.entries add column if not exists owner_replied_at timestamptz;

create or replace function public.submit_owner_reply(p_entry_id uuid, p_reply text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_place_id text;
begin
  if p_reply is null or length(trim(p_reply)) = 0 then
    raise exception 'Reply cannot be empty';
  end if;

  select place_id into v_place_id from public.entries where id = p_entry_id;
  if v_place_id is null then
    raise exception 'Entry not found or has no associated pizzeria';
  end if;

  if not exists (
    select 1 from public.merchants
    where id = auth.uid() and place_id = v_place_id and is_verified
  ) then
    raise exception 'Not authorized to reply to this entry';
  end if;

  update public.entries
  set owner_reply = trim(p_reply), owner_replied_at = now()
  where id = p_entry_id;
end;
$$;

comment on function public.submit_owner_reply is
  'The only path for a merchant to attach a reply to a check-in — verifies auth.uid() owns a verified merchant row for that entry''s place_id, then writes exactly two columns. Call via supabase.rpc("submit_owner_reply", { p_entry_id, p_reply }).';

-- ============================================================
-- story_share_events
-- ============================================================
create table if not exists public.story_share_events (
  id         uuid primary key default gen_random_uuid(),
  entry_id   uuid not null references public.entries (id) on delete cascade,
  platform   text not null,
  created_at timestamptz not null default now()
);

create index if not exists story_share_events_entry_idx on public.story_share_events (entry_id);

alter table public.story_share_events enable row level security;

create policy "Story share events are publicly readable"
  on public.story_share_events for select
  using (true);

create policy "Anyone can record a story share"
  on public.story_share_events for insert
  with check (true);

comment on table public.story_share_events is
  'One row per successful story share (see web/lib/socialSharing.ts). Anonymous-writable by design — the worst case of abuse is an inflated share count on the merchant dashboard, the same trust model as a page-view counter.';
