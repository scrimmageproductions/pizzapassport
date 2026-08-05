import Foundation
import CoreLocation

/// A Codable, Sendable stand-in for `CLLocationCoordinate2D`, which
/// conforms to neither protocol on its own.
struct Coordinate: Codable, Hashable, Sendable {
    var latitude: Double
    var longitude: Double

    init(latitude: Double, longitude: Double) {
        self.latitude = latitude
        self.longitude = longitude
    }

    init(_ coordinate: CLLocationCoordinate2D) {
        latitude = coordinate.latitude
        longitude = coordinate.longitude
    }

    var clLocationCoordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

/// A pizzeria that a user has tagged during check-in. Resolved from
/// MapKit / Google Places search results.
struct Restaurant: Identifiable, Codable, Hashable, Sendable {
    var id: UUID
    var name: String
    var address: String
    var city: String
    var coordinate: Coordinate
    /// Resolved from `CLPlacemark.country` where available — powers the
    /// world map and country-level leaderboards (see `entries.country`).
    var country: String?

    /// Fully-formed remote artwork URL (e.g. a Google Places Photo
    /// reference URL) used as the source image for the ink stamp
    /// generator. `nil` falls back to `LogoFetchService`'s favicon lookup.
    var logoURL: URL?

    init(
        id: UUID = UUID(),
        name: String,
        address: String,
        city: String,
        coordinate: Coordinate,
        country: String? = nil,
        logoURL: URL? = nil
    ) {
        self.id = id
        self.name = name
        self.address = address
        self.city = city
        self.coordinate = coordinate
        self.country = country
        self.logoURL = logoURL
    }
}
