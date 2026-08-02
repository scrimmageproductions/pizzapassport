import Foundation

/// The style of crust for a given check-in. Purely a flavor/classification
/// tag — not used in any grading logic.
enum CrustType: String, CaseIterable, Identifiable, Codable, Sendable {
    case neapolitan = "Neapolitan"
    case nyStyle = "NY Style"
    case deepDish = "Deep Dish"
    case detroit = "Detroit"
    case tavern = "Tavern"
    case sicilian = "Sicilian"
    case grandma = "Grandma"
    case other = "Other"

    var id: String { rawValue }

    var emoji: String {
        switch self {
        case .neapolitan: "🇮🇹"
        case .nyStyle: "🗽"
        case .deepDish: "🥧"
        case .detroit: "🚗"
        case .tavern: "🍺"
        case .sicilian: "🔲"
        case .grandma: "👵"
        case .other: "🍕"
        }
    }
}
