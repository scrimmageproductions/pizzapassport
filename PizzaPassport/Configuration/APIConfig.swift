import Foundation

/// Centralized location for third-party API keys and identifiers.
///
/// ⚠️ Replace every placeholder below with your own credentials before
/// shipping. Do not commit real production keys to source control — prefer
/// an `.xcconfig` file (excluded via `.gitignore`) or a secrets-injection
/// step in CI that writes this file at build time.
enum APIConfig {

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

    /// StoreKit 2 product identifier for the VIP annual subscription.
    /// Must match the product configured in App Store Connect and in the
    /// local `.storekit` testing configuration.
    static let vipProductID = "com.rarepizzas.pizzapassport.vip.yearly"

    /// Base URL for the public web profile used to build each story's
    /// scannable QR code (e.g. `https://pizzapassport.app/u/<handle>`).
    static let publicProfileBaseURL = URL(string: "https://pizzapassport.app/u/")!
}
