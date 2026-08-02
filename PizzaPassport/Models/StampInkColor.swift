import SwiftUI
import CoreImage

/// The ink color applied when a restaurant logo is converted into a rubber
/// stamp by `StampInkFilter`. Kept intentionally limited to three classic
/// stamp-pad tones for a cohesive, monochromatic passport look.
enum StampInkColor: String, CaseIterable, Identifiable, Codable, Sendable {
    case red = "Tomato Ink"
    case blue = "Passport Blue"
    case charcoal = "Charcoal Ink"

    var id: String { rawValue }

    /// SwiftUI-facing tint, used for badges, borders, and pickers.
    var tint: Color {
        switch self {
        case .red: PizzaTheme.tomatoRed
        case .blue: Color(red: 0.11, green: 0.24, blue: 0.52)
        case .charcoal: PizzaTheme.charcoalBlack
        }
    }

    /// Core Image-facing color, used by `StampInkFilter` when tinting the
    /// distressed stamp silhouette.
    var ciColor: CIColor {
        switch self {
        case .red: CIColor(red: 0.72, green: 0.11, blue: 0.11)
        case .blue: CIColor(red: 0.11, green: 0.24, blue: 0.52)
        case .charcoal: CIColor(red: 0.12, green: 0.12, blue: 0.13)
        }
    }
}
