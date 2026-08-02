import SwiftUI

/// Centralized visual language for Pizza Passport: a moody, dark
/// passport-booklet aesthetic accented with pizzeria colors.
enum PizzaTheme {
    static let tomatoRed = Color(red: 0.80, green: 0.16, blue: 0.13)
    static let mozzarellaCream = Color(red: 0.97, green: 0.93, blue: 0.83)
    static let basilGreen = Color(red: 0.20, green: 0.45, blue: 0.27)
    static let charcoalBlack = Color(red: 0.08, green: 0.08, blue: 0.09)
    static let crustGold = Color(red: 0.82, green: 0.64, blue: 0.31)

    static let backgroundGradient = LinearGradient(
        colors: [charcoalBlack, Color(red: 0.14, green: 0.10, blue: 0.10)],
        startPoint: .top,
        endPoint: .bottom
    )

    enum Font {
        static let passportTitle = SwiftUI.Font.system(.largeTitle, design: .serif).weight(.bold)
        static let stampLabel = SwiftUI.Font.system(.caption, design: .rounded).weight(.semibold)
        static let body = SwiftUI.Font.system(.body, design: .rounded)
    }
}

/// Primary call-to-action button style shared across every screen.
struct PizzaPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(PizzaTheme.Font.body.weight(.bold))
            .foregroundStyle(PizzaTheme.mozzarellaCream)
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(PizzaTheme.tomatoRed.gradient)
            )
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: configuration.isPressed)
    }
}

extension ButtonStyle where Self == PizzaPrimaryButtonStyle {
    static var pizzaPrimary: PizzaPrimaryButtonStyle { PizzaPrimaryButtonStyle() }
}
