import SwiftUI

/// Half-plate-increment rating control (1.0–5.0) — Pizza Passport's answer
/// to a star rating. Tap a plate for a whole-number rating, or drag the
/// slider for half-Plate precision.
struct PlateRatingView: View {
    @Binding var rating: Double

    var body: some View {
        VStack(spacing: 10) {
            HStack(spacing: 6) {
                ForEach(1...5, id: \.self) { plate in
                    plateIcon(for: plate)
                        .onTapGesture { rating = Double(plate) }
                }
            }

            Text("\(rating, specifier: "%.1f") Plates")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(PizzaTheme.crustGold)

            Slider(value: $rating, in: 1...5, step: 0.5)
                .tint(PizzaTheme.tomatoRed)
        }
    }

    private enum FillLevel { case full, half, empty }

    private func fillLevel(for plate: Int) -> FillLevel {
        let value = rating - Double(plate - 1)
        if value >= 1 { return .full }
        if value >= 0.5 { return .half }
        return .empty
    }

    private func plateIcon(for plate: Int) -> some View {
        let fill = fillLevel(for: plate)
        let symbol = switch fill {
        case .full: "fork.knife.circle.fill"
        case .half: "fork.knife.circle"
        case .empty: "circle"
        }
        return Image(systemName: symbol)
            .font(.title2)
            .foregroundStyle(fill == .empty ? PizzaTheme.mozzarellaCream.opacity(0.2) : PizzaTheme.crustGold)
    }
}

#Preview {
    PlateRatingView(rating: .constant(3.5))
        .padding()
        .background(PizzaTheme.backgroundGradient)
}
