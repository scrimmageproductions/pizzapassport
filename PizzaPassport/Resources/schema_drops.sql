-- Pizza Passport — Official Stamps/Drops, Claim Methods, Collections &
-- Challenges (additive migration)
--
-- STATUS: schema only. Nothing in this file is wired into the app's UI
-- yet — this is the data-model deliverable for the next build phase
-- (alongside Auth upgrade UI and the Friends UI). It's included now so the
-- full architecture is reviewable in one place, and so the shapes below
-- are locked in before any UI is built against them. Run after
-- schema.sql, schema_social.sql, and schema_moments.sql.
--
-- Concepts:
--   * stamp_definitions — an "official drop" created by a trusted issuer
--     (a pizzeria, PizzaDAO, a partner) with its own artwork, description,
--     and optional claim limit. Entirely separate from the default
--     user-generated check-in flow already shipped.
--   * claim_methods — one stamp_definition can offer several ways to
--     redeem it: geo-fenced, a QR code, a shareable link, or a secret
--     word (for small in-person drops).
--   * redemptions — one row per user per successful claim; the unique
--     constraint enforces "one claim per person per drop".
--   * collections / collection_stamps — user- or system-curated groupings
--     of entries (a city, a pizza chain, a themed challenge).
--   * challenges / challenge_progress — a simple counter-based challenge
--     ("visit 5 Detroit-style pizzerias") that can power future
--     leaderboards and dedicated story-export cards.
--
-- ============================================================
-- stamp_definitions
-- ============================================================
create table if not exists public.stamp_definitions (
  id            uuid primary key default gen_random_uuid(),
  issuer_id     uuid references public.profiles (id) on delete set null,
  place_id      text references public.pizzerias (place_id),
  title         text not null,
  description   text,
  artwork_url   text,
  ink_color     text,
  claim_limit   integer,
  claims_count  integer not null default 0,
  starts_at     timestamptz,
  ends_at       timestamptz,
  is_official   boolean not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists stamp_definitions_place_idx on public.stamp_definitions (place_id);
create index if not exists stamp_definitions_issuer_idx on public.stamp_definitions (issuer_id);

alter table public.stamp_definitions enable row level security;

create policy "Stamp definitions are publicly readable"
  on public.stamp_definitions for select
  using (true);

create policy "Issuers can create their own stamp definitions"
  on public.stamp_definitions for insert
  to authenticated
  with check (auth.uid() = issuer_id);

create policy "Issuers can update their own stamp definitions"
  on public.stamp_definitions for update
  to authenticated
  using (auth.uid() = issuer_id)
  with check (auth.uid() = issuer_id);

comment on table public.stamp_definitions is
  'Trusted-issuer "drops". Anyone with a profile row can currently be an issuer once the UI ships; a real launch should gate issuer_id behind a manual/verified allowlist (e.g. a boolean profiles.is_trusted_issuer flag checked in the insert policy) before opening this up publicly.';

-- ============================================================
-- claim_methods
-- ============================================================
create table if not exists public.claim_methods (
  id                  uuid primary key default gen_random_uuid(),
  stamp_definition_id uuid not null references public.stamp_definitions (id) on delete cascade,
  method_type         text not null check (method_type in ('geo', 'qr', 'link', 'secret_word')),
  -- Store a hash, not the plaintext, once this is wired up for real —
  -- plaintext here is a placeholder for the schema-design pass only.
  secret_code_hash    text,
  qr_token            text unique,
  radius_meters       integer,
  created_at          timestamptz not null default now()
);

create index if not exists claim_methods_definition_idx on public.claim_methods (stamp_definition_id);

alter table public.claim_methods enable row level security;

create policy "Claim methods are publicly readable"
  on public.claim_methods for select
  using (true);

create policy "Issuers manage claim methods on their own drops"
  on public.claim_methods for all
  to authenticated
  using (exists (
    select 1 from public.stamp_definitions sd
    where sd.id = claim_methods.stamp_definition_id and sd.issuer_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.stamp_definitions sd
    where sd.id = claim_methods.stamp_definition_id and sd.issuer_id = auth.uid()
  ));

-- ============================================================
-- redemptions
-- ============================================================
create table if not exists public.redemptions (
  id                  uuid primary key default gen_random_uuid(),
  stamp_definition_id uuid not null references public.stamp_definitions (id) on delete cascade,
  claim_method_id     uuid references public.claim_methods (id) on delete set null,
  user_id             uuid not null references public.profiles (id) on delete cascade,
  entry_id            uuid references public.entries (id) on delete set null,
  redeemed_at         timestamptz not null default now(),
  unique (stamp_definition_id, user_id)
);

create index if not exists redemptions_user_idx on public.redemptions (user_id, redeemed_at desc);

alter table public.redemptions enable row level security;

create policy "Users can view their own redemptions"
  on public.redemptions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can redeem a drop for themselves"
  on public.redemptions for insert
  to authenticated
  with check (auth.uid() = user_id);

comment on table public.redemptions is
  'Claim-limit and "one per person" enforcement both need a server-side check beyond RLS (RLS alone cannot atomically compare claims_count to claim_limit) — implement redemption as a Postgres function that locks the stamp_definitions row, checks capacity, inserts the redemption, and increments claims_count in one transaction.';

-- ============================================================
-- collections
-- ============================================================
create table if not exists public.collections (
  id          uuid primary key default gen_random_uuid(),
  -- null owner_id = a system/global collection (e.g. a citywide or
  -- chain-wide collection curated by Pizza Passport itself).
  owner_id    uuid references public.profiles (id) on delete cascade,
  title       text not null,
  description text,
  kind        text not null default 'custom' check (kind in ('custom', 'city', 'chain', 'challenge')),
  created_at  timestamptz not null default now()
);

create table if not exists public.collection_stamps (
  collection_id uuid not null references public.collections (id) on delete cascade,
  entry_id      uuid not null references public.entries (id) on delete cascade,
  added_at      timestamptz not null default now(),
  primary key (collection_id, entry_id)
);

alter table public.collections enable row level security;
alter table public.collection_stamps enable row level security;

create policy "Collections are publicly readable"
  on public.collections for select
  using (true);

create policy "Users manage their own collections"
  on public.collections for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Collection membership follows the underlying entry's visibility"
  on public.collection_stamps for select
  using (
    exists (
      select 1 from public.entries e
      where e.id = collection_stamps.entry_id
        and (
          e.user_id = auth.uid()
          or public.are_friends(auth.uid(), e.user_id)
          or exists (select 1 from public.profiles p where p.id = e.user_id and p.is_public)
        )
    )
  );

create policy "Users can add their own entries to their own collections"
  on public.collection_stamps for insert
  to authenticated
  with check (
    exists (select 1 from public.collections c where c.id = collection_id and c.owner_id = auth.uid())
    and exists (select 1 from public.entries e where e.id = entry_id and e.user_id = auth.uid())
  );

create policy "Users can remove entries from their own collections"
  on public.collection_stamps for delete
  to authenticated
  using (exists (select 1 from public.collections c where c.id = collection_id and c.owner_id = auth.uid()));

-- ============================================================
-- challenges
-- ============================================================
create table if not exists public.challenges (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  target_count integer not null default 1,
  -- Optional: restrict progress to check-ins at these pizzerias only.
  place_ids    text[],
  starts_at    timestamptz,
  ends_at      timestamptz,
  created_at   timestamptz not null default now()
);

create table if not exists public.challenge_progress (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  progress     integer not null default 0,
  completed_at timestamptz,
  primary key (challenge_id, user_id)
);

alter table public.challenges enable row level security;
alter table public.challenge_progress enable row level security;

create policy "Challenges are publicly readable"
  on public.challenges for select
  using (true);

create policy "Users can view their own challenge progress"
  on public.challenge_progress for select
  to authenticated
  using (auth.uid() = user_id);

comment on table public.challenge_progress is
  'Progress should be maintained server-side (a trigger on entries that matches new.place_id against challenges.place_ids and upserts progress), not written directly by the client — no insert/update policy is defined here for that reason.';
