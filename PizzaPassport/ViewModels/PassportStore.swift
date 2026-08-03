import Foundation

/// Central source of truth for the user's collected stamps.
///
/// Storage is offline-first: every change lands in `UserDefaults`-backed
/// JSON immediately, so the app is fully usable with no network. Whenever
/// a Supabase session is reachable, new check-ins are also pushed to the
/// cloud, and any entries created on another device are pulled down and
/// hydrated (photos + stamp downloaded) into local storage. Sync failures
/// are surfaced via `syncError` but never block the local-first UI.
@MainActor
final class PassportStore: ObservableObject {
    @Published private(set) var entries: [PizzaEntry] = []
    @Published var profileHandle: String = "hunter"
    @Published private(set) var isSyncing = false
    @Published var syncError: String?

    private let persistenceKey = "pizza_passport_entries"
    private let supabase = SupabaseService.shared

    init() {
        load()
        Task { await bootstrapRemoteSync() }
    }

    var stampCount: Int { entries.count }

    var averageRating: Double {
        guard !entries.isEmpty else { return 0 }
        return entries.reduce(0) { $0 + $1.rating } / Double(entries.count)
    }

    var publicProfileURL: URL {
        APIConfig.profileURL(username: profileHandle)
    }

    func addEntry(_ entry: PizzaEntry) {
        entries.insert(entry, at: 0)
        save()
        Task { await pushEntryToRemote(entry) }
    }

    func removeEntry(_ entry: PizzaEntry) {
        entries.removeAll { $0.id == entry.id }
        save()
        Task { try? await supabase.deleteEntry(id: entry.id) }
    }

    /// Pushes the app's current VIP entitlement (from `StoreKitManager`) up
    /// to the user's Supabase profile so the public web passport can show
    /// the same VIP badge.
    func syncVIPStatus(_ isVIP: Bool) async {
        do {
            try await supabase.ensureSession()
            guard let userID = await supabase.currentUserID() else { return }
            try await supabase.updateVIPStatus(userID: userID, isVIP: isVIP)
        } catch {
            syncError = "Couldn't sync VIP status: \(error.localizedDescription)"
        }
    }

    // MARK: - Remote sync

    private func bootstrapRemoteSync() async {
        do {
            try await supabase.ensureSession()
            guard let userID = await supabase.currentUserID() else { return }
            try await supabase.ensureProfile(userID: userID, username: profileHandle)
            await pullRemoteEntries()
        } catch {
            // Offline or unreachable — the local-first store keeps working
            // and will retry sync on the next launch or check-in.
            syncError = "Offline — changes will sync when you're back online."
        }
    }

    private func pullRemoteEntries() async {
        isSyncing = true
        defer { isSyncing = false }

        do {
            let remoteEntries = try await supabase.fetchUserEntries(username: profileHandle)
            let newEntries = remoteEntries.filter { remote in
                !entries.contains { $0.id == remote.id }
            }

            if !newEntries.isEmpty {
                entries.append(contentsOf: newEntries)
                entries.sort { $0.date > $1.date }
                save()
            }
            syncError = nil
        } catch {
            syncError = "Couldn't refresh from the cloud: \(error.localizedDescription)"
        }
    }

    private func pushEntryToRemote(_ entry: PizzaEntry) async {
        isSyncing = true
        defer { isSyncing = false }

        do {
            try await supabase.ensureSession()
            guard let userID = await supabase.currentUserID() else { return }
            try await supabase.ensureProfile(userID: userID, username: profileHandle)
            try await supabase.saveEntry(entry)
            syncError = nil
        } catch {
            syncError = "Saved locally — couldn't sync to the cloud yet: \(error.localizedDescription)"
        }
    }

    // MARK: - Local persistence

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
