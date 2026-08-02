import SwiftUI
import UIKit

/// Renders a single collected ink stamp as it appears on a passport page:
/// the generated stamp artwork, the restaurant name, and its Plate rating.
struct StampView: View {
    let entry: PizzaEntry
    var size: CGFloat = 108

    var body: some View {
        VStack(spacing: 6) {
            ZStack {
                Circle()
                    .stroke(entry.inkColor.tint.opacity(0.4), style: StrokeStyle(lineWidth: 2, dash: [1, 3]))

                if let uiImage = UIImage(data: entry.stampImageData) {
                    Image(uiImage: uiImage)
                        .resizable()
                        .scaledToFit()
                        .padding(size * 0.14)
                } else {
                    Image(systemName: "fork.knife.circle")
                        .resizable()
                        .scaledToFit()
                        .foregroundStyle(entry.inkColor.tint)
                        .padding(size * 0.22)
                }
            }
            .frame(width: size, height: size)
            .background(PizzaTheme.mozzarellaCream.opacity(0.04))
            .clipShape(Circle())

            Text(entry.restaurant.name)
                .font(PizzaTheme.Font.stampLabel)
                .foregroundStyle(PizzaTheme.mozzarellaCream)
                .lineLimit(1)

            PlateRatingBadge(rating: entry.rating)
        }
    }
}

/// Small "🍽️ 4.5" badge used anywhere a compact rating readout is needed.
struct PlateRatingBadge: View {
    let rating: Double

    var body: some View {
        HStack(spacing: 3) {
            Image(systemName: "fork.knife.circle.fill")
                .font(.caption2)
            Text(String(format: "%.1f", rating))
                .font(.caption2.weight(.bold))
        }
        .foregroundStyle(PizzaTheme.crustGold)
    }
}

#Preview {
    StampView(entry: PizzaEntry.sampleEntries[0])
        .padding()
        .background(PizzaTheme.backgroundGradient)
}
