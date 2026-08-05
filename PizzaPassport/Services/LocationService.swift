import Foundation
import CoreLocation
import MapKit

/// Major national fast-food pizza chains excluded from nearby-search
/// results, so check-ins stay focused on local/independent pizzerias.
/// Matched case-insensitively as a substring of the venue name — mirrors
/// `CHAIN_BLACKLIST` in `web/lib/constants.ts`.
enum PizzaChainFilter {
    static let blacklist = [
        "domino's", "dominos", "pizza hut", "papa john", "little caesars",
        "marco's pizza", "marcos pizza", "chuck e. cheese", "chuck e cheese",
        "cici's", "cicis", "hunt brothers", "sbarro",
    ]

    /// True if `name` matches a blacklisted national chain.
    static func isChain(_ name: String) -> Bool {
        let lower = name.lowercased()
        return blacklist.contains { lower.contains($0) }
    }
}

/// Thin wrapper around `CLLocationManager` used to seed place searches with
/// the user's current position.
@MainActor
final class LocationService: NSObject, ObservableObject {
    @Published private(set) var userLocation: CLLocationCoordinate2D?
    @Published private(set) var authorizationStatus: CLAuthorizationStatus = .notDetermined

    private let manager = CLLocationManager()

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    func requestPermission() {
        manager.requestWhenInUseAuthorization()
    }
}

extension LocationService: CLLocationManagerDelegate {
    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor in
            authorizationStatus = status
            if status == .authorizedWhenInUse || status == .authorizedAlways {
                manager.startUpdatingLocation()
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let coordinate = locations.last?.coordinate else { return }
        Task { @MainActor in
            userLocation = coordinate
        }
    }
}

/// Restaurant search built on `MKLocalSearchCompleter`, scoped to
/// points-of-interest that make sense for a pizza check-in. Resolved
/// completions are converted into `Restaurant` values; wiring a real
/// Google Places "Photos" lookup into `googlePlacesPhotoURL(for:)` gives
/// the ink stamp generator an official logo source (see `APIConfig`).
@MainActor
final class PlaceSearchService: NSObject, ObservableObject {
    @Published private(set) var results: [MKLocalSearchCompletion] = []

    private let completer = MKLocalSearchCompleter()

    override init() {
        super.init()
        completer.delegate = self
        completer.resultTypes = .pointOfInterest
        completer.pointOfInterestFilter = MKPointOfInterestFilter(including: [.restaurant, .bakery, .foodMarket])
    }

    func updateQuery(_ text: String, region: MKCoordinateRegion? = nil) {
        if let region {
            completer.region = region
        }
        completer.queryFragment = text
    }

    func resolve(_ completion: MKLocalSearchCompletion) async -> Restaurant? {
        let request = MKLocalSearch.Request(completion: completion)
        let search = MKLocalSearch(request: request)
        guard let response = try? await search.start(), let item = response.mapItems.first else {
            return nil
        }

        let placemark = item.placemark
        return Restaurant(
            name: item.name ?? completion.title,
            address: placemark.thoroughfare ?? completion.subtitle,
            city: placemark.locality ?? "",
            coordinate: Coordinate(placemark.coordinate),
            country: placemark.country,
            logoURL: googlePlacesPhotoURL(for: item)
        )
    }

    /// Placeholder integration point: in production, cross-reference this
    /// `MKMapItem` (by name + coordinate) against the Google Places
    /// "Find Place" and "Place Photos" REST endpoints, using
    /// `APIConfig.googlePlacesAPIKey`, to resolve an official logo photo.
    private func googlePlacesPhotoURL(for item: MKMapItem) -> URL? {
        nil
    }
}

extension PlaceSearchService: MKLocalSearchCompleterDelegate {
    /// Filters out major national chains (see `PizzaChainFilter`) so
    /// results stay focused on local/independent pizzerias — this app is
    /// about discovering those, not logging a Domino's run.
    nonisolated func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        let items = completer.results.filter { !PizzaChainFilter.isChain($0.title) }
        Task { @MainActor in
            results = items
        }
    }

    nonisolated func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
        Task { @MainActor in
            results = []
        }
    }
}
