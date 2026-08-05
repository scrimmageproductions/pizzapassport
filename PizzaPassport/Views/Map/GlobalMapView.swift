import SwiftUI
import MapKit

/// Approximate country centroids used only to place a dot on the global
/// activity map — not for anything precision-sensitive. Keyed by the
/// English country name as returned by `CLPlacemark.country` (see
/// `LocationService.swift`), since that's what gets stored on
/// `entries.country` at check-in time. Mirrors
/// `web/lib/countryCentroids.ts`.
private let countryCentroids: [String: CLLocationCoordinate2D] = [
    "United States": .init(latitude: 39.8, longitude: -98.6),
    "Canada": .init(latitude: 56.1, longitude: -106.3),
    "Mexico": .init(latitude: 23.6, longitude: -102.5),
    "Brazil": .init(latitude: -14.2, longitude: -51.9),
    "Argentina": .init(latitude: -38.4, longitude: -63.6),
    "Chile": .init(latitude: -35.7, longitude: -71.5),
    "Colombia": .init(latitude: 4.6, longitude: -74.3),
    "Peru": .init(latitude: -9.2, longitude: -75.0),
    "United Kingdom": .init(latitude: 55.4, longitude: -3.4),
    "Ireland": .init(latitude: 53.4, longitude: -8.2),
    "France": .init(latitude: 46.2, longitude: 2.2),
    "Germany": .init(latitude: 51.2, longitude: 10.5),
    "Italy": .init(latitude: 41.9, longitude: 12.6),
    "Spain": .init(latitude: 40.5, longitude: -3.7),
    "Portugal": .init(latitude: 39.4, longitude: -8.2),
    "Netherlands": .init(latitude: 52.1, longitude: 5.3),
    "Belgium": .init(latitude: 50.5, longitude: 4.5),
    "Switzerland": .init(latitude: 46.8, longitude: 8.2),
    "Austria": .init(latitude: 47.5, longitude: 14.6),
    "Poland": .init(latitude: 51.9, longitude: 19.1),
    "Sweden": .init(latitude: 60.1, longitude: 18.6),
    "Norway": .init(latitude: 60.5, longitude: 8.5),
    "Denmark": .init(latitude: 56.3, longitude: 9.5),
    "Finland": .init(latitude: 61.9, longitude: 25.7),
    "Greece": .init(latitude: 39.1, longitude: 21.8),
    "Turkey": .init(latitude: 38.9, longitude: 35.2),
    "Russia": .init(latitude: 61.5, longitude: 105.3),
    "South Africa": .init(latitude: -30.6, longitude: 22.9),
    "Egypt": .init(latitude: 26.8, longitude: 30.8),
    "Nigeria": .init(latitude: 9.1, longitude: 8.7),
    "Kenya": .init(latitude: -0.02, longitude: 37.9),
    "Morocco": .init(latitude: 31.8, longitude: -7.1),
    "China": .init(latitude: 35.9, longitude: 104.2),
    "Japan": .init(latitude: 36.2, longitude: 138.3),
    "South Korea": .init(latitude: 35.9, longitude: 127.8),
    "India": .init(latitude: 20.6, longitude: 79.0),
    "Indonesia": .init(latitude: -0.8, longitude: 113.9),
    "Thailand": .init(latitude: 15.9, longitude: 101.0),
    "Vietnam": .init(latitude: 14.1, longitude: 108.3),
    "Philippines": .init(latitude: 12.9, longitude: 121.8),
    "Malaysia": .init(latitude: 4.2, longitude: 101.9),
    "Singapore": .init(latitude: 1.35, longitude: 103.8),
    "Israel": .init(latitude: 31.0, longitude: 34.9),
    "Saudi Arabia": .init(latitude: 23.9, longitude: 45.1),
    "United Arab Emirates": .init(latitude: 23.4, longitude: 53.8),
    "Australia": .init(latitude: -25.3, longitude: 133.8),
    "New Zealand": .init(latitude: -40.9, longitude: 174.9),
]

/// One country's aggregated activity, positioned at its centroid for the
/// map annotation.
private struct MapDatum: Identifiable {
    let id: String
    let row: CountryActivityRow
    let coordinate: CLLocationCoordinate2D
}

