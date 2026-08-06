import Foundation
import UIKit

/// A single check-in ("Slice") in the user's passport: a restaurant, a
/// 1.0–5.0 Plate rating, the two required photos, and the generated ink
/// stamp produced for that visit.
struct PizzaEntry: Identifiable, Codable, Hashable, Sendable {
    var id: UUID
    var restaurant: Restaurant
    var date: Date
    /// 1.0...5.0 in 0.5 increments — displayed as "Plates".
    var rating: Double
    var crust: CrustType
    var notes: String
    var inkColor: StampInkColor
    var atmospherePhotoData: Data
    var actionPhotoData: Data
    /// Optional third check-in photo of the pizzeria's menu — never
    /// required, but worth a points bonus (see `Self.menuPhotoBonusPoints`).
    var menuPhotoData: Data?
    /// PNG data of the stamp produced by `StampInkFilter`.
    var stampImageData: Data
    /// +100 base, +100 more if `menuPhotoData` is set — computed
    /// automatically at init unless a remote value is passed in explicitly
    /// (e.g. when hydrating a `RemoteEntry` that already has one).
    var pointsEarned: Int
    /// Set only via the `submit_owner_reply` RPC (see
    /// schema_merchants.sql) — never written directly from this app.
    var ownerReply: String?
    var ownerRepliedAt: Date?
    /// True if this venue has a verified `merchants` row at check-in
    /// hydration time — see `SupabaseService.fetchVerifiedPlaceIDs`.
    var isVerifiedVenue: Bool

    /// Points awarded for a base check-in (venue + selfie photo) — mirrors
    /// the `entries.points_earned` default in schema.sql.
    static let baseCheckInPoints = 100
    /// Extra points for the optional menu photo.
    static let menuPhotoBonusPoints = 100

    init(
        id: UUID = UUID(),
        restaurant: Restaurant,
        date: Date = .now,
        rating: Double,
        crust: CrustType,
        notes: String = "",
        inkColor: StampInkColor,
        atmospherePhotoData: Data,
        actionPhotoData: Data,
        menuPhotoData: Data? = nil,
        stampImageData: Data,
        pointsEarned: Int? = nil,
        ownerReply: String? = nil,
        ownerRepliedAt: Date? = nil,
        isVerifiedVenue: Bool = false
    ) {
        self.id = id
        self.restaurant = restaurant
        self.date = date
        self.rating = rating
        self.crust = crust
        self.notes = notes
        self.inkColor = inkColor
        self.atmospherePhotoData = atmospherePhotoData
        self.actionPhotoData = actionPhotoData
        self.menuPhotoData = menuPhotoData
        self.stampImageData = stampImageData
        self.pointsEarned = pointsEarned ?? Self.baseCheckInPoints + (menuPhotoData != nil ? Self.menuPhotoBonusPoints : 0)
        self.ownerReply = ownerReply
        self.ownerRepliedAt = ownerRepliedAt
        self.isVerifiedVenue = isVerifiedVenue
    }

    var plateRatingText: String { String(format: "%.1f", rating) }
}

extension PizzaEntry {
    /// Demo data shown on first launch so the passport and story exporter
    /// have something to render before the user's first real check-in.
    static let sampleEntries: [PizzaEntry] = {
        let placeholder = UIImage(systemName: "fork.knife.circle.fill")?
            .withTintColor(.systemOrange, renderingMode: .alwaysOriginal)
            .pngData() ?? Data()

        return [
            PizzaEntry(
                restaurant: Restaurant(
                    name: "Lucali",
                    address: "575 Henry St",
                    city: "Brooklyn, NY",
                    coordinate: Coordinate(latitude: 40.6816, longitude: -73.9977)
                ),
                date: .now.addingTimeInterval(-86_400 * 12),
                rating: 5.0,
                crust: .nyStyle,
                notes: "Charred crust, no-frills, worth the wait.",
                inkColor: .red,
                atmospherePhotoData: placeholder,
                actionPhotoData: placeholder,
                stampImageData: placeholder
            ),
            PizzaEntry(
                restaurant: Restaurant(
                    name: "Pequod's Pizza",
                    address: "2207 N Clybourn Ave",
                    city: "Chicago, IL",
                    coordinate: Coordinate(latitude: 41.9227, longitude: -87.6567)
                ),
                date: .now.addingTimeInterval(-86_400 * 40),
                rating: 4.5,
                crust: .deepDish,
                notes: "Caramelized cheese crust is unreal.",
                inkColor: .charcoal,
                atmospherePhotoData: placeholder,
                actionPhotoData: placeholder,
                stampImageData: placeholder
            ),
            PizzaEntry(
                restaurant: Restaurant(
                    name: "Buddy's Pizza",
                    address: "17125 Conant St",
                    city: "Detroit, MI",
                    coordinate: Coordinate(latitude: 42.4147, longitude: -83.0965)
                ),
                date: .now.addingTimeInterval(-86_400 * 70),
                rating: 4.0,
                crust: .detroit,
                notes: "Crispy caramelized edges, red sauce on top.",
                inkColor: .blue,
                atmospherePhotoData: placeholder,
                actionPhotoData: placeholder,
                stampImageData: placeholder
            )
        ]
    }()
}
