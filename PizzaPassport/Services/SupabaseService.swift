import Foundation
import Supabase

/// Thin async/await wrapper around the Supabase Swift SDK for
/// authentication, check-in photo storage, and passport persistence.
///
/// Requires the `supabase-swift` package to be added via Swift Package
/// Manager: https://github.com/supabase/supabase-swift — add the
/// `Supabase` product to the app target.
///
/// Isolated as an `actor` since `SupabaseClient` is shared, long-lived
/// state accessed from multiple concurrent check-in/sync tasks.
actor SupabaseService {
    static let shared = SupabaseService()

    private let client: SupabaseClient
    private let photosBucket = "pizza-photos"

    private init() {
        client = SupabaseClient(supabaseURL: APIConfig.supabaseURL, supabaseKey: APIConfig.supabaseAnonKey)
    }

    // MARK: - Authentication

    /// Ensures there's a signed-in session, transparently falling back to
    /// an anonymous account so every install can sync to the cloud without
    /// forcing an account wall. Safe to call repeatedly.
    func ensureSession() async throws {
        if (try? await client.auth.session) != nil {
            return
        }
        try await client.auth.signInAnonymously()
    }

    func currentUserID() async -> UUID? {
        try? await client.auth.session.user.id
    }

    /// Upgrades the current (possibly anonymous) session to a permanent
    /// email/password account — e.g. once a user opts into recovering
    /// their passport on a new device.
    func signUp(email: String, password: String) async throws {
        _ = try await client.auth.signUp(email: email, password: password)
    }

    func signIn(email: String, password: String) async throws {
        try await client.auth.signIn(email: email, password: password)
    }

    /// Sign in with Apple, using the identity token + raw nonce produced by
    /// an `ASAuthorizationAppleIDCredential` request.
    func signInWithApple(idToken: String, nonce: String) async throws {
        try await client.auth.signInWithIdToken(
            credentials: OpenIDConnectCredentials(provider: .apple, idToken: idToken, nonce: nonce)
        )
    }

    func signOut() async throws {
        try await client.auth.signOut()
    }

    // MARK: - Storage

    /// Uploads a single image to the public `pizza-photos` bucket and
    /// returns its public URL.
    func uploadPhoto(_ data: Data, path: String) async throws -> URL {
        try await client.storage.from(photosBucket).upload(
            path: path,
            file: data,
            options: FileOptions(contentType: "image/jpeg", upsert: true)
        )
        return try client.storage.from(photosBucket).getPublicURL(path: path)
    }

    /// Uploads both required check-in photos plus the generated ink stamp,
    /// namespaced under the entry's own identifier so re-syncing an edited
    /// entry overwrites the same objects.
    func uploadCheckInPhotos(
        entryID: UUID,
        atmosphere: Data,
        selfie: Data,
        stamp: Data
    ) async throws -> (venueURL: URL, selfieURL: URL, stampURL: URL) {
        async let venue = uploadPhoto(atmosphere, path: "\(entryID)/venue.jpg")
        async let action = uploadPhoto(selfie, path: "\(entryID)/selfie.jpg")
        async let stampUpload = uploadPhoto(stamp, path: "\(entryID)/stamp.png")
        return try await (venue, action, stampUpload)
    }

    // MARK: - Database

    func fetchProfile(username: String) async throws -> RemoteProfile? {
        try await client
            .from("profiles")
            .select()
            .eq("username", value: username)
            .limit(1)
            .execute()
            .value
            .first
    }

    /// Creates (or refreshes) the caller's profile row. Called after
    /// `ensureSession()` so anonymous users still have a stable public
    /// `username` to share.
    func ensureProfile(userID: UUID, username: String) async throws {
        let profile = RemoteProfile(id: userID, username: username, avatarURL: nil, isVIP: false, createdAt: nil)
        try await client.from("profiles").upsert(profile, onConflict: "id").execute()
    }

    /// Fetches every check-in belonging to a signed-in user, newest first.
    func fetchUserEntries(userID: UUID) async throws -> [RemoteEntry] {
        try await client
            .from("entries")
            .select()
            .eq("user_id", value: userID)
            .order("created_at", ascending: false)
            .execute()
            .value
    }

    /// Uploads photos, then upserts the check-in row. Call after
    /// `ensureSession()` has produced a signed-in (possibly anonymous) user.
    func saveEntry(_ entry: PizzaEntry, userID: UUID) async throws {
        let uploads = try await uploadCheckInPhotos(
            entryID: entry.id,
            atmosphere: entry.atmospherePhotoData,
            selfie: entry.actionPhotoData,
            stamp: entry.stampImageData
        )

        let row = RemoteEntry(
            id: entry.id,
            userID: userID,
            restaurantName: entry.restaurant.name,
            latitude: entry.restaurant.coordinate.latitude,
            longitude: entry.restaurant.coordinate.longitude,
            rating: entry.rating,
            crustType: entry.crust.rawValue,
            venuePhotoURL: uploads.venueURL,
            selfiePhotoURL: uploads.selfieURL,
            stampImageURL: uploads.stampURL,
            inkColor: entry.inkColor.rawValue,
            createdAt: entry.date
        )

        try await client.from("entries").upsert(row, onConflict: "id").execute()
    }

    func deleteEntry(id: UUID) async throws {
        try await client.from("entries").delete().eq("id", value: id).execute()
    }

    /// Persists the VIP flag on the user's profile once StoreKit reports an
    /// active subscription, so the web passport can show the VIP badge too.
    func updateVIPStatus(userID: UUID, isVIP: Bool) async throws {
        try await client
            .from("profiles")
            .update(["is_vip": isVIP])
            .eq("id", value: userID)
            .execute()
    }
}

