# Pizza Passport — Web

Public, read-only passport viewer built with Next.js 14 (App Router) +
Tailwind CSS. It reads directly from the same Supabase project as the iOS
app — no separate API layer — relying on the public-read Row Level
Security policies defined in `../PizzaPassport/Resources/schema.sql`.

Every user's passport is served at `/u/<username>`.

## Local development

```bash
cp .env.local.example .env.local   # fill in your Supabase project URL + anon key
npm install
npm run dev
```

Then visit `http://localhost:3000/u/<username>` for any username that has
checked in via the iOS app (or seeded manually in Supabase).

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
│   ├── layout.tsx              Dark, pizza-themed shell (header/footer)
│   ├── page.tsx                Marketing landing page
│   └── u/[username]/
│       ├── page.tsx            Server-rendered public passport
│       └── not-found.tsx       Shown when the username doesn't exist
├── components/
│   ├── StampGrid.tsx           Responsive grid of collected stamps
│   ├── EntryCard.tsx           Single check-in: photos, stamp, rating
│   └── AppStoreBanner.tsx      "Download on the App Store" CTA
└── lib/
    ├── types.ts                TypeScript mirrors of the DB tables
    └── supabase/server.ts      Server-side Supabase client (anon key)
```
