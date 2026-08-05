import Foundation
import UIKit

enum LogoFetchError: Error {
    case notConfigured
    case badResponse
    /// All three real-artwork tiers were exhausted. Callers should fall
    /// back to `StampInkFilter.makeNameArchStamp` (the full-name arch
    /// stamp) rather than treat this as a hard failure.
    case noLogoFound
}

/// Fetches a restaurant's logo artwork so it can be run through
/// `StampInkFilter.makeStamp`. Tries three progressively more generic,
/// internationally-applicable sources, in order:
///  1. A Google Places Photo URL already resolved onto `Restaurant.logoURL`.
///  2. Brandfetch/Clearbit's Logo API, keyed off a guessed domain.
///  3. Google's high-res favicon service, keyed off the same domain.
/// If all three fail, throws `.noLogoFound` — the caller (see
/// `CheckInView.generateStampIfNeeded`) should fall back to
/// `StampInkFilter.makeNameArchStamp`, which stamps the full restaurant
/// name instead of a logo.
protocol LogoFetching: Sendable {
    func fetchLogo(for restaurant: Restaurant) async throws -> UIImage
}

struct LogoFetchService: LogoFetching {
    private let session: URLSession

    init(session: URLSession = .shared) {
        self.session = session
    }

    func fetchLogo(for restaurant: Restaurant) async throws -> UIImage {
        if let placesImage = try? await fetchFromGooglePlaces(restaurant) {
            return placesImage
        }
        if let domain = domainGuess(for: restaurant.name) {
            if let brandImage = try? await fetchFromBrandLogoAPI(domain: domain) {
                return brandImage
            }
            if let faviconImage = try? await fetchFromFavicon(domain: domain) {
                return faviconImage
            }
        }
        throw LogoFetchError.noLogoFound
    }

    // MARK: Tier 1 — Google Places Photos

    private func fetchFromGooglePlaces(_ restaurant: Restaurant) async throws -> UIImage {
        guard let logoURL = restaurant.logoURL else {
            throw LogoFetchError.notConfigured
        }
        // `logoURL` is expected to already be a fully-formed Places Photo
        // request, built by the place-search layer from a `photo_reference`
        // plus `APIConfig.googlePlacesAPIKey`, e.g.:
        // https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=...&key=...
        return try await downloadImage(from: logoURL)
    }

    // MARK: Tier 2 — Brandfetch / Clearbit Logo API

    private func fetchFromBrandLogoAPI(domain: String) async throws -> UIImage {
        guard let url = URL(string: "https://logo.clearbit.com/\(domain)?size=256") else {
            throw LogoFetchError.notConfigured
        }
        return try await downloadImage(from: url)
    }

    // MARK: Tier 3 — High-res favicon extraction

    private func fetchFromFavicon(domain: String) async throws -> UIImage {
        guard let url = URL(string: "https://www.google.com/s2/favicons?domain=\(domain)&sz=256") else {
            throw LogoFetchError.notConfigured
        }
        return try await downloadImage(from: url)
    }

    // MARK: Helpers

    private func downloadImage(from url: URL) async throws -> UIImage {
        let (data, response) = try await session.data(from: url)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200,
              let image = UIImage(data: data) else {
            throw LogoFetchError.badResponse
        }
        return image
    }

    /// Best-effort domain guess from a restaurant's name, used only when
    /// there's no real website on file. In production, prefer resolving
    /// the venue's actual website via the Google Places "Place Details"
    /// `website` field before falling back to a name guess like this.
    private func domainGuess(for restaurantName: String) -> String? {
        let slug = restaurantName
            .lowercased()
            .filter { $0.isLetter || $0.isNumber }
        return slug.isEmpty ? nil : "\(slug).com"
    }
}
