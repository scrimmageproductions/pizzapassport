# Pizza Passport 🍕

A social digital passport app for pizza lovers: track visits ("Slices"),
collect ink-textured restaurant stamps, and export high-design vertical
stories.

## Tech stack

- Swift 6, iOS 17+
- SwiftUI, MVVM + Clean Architecture, async/await throughout
- Core Image (`CIFilterBuiltins`) for the rubber ink stamp effect
- CoreLocation + MapKit for restaurant search
- StoreKit 2 for the VIP subscription
- `ImageRenderer` + `PhotosUI` + `ShareLink` for the story exporter
- Supabase (Auth, Storage, Postgres) for cloud sync and the public web profile
- Next.js 14 (App Router) + Tailwind CSS for the public passport viewer (`/web`)

## Project layout

```
PizzaPassport/
├── App/
│   └── PizzaPassportApp.swift        Root @main entry point
├── Configuration/
│   └── APIConfig.swift               API keys & product IDs (placeholders)
├── Models/
│   ├── CrustType.swift
│   ├── StampInkColor.swift
│   ├── Restaurant.swift
│   └── PizzaEntry.swift
├── Services/
│   ├── StampInkFilter.swift          Core Image rubber-stamp pipeline
│   ├── LogoFetchService.swift        Remote logo fetch (Places / favicon)
│   ├── LocationService.swift         CoreLocation + MKLocalSearchCompleter
│   ├── StoreKitManager.swift         StoreKit 2 product + entitlement logic
│   └── SupabaseService.swift         Auth, Storage uploads, DB sync
├── Utilities/
│   └── QRCodeGenerator.swift
├── ViewModels/
│   └── PassportStore.swift           Offline-first store, synced to Supabase
├── Theme/
│   └── PizzaTheme.swift              Colors, fonts, button styles
├── Views/
│   ├── Root/RootTabView.swift        Tab navigation, VIP feed gate, settings
│   ├── Passport/PassportView.swift   Stamp book grid + page flipping
│   ├── Passport/StampView.swift
│   ├── CheckIn/CheckInView.swift     Multi-step check-in flow
│   ├── CheckIn/PlateRatingView.swift
│   ├── Story/StoryExporterView.swift Story canvas + PNG export
│   └── Paywall/PaywallView.swift     StoreKit 2 paywall
└── Resources/
    ├── Info.plist                    Usage-description keys
    ├── PizzaPassport.storekit        Local StoreKit testing config
    └── schema.sql                    Supabase tables, RLS policies, storage bucket

web/                                  Public passport viewer — see web/README.md
├── app/layout.tsx, app/page.tsx, app/u/[username]/page.tsx
├── components/StampGrid.tsx, EntryCard.tsx, AppStoreBanner.tsx
└── lib/supabase/server.ts, lib/types.ts
```

## Setting up the Xcode project

This repo ships the modular Swift source tree; wiring it into an `.xcodeproj`
takes a few minutes:

1. **Xcode → File → New → Project → iOS → App.**
   - Interface: SwiftUI, Language: Swift, Minimum Deployment: iOS 17.0.
   - Name it `PizzaPassport` (or your bundle's product name).
2. Delete the generated placeholder `ContentView.swift` and `App.swift`.
3. Drag the `PizzaPassport/` folder from this repo into the project
   navigator (choose "Create groups", target membership checked).
4. In **Signing & Capabilities**, add:
   - **In-App Purchase** (required for StoreKit 2).
5. Add the Supabase Swift SDK: **File → Add Package Dependencies…**, URL
   `https://github.com/supabase/supabase-swift`, and add the **Supabase**
   library to the app target (required by `SupabaseService.swift`).
6. Merge the keys from `Resources/Info.plist` into your target's Info.plist
   (or point the target directly at this file).
7. To test the VIP purchase locally: **Product → Scheme → Edit Scheme →
   Run → Options**, set **StoreKit Configuration** to
   `Resources/PizzaPassport.storekit`.
8. Set your bundle identifier so it's consistent with
   `APIConfig.vipProductID` (`com.rarepizzas.pizzapassport.vip.yearly`), or
   update that constant to match your own reverse-DNS ID.

## API keys & backend config

Open `Configuration/APIConfig.swift` and replace the placeholders:

- `supabaseURL` / `supabaseAnonKey` — from your Supabase project's
  Settings → API page. Run `Resources/schema.sql` in the Supabase SQL
  Editor first (see below) so the expected tables/bucket exist.
- `vercelWebDomain` — the deployed `/web` app's domain (no trailing
  slash), used to build public profile links and their QR codes.
- `googlePlacesAPIKey` — powers restaurant search/photo lookups if you wire
  up the Google Places REST API (see `PlaceSearchService.googlePlacesPhotoURL`
  for the integration point; MapKit is used out of the box and needs no key).
- `googleCustomSearchAPIKey` / `googleCustomSearchEngineID` — optional
  fallback source for restaurant logo artwork.

Never commit real keys — use an `.xcconfig` file excluded via `.gitignore`,
or inject them at build time in CI.

## Backend setup (Supabase)

1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL Editor and run `PizzaPassport/Resources/schema.sql` — it
   creates `public.profiles`, `public.entries`, their Row Level Security
   policies (public read, owner-only write), and the public `pizza-photos`
   Storage bucket.
3. Copy the project URL and anon key into `APIConfig.swift` (or your
   `.xcconfig` secrets).
4. `PassportStore` signs users in anonymously on first launch (no login
   screen required) so every install can sync check-ins to the cloud;
   `SupabaseService` also exposes email/password and Sign in with Apple for
   upgrading that session to a permanent account.

## Web viewer (`/web`)

A public, read-only Next.js passport viewer lives in `/web` — see
`web/README.md` for local dev and Vercel deployment steps. It reads
directly from the same Supabase tables via the public-read RLS policies,
so no separate API layer is needed.

## Notes on the ink stamp generator

`StampInkFilter` runs a Core Image pipeline (monochrome → contrast/posterize
→ procedural grunge distress → ink tint via alpha masking → bleed/blur →
seeded random rotation) to turn any fetched logo into a stamp. The seed is
derived from the restaurant's identifier, so a given restaurant always
renders the same distressed look and rotation rather than re-rolling on
every launch.

## Monetization

Free users get unlimited local stamps and story exports. The $1.00/year
**Pizza Passport VIP** pass (`PaywallView.swift`, `StoreKitManager.swift`)
unlocks social feed publishing, global feed discovery, and cloud backup —
gated in `RootTabView`'s Feed tab.
