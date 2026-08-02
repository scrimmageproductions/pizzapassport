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
│   └── StoreKitManager.swift         StoreKit 2 product + entitlement logic
├── Utilities/
│   └── QRCodeGenerator.swift
├── ViewModels/
│   └── PassportStore.swift           Local persistence of check-ins
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
    └── PizzaPassport.storekit        Local StoreKit testing config
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
5. Merge the keys from `Resources/Info.plist` into your target's Info.plist
   (or point the target directly at this file).
6. To test the VIP purchase locally: **Product → Scheme → Edit Scheme →
   Run → Options**, set **StoreKit Configuration** to
   `Resources/PizzaPassport.storekit`.
7. Set your bundle identifier so it's consistent with
   `APIConfig.vipProductID` (`com.rarepizzas.pizzapassport.vip.yearly`), or
   update that constant to match your own reverse-DNS ID.

## API keys

Open `Configuration/APIConfig.swift` and replace the placeholders:

- `googlePlacesAPIKey` — powers restaurant search/photo lookups if you wire
  up the Google Places REST API (see `PlaceSearchService.googlePlacesPhotoURL`
  for the integration point; MapKit is used out of the box and needs no key).
- `googleCustomSearchAPIKey` / `googleCustomSearchEngineID` — optional
  fallback source for restaurant logo artwork.

Never commit real keys — use an `.xcconfig` file excluded via `.gitignore`,
or inject them at build time in CI.

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
