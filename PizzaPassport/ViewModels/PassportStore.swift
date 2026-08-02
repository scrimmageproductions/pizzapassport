import Foundation

/// Central source of truth for the user's collected stamps. Free-tier
/// storage is local (`UserDefaults`-backed JSON); VIP cloud backup is a
/// natural extension point once a backend is wired up (see `StoreKitManager.isVIP`).
@MainActor
final class PassportStore: ObservableObject {
    @Published private(set) var entries: [PizzaEntry] = []
    @Published var profileHandle: String = "hunter"

    private let persistenceKey = "pizza_passport_entries"

    init() {
        load()
    }

    var stampCount: Int { entries.count }

    var averageRating: Double {
        guard !entries.isEmpty else { return 0 }
        return entries.reduce(0) { $0 + $1.rating } / Double(entries.count)
    }

    var publicProfileURL: URL {
        APIConfig.publicProfileBaseURL.appendingPathComponent(profileHandle)
    }

    func addEntry(_ entry: PizzaEntry) {
        entries.insert(entry, at: 0)
        save()
    }

    func removeEntry(_ entry: PizzaEntry) {
        entries.removeAll { $0.id == entry.id }
        save()
    }

    private func save() {
        guard let data = try? JSONEncoder().encode(entries) else { return }
        UserDefaults.standard.set(data, forKey: persistenceKey)
    }

    private func load() {
        guard let data = UserDefaults.standard.data(forKey: persistenceKey),
              let decoded = try? JSONDecoder().decode([PizzaEntry].self, from: data) else {
            entries = PizzaEntry.sampleEntries
            return
        }
        entries = decoded
    }
}
