import Foundation

/// Centralized location for third-party API keys and identifiers.
///
/// ⚠️ Replace every placeholder below with your own credentials before
/// shipping. Do not commit real production keys to source control — prefer
/// an `.xcconfig` file (excluded via `.gitignore`) or a secrets-injection
/// step in CI that writes this file at build time.
enum APIConfig {

    // MARK: - Supabase

    /// Your Supabase project's REST/Auth/Storage endpoint, e.g.
    /// `https://abcdefghijklmnop.supabase.co`. Find it under
    /// Project Settings → API in the Supabase dashboard.
    static let supabaseURL = URL(string: "https://YOUR_PROJECT_REF.supabase.co")!

    /// Supabase "anon" public API key. Safe to ship inside the app — Row
    /// Level Security policies (see `Resources/schema.sql`) enforce access
    /// control server-side. Project Settings → API → Project API keys.
    static let supabaseAnonKey = "YOUR_SUPABASE_ANON_KEY"

    // MARK: - Web

    /// The deployed Next.js public passport viewer's domain, with no
    /// trailing slash. Used to build public profile links
    /// (`\(vercelWebDomain)/u/<username>`) and their QR codes.
    static let vercelWebDomain = "https://pizzapassport.vercel.app"

    // MARK: - Google

    /// Google Places API key — used to search for restaurants and resolve
    /// official venue photos for the ink stamp generator.
    /// https://developers.google.com/maps/documentation/places/web-service/get-api-key
    static let googlePlacesAPIKey = "YOUR_GOOGLE_PLACES_API_KEY"

    /// Google Programmable Search Engine (Custom Search JSON API) credentials,
    /// used as a fallback source for restaurant logo artwork when a Places
    /// photo isn't available.
    /// https://developers.google.com/custom-search/v1/overview
    static let googleCustomSearchAPIKey = "YOUR_GOOGLE_CUSTOM_SEARCH_API_KEY"
    static let googleCustomSearchEngineID = "YOUR_CUSTOM_SEARCH_ENGINE_ID"

    // MARK: - StoreKit

    /// StoreKit 2 product identifier for the VIP annual subscription.
    /// Must match the product configured in App Store Connect and in the
    /// local `.storekit` testing configuration.
    static let vipProductID = "com.rarepizzas.pizzapassport.vip.yearly"

    // MARK: - Helpers

    /// Builds a user's public web passport URL, e.g.
    /// `https://pizzapassport.vercel.app/u/hunter` — used for both the
    /// shareable link and its QR code.
    static func profileURL(username: String) -> URL {
        URL(string: "\(vercelWebDomain)/u/\(username)")!
    }
}
