# Pizza Passport — Web

A fully interactive, standalone web version of Pizza Passport, built with
Next.js 14 (App Router) + Tailwind CSS + Supabase. It's not just a public
viewer: visitors can create a passport, check in to a pizzeria, generate a
distressed ink stamp entirely in-browser via Canvas, and export a
Spotify-Wrapped-style story — no iOS app or account required.

It reads and writes directly against the same Supabase project as the iOS
app — no separate API layer — via anonymous auth and the Row Level Security
policies defined in `../PizzaPassport/Resources/schema.sql` (public read,
owner-only write).

## Routes

| Route | Description |
| --- | --- |
| `/` | Hero landing page with a live, interactive ink-stamp demo |
| `/passport` | Your stamp book: paged grid, stats, editable username, entry detail modal |
| `/check-in` | 4-step check-in: location, dual photo upload, Plate rating + crust + ink color, stamp preview |
| `/story/[id]` | 9:16 story canvas for one check-in: palette switcher, QR code, PNG export/share |
| `/u/[username]` | Public, server-rendered passport — the QR code target |

## How identity works (no login screen)

On first visit, `lib/useLocalProfile.ts` signs the browser in anonymously
via Supabase Auth and creates a `profiles` row with a randomly-generated
username (e.g. `saucy-slice-7f2a`), cached in `localStorage`. You can
rename it any time from the `/passport` page header — that's your public
`/u/<username>` handle. This mirrors the anonymous-first model
`SupabaseService.ensureSession()` uses on iOS.

## The Canvas ink stamp engine

`lib/stampFilter.ts` runs the same conceptual pipeline as the iOS app's
`StampInkFilter.swift` (Core Image), reimplemented on the HTML5 Canvas 2D
API: normalize → monochrome/threshold → procedural seeded-noise grunge
distress → ink tint via an alpha mask → blur bleed → seeded random
rotation. It's deterministic per seed, so the same restaurant always
distresses and rotates the same way.

Check-in stamps are generated from the venue photo you just uploaded
(a same-origin `blob:` URL, so there's no canvas-CORS risk); the landing
page's live demo stamps a generated letter-glyph instead, so it needs no
photo and no network call. If a future integration ever feeds in a
cross-origin logo URL that blocks `getImageData`, `generateInkStamp` falls
back to a vector pizza-slice stamp automatically.

## Local development

```bash
cp .env.local.example .env.local   # fill in your Supabase project URL + anon key
npm install
npm run dev
```

Then visit `http://localhost:3000`, hit **Open Web Passport**, and check
in — everything works against your Supabase project from the first run.

## Deploying to Vercel

1. Import this repository into Vercel.
2. Set the project's **Root Directory** to `web`.
3. Add the two environment variables from `.env.local.example` under
   Project → Settings → Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy. Every push to the connected branch redeploys automatically.

Once deployed, set `APIConfig.vercelWebDomain` in the iOS app to your
production domain (e.g. `https://pizza-passport.vercel.app`) so in-app QR
codes and share links point at the right place.

## Structure

```
web/
├── app/
│   ├── layout.tsx              Dark, pizza-themed shell + Navbar
│   ├── page.tsx                Hero landing page + live stamp demo
│   ├── passport/page.tsx       Interactive stamp book (client)
│   ├── check-in/page.tsx       Multi-step check-in flow (client)
│   ├── story/[id]/page.tsx     Story generator + PNG export (client)
│   └── u/[username]/
│       ├── page.tsx            Server-rendered public passport
│       └── not-found.tsx       Shown when the username doesn't exist
├── components/
│   ├── Navbar.tsx              Sticky nav, active-route highlighting
│   ├── PlateRating.tsx         Interactive/read-only half-Plate rating
│   ├── StampGrid.tsx           Responsive grid of collected stamps
│   ├── EntryCard.tsx           Single check-in: photos, stamp, rating
│   └── AppStoreBanner.tsx      "Download on the App Store" CTA
└── lib/
    ├── types.ts                TypeScript mirrors of the DB tables
    ├── constants.ts            Crust styles + ink color palette (shared)
    ├── stampFilter.ts          Canvas ink-stamp rendering engine
    ├── useLocalProfile.ts      Anonymous auth + localStorage username
    └── supabase/
        ├── client.ts           Browser Supabase client (anon key)
        └── server.ts           Server Supabase client (anon key)
```

## Notes / known gaps

- **Restaurant search** uses the browser's Geolocation API to pin a
  check-in rather than a Places Autocomplete widget — see the comment in
  `.env.local.example` for the drop-in upgrade path once you have a Google
  Places API key.
- **Check-in notes** aren't in the current `entries` schema (see
  `../PizzaPassport/Resources/schema.sql`), so the web check-in flow
  doesn't collect them either — add a `notes text` column and a field in
  `app/check-in/page.tsx`'s details step if you want that parity with the
  iOS app's `PizzaEntry.notes`.
