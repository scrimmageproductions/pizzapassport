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
    /// Pizzerias found near a coordinate without the user typing anything —
    /// populated by `searchNearby(near:)`, shown as a tappable list above
    /// the search field so a check-in never *requires* manual typing.
    @Published private(set) var nearbyResults: [Restaurant] = []
    @Published private(set) var isSearchingNearby = false

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

    /// Finds nearby pizzerias through a two-tier fallback chain, mirroring
    /// `searchNearbyPizzerias` in `web/lib/geo.ts`: MapKit's local search
    /// (free, no key, Apple's own POI data) first, then OpenStreetMap's
    /// Overpass API (free, no key, cross-platform-consistent with web) if
    /// MapKit comes back empty. Chain restaurants are filtered out of
    /// either source's results.
    func searchNearby(near coordinate: CLLocationCoordinate2D, radiusMeters: CLLocationDistance = 1500) async {
        isSearchingNearby = true
        defer { isSearchingNearby = false }

        let origin = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)

        if let mapKitResults = try? await searchNearbyViaMapKit(coordinate: coordinate, radiusMeters: radiusMeters),
           !mapKitResults.isEmpty {
            nearbyResults = dedupedSortedByDistance(mapKitResults, from: origin)
            return
        }

        let overpassResults = (try? await searchNearbyViaOverpass(coordinate: coordinate, radiusMeters: radiusMeters)) ?? []
        nearbyResults = dedupedSortedByDistance(overpassResults, from: origin)
    }

    private func searchNearbyViaMapKit(
        coordinate: CLLocationCoordinate2D,
        radiusMeters: CLLocationDistance
    ) async throws -> [Restaurant] {
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = "pizza"
        request.region = MKCoordinateRegion(
            center: coordinate,
            latitudinalMeters: radiusMeters * 2,
            longitudinalMeters: radiusMeters * 2
        )
        request.resultTypes = .pointOfInterest
        request.pointOfInterestFilter = MKPointOfInterestFilter(including: [.restaurant, .bakery, .foodMarket])

        let response = try await MKLocalSearch(request: request).start()
        return response.mapItems.compactMap { item -> Restaurant? in
            guard let name = item.name, !PizzaChainFilter.isChain(name) else { return nil }
            let placemark = item.placemark
            return Restaurant(
                name: name,
                address: placemark.thoroughfare ?? "",
                city: placemark.locality ?? "",
                coordinate: Coordinate(placemark.coordinate),
                country: placemark.country
            )
        }
    }

    private func searchNearbyViaOverpass(
        coordinate: CLLocationCoordinate2D,
        radiusMeters: CLLocationDistance
    ) async throws -> [Restaurant] {
        let radius = Int(radiusMeters)
        let query = """
        [out:json][timeout:15];\
        (node["amenity"~"restaurant|fast_food|cafe"]["cuisine"~"pizza",i](around:\(radius),\(coordinate.latitude),\(coordinate.longitude));\
        node["name"~"pizza",i](around:\(radius),\(coordinate.latitude),\(coordinate.longitude)););\
        out center 30;
        """
        guard let url = URL(string: "https://overpass-api.de/api/interpreter") else {
            throw PlaceSearchError.invalidURL
        }
        var request = URLRequest(url: url, timeoutInterval: 12)
        request.httpMethod = "POST"
        request.httpBody = query.data(using: .utf8)
        request.setValue("text/plain", forHTTPHeaderField: "Content-Type")

        let (data, _) = try await URLSession.shared.data(for: request)
        let decoded = try JSONDecoder().decode(OverpassResponse.self, from: data)

        return decoded.elements.compactMap { element -> Restaurant? in
            guard let name = element.tags?["name"], !PizzaChainFilter.isChain(name) else { return nil }
            let address = [element.tags?["addr:housenumber"], element.tags?["addr:street"]]
                .compactMap { $0 }
                .joined(separator: " ")
            return Restaurant(
                name: name,
                address: address,
                city: "",
                coordinate: Coordinate(latitude: element.lat, longitude: element.lon)
            )
        }
    }

    /// Case-insensitive de-dup by name (MapKit and Overpass can both surface
    /// the same venue with slightly different metadata), sorted nearest
    /// `origin` first.
    private func dedupedSortedByDistance(_ restaurants: [Restaurant], from origin: CLLocation) -> [Restaurant] {
        var seenNames = Set<String>()
        var unique: [Restaurant] = []
        for restaurant in restaurants {
            let key = restaurant.name.lowercased()
            guard !seenNames.contains(key) else { continue }
            seenNames.insert(key)
            unique.append(restaurant)
        }
        return unique.sorted { a, b in
            let distanceA = origin.distance(from: CLLocation(latitude: a.coordinate.latitude, longitude: a.coordinate.longitude))
            let distanceB = origin.distance(from: CLLocation(latitude: b.coordinate.latitude, longitude: b.coordinate.longitude))
            return distanceA < distanceB
        }
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

enum PlaceSearchError: Error {
    case invalidURL
}

private struct OverpassElement: Decodable {
    let lat: Double
    let lon: Double
    let tags: [String: String]?
}

private struct OverpassResponse: Decodable {
    let elements: [OverpassElement]
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
