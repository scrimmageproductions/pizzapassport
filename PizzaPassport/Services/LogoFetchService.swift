import Foundation
import UIKit

enum LogoFetchError: Error {
    case notConfigured
    case badResponse
}

/// Fetches a restaurant's logo artwork so it can be run through
/// `StampInkFilter`. Tries, in order:
///  1. A Google Places Photo URL already resolved onto `Restaurant.logoURL`
///     (see `PlaceSearchService`).
///  2. A public favicon/logo lookup keyed off the restaurant's name.
///  3. A bundled SF Symbol placeholder mark.
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
        if let faviconImage = try? await fetchFromLogoFallback(restaurant) {
            return faviconImage
        }
        return placeholderLogo()
    }

    // MARK: Google Places Photos

    private func fetchFromGooglePlaces(_ restaurant: Restaurant) async throws -> UIImage {
        guard let logoURL = restaurant.logoURL else {
            throw LogoFetchError.notConfigured
        }
        // `logoURL` is expected to already be a fully-formed Places Photo
        // request, built by the place-search layer from a `photo_reference`
        // plus `APIConfig.googlePlacesAPIKey`, e.g.:
        // https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=...&key=...
        let (data, response) = try await session.data(from: logoURL)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200,
              let image = UIImage(data: data) else {
            throw LogoFetchError.badResponse
        }
        return image
    }

    // MARK: Key-free fallback

    private func fetchFromLogoFallback(_ restaurant: Restaurant) async throws -> UIImage {
        // A lightweight, key-free fallback: derive a domain-style query from
        // the restaurant name and pull an icon from a public logo API (e.g.
        // Clearbit's Logo API). In production, prefer resolving the venue's
        // real website via the Google Places "Place Details" `website` field
        // before falling back to a name guess like this.
        let slug = restaurant.name
            .lowercased()
            .filter { $0.isLetter || $0.isNumber }
        guard !slug.isEmpty, let url = URL(string: "https://logo.clearbit.com/\(slug).com?size=256") else {
            throw LogoFetchError.notConfigured
        }
        let (data, response) = try await session.data(from: url)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200,
              let image = UIImage(data: data) else {
            throw LogoFetchError.badResponse
        }
        return image
    }

    private func placeholderLogo() -> UIImage {
        UIImage(systemName: "fork.knife.circle.fill") ?? UIImage()
    }
}