// MARK: - Wire types

/// Codable mirror of the `public.profiles` table (see `Resources/schema.sql`).
struct RemoteProfile: Codable, Sendable {
    var id: UUID
    var username: String
    var avatarURL: String?
    var isVIP: Bool
    var createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, username
        case avatarURL = "avatar_url"
        case isVIP = "is_vip"
        case createdAt = "created_at"
    }
}

/// Codable mirror of the `public.entries` table — the wire format used to
/// sync a `PizzaEntry` to and from Supabase. Photo/stamp blobs live in
/// Storage rather than the database, so this type carries URLs, not `Data`.
struct RemoteEntry: Codable, Sendable, Identifiable {
    var id: UUID
    var userID: UUID
    var restaurantName: String
    var latitude: Double
    var longitude: Double
    var rating: Double
    var crustType: String
    var venuePhotoURL: URL
    var selfiePhotoURL: URL
    var stampImageURL: URL
    var inkColor: String
    var createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case userID = "user_id"
        case restaurantName = "restaurant_name"
        case latitude, longitude, rating
        case crustType = "crust_type"
        case venuePhotoURL = "venue_photo_url"
        case selfiePhotoURL = "selfie_photo_url"
        case stampImageURL = "stamp_image_url"
        case inkColor = "ink_color"
        case createdAt = "created_at"
    }
}

extension RemoteEntry {
    /// Downloads the venue, selfie, and stamp images so this remote row can
    /// be materialized into a fully offline-capable `PizzaEntry` for local
    /// caching. Returns `nil` if any asset fails to download or the
    /// crust/ink enums no longer match a known case.
    func hydrated() async -> PizzaEntry? {
        guard let crust = CrustType(rawValue: crustType),
              let ink = StampInkColor(rawValue: inkColor) else {
            return nil
        }

        guard let venueData = try? await Self.downloadData(venuePhotoURL),
              let selfieData = try? await Self.downloadData(selfiePhotoURL),
              let stampData = try? await Self.downloadData(stampImageURL) else {
            return nil
        }

        let restaurant = Restaurant(
            name: restaurantName,
            address: "",
            city: "",
            coordinate: Coordinate(latitude: latitude, longitude: longitude)
        )

        return PizzaEntry(
            id: id,
            restaurant: restaurant,
            date: createdAt,
            rating: rating,
            crust: crust,
            inkColor: ink,
            atmospherePhotoData: venueData,
            actionPhotoData: selfieData,
            stampImageData: stampData
        )
    }

    private static func downloadData(_ url: URL) async throws -> Data {
        try await URLSession.shared.data(from: url).0
    }
}