/// World map of pizza check-in activity by country/region: a dot per
/// country, sized by total check-ins, with a top-countries list. Tapping
/// either a dot or a list row shows a summary (e.g. "Italy: 1,420 Slices
/// Stamped"). Backed by `public.country_activity` (see
/// `Resources/schema_gamification.sql`).
struct GlobalMapView: View {
    @State private var rows: [CountryActivityRow] = []
    @State private var isLoading = true
    @State private var loadError: String?
    @State private var selectedCountry: String?
    @State private var cameraPosition: MapCameraPosition = .region(
        MKCoordinateRegion(center: .init(latitude: 20, longitude: 0), span: .init(latitudeDelta: 140, longitudeDelta: 340))
    )

    private var maxCheckins: Int { rows.map(\.totalCheckins).max() ?? 0 }
    private var ranked: [CountryActivityRow] { rows.sorted { $0.totalCheckins > $1.totalCheckins } }
    private var mapData: [MapDatum] {
        rows.compactMap { row in
            guard let coordinate = countryCentroids[row.country] else { return nil }
            return MapDatum(id: row.country, row: row, coordinate: coordinate)
        }
    }
    private var selected: CountryActivityRow? { rows.first { $0.country == selectedCountry } }

    var body: some View {
        NavigationStack {
            ZStack {
                PizzaTheme.backgroundGradient.ignoresSafeArea()

                if isLoading {
                    ProgressView("Loading global activity…").tint(PizzaTheme.mozzarellaCream)
                } else if let loadError {
                    ContentUnavailableView(
                        "Couldn't Load Map",
                        systemImage: "wifi.slash",
                        description: Text(loadError)
                    )
                } else {
                    VStack(spacing: 0) {
                        Map(position: $cameraPosition) {
                            ForEach(mapData) { datum in
                                Annotation(datum.row.country, coordinate: datum.coordinate) {
                                    dot(for: datum.row)
                                }
                            }
                        }
                        .frame(height: 280)
                        .mapStyle(.standard(elevation: .flat))

                        if let selected {
                            summaryCard(for: selected)
                        }

                        List {
                            Section("Top Countries") {
                                ForEach(Array(ranked.prefix(10).enumerated()), id: \.element.country) { index, row in
                                    Button {
                                        selectedCountry = (selectedCountry == row.country) ? nil : row.country
                                    } label: {
                                        HStack {
                                            Text("#\(index + 1) \(row.country)")
                                                .foregroundStyle(PizzaTheme.mozzarellaCream)
                                            Spacer()
                                            Text("\(row.totalCheckins) slices")
                                                .font(.subheadline.weight(.bold))
                                                .foregroundStyle(PizzaTheme.crustGold)
                                        }
                                    }
                                    .listRowBackground(
                                        row.country == selectedCountry
                                            ? PizzaTheme.crustGold.opacity(0.12)
                                            : Color.white.opacity(0.03)
                                    )
                                }
                            }
                        }
                        .listStyle(.plain)
                        .scrollContentBackground(.hidden)
                    }
                }
            }
            .navigationTitle("World Pizza Map")
            .navigationBarTitleDisplayMode(.inline)
        }
        .preferredColorScheme(.dark)
        .task { await load() }
    }

    private func dot(for row: CountryActivityRow) -> some View {
        let scale = maxCheckins > 0 ? sqrt(Double(row.totalCheckins) / Double(maxCheckins)) : 0
        let diameter = 10 + scale * 22
        return Circle()
            .fill(row.country == selectedCountry ? PizzaTheme.crustGold : PizzaTheme.tomatoRed)
            .opacity(0.75)
            .frame(width: diameter, height: diameter)
            .overlay(Circle().stroke(PizzaTheme.mozzarellaCream.opacity(row.country == selectedCountry ? 0.9 : 0), lineWidth: 2))
            .onTapGesture {
                selectedCountry = (selectedCountry == row.country) ? nil : row.country
            }
    }

    private func summaryCard(for row: CountryActivityRow) -> some View {
        VStack(spacing: 2) {
            Text("🍕 \(row.country): \(row.totalCheckins) Slices Stamped")
                .font(.headline)
                .foregroundStyle(PizzaTheme.mozzarellaCream)
            Text("\(row.totalExplorers) explorer\(row.totalExplorers == 1 ? "" : "s") checking in")
                .font(.caption)
                .foregroundStyle(PizzaTheme.mozzarellaCream.opacity(0.6))
        }
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity)
        .background(PizzaTheme.crustGold.opacity(0.12))
    }

    private func load() async {
        isLoading = true
        loadError = nil
        do {
            rows = try await SupabaseService.shared.fetchCountryActivity()
        } catch {
            loadError = error.localizedDescription
        }
        isLoading = false
    }
}

#Preview {
    GlobalMapView()
}
