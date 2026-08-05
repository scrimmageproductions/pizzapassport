import SwiftUI
import UIKit

/// An authentic-feeling instant-camera "Polaroid" frame around a check-in's
/// venue/atmosphere photo: off-white paper border with procedural grain,
/// an optional vintage-filtered photo area, a handwritten-style caption
/// banner, and the check-in's distressed ink stamp overlaid at a jaunty
/// angle — like it was pulled out of the camera and stamped by hand.
struct PolaroidView: View {
    let photoData: Data
    let restaurantName: String
    let location: String
    let date: Date
    var stampImageData: Data? = nil
    var vintageFilter: Bool = true
    var stampRotation: Double = -12
    /// Stable per-entry seed so the paper grain and natural tilt don't
    /// re-roll on every re-render — pass a hash of the entry's identifier.
    var seed: UInt64 = 0

    var body: some View {
        VStack(spacing: 0) {
            photoArea
                .aspectRatio(1, contentMode: .fit)
                .padding(14)

            captionBanner
                .padding(.horizontal, 14)
                .padding(.top, 10)
                .padding(.bottom, 20)
        }
        .background(
            RoundedRectangle(cornerRadius: 4, style: .continuous)
                .fill(Color(red: 0.98, green: 0.97, blue: 0.94))
        )
        .overlay(
            GrainOverlay(seed: seed)
                .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
                .opacity(0.5)
                .allowsHitTesting(false)
        )
        .shadow(color: .black.opacity(0.35), radius: 14, x: 0, y: 10)
        .rotationEffect(.degrees(naturalTilt))
    }

    /// A tiny, stable "it was tossed onto the page" tilt for the whole
    /// card — independent of `stampRotation`, which angles just the stamp.
    private var naturalTilt: Double {
        var generator = SeededGenerator(seed: seed == 0 ? 1 : seed)
        return Double(generator.next() % 5) - 2
    }

    private var photoArea: some View {
        ZStack(alignment: .topTrailing) {
            Group {
                if let uiImage = UIImage(data: photoData) {
                    Image(uiImage: uiImage)
                        .resizable()
                        .scaledToFill()
                } else {
                    Rectangle().fill(Color.gray.opacity(0.3))
                }
            }
            .modifier(VintageFilterModifier(enabled: vintageFilter))
            .clipped()

            if let stampImageData, let stampImage = UIImage(data: stampImageData) {
                Image(uiImage: stampImage)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 84, height: 84)
                    .rotationEffect(.degrees(stampRotation))
                    .opacity(0.92)
                    .padding(10)
            } else {
                CheckedInStampBadge(date: date, rotation: stampRotation)
                    .padding(10)
            }
        }
        .background(Color.black.opacity(0.05))
    }

    private var captionBanner: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(restaurantName)
                // "Bradley Hand" ships free with iOS — a genuine
                // handwritten-marker look with zero bundled font assets.
                // Swap in a downloaded Caveat.ttf via Info.plist's
                // UIAppFonts for pixel-exact parity with the web app.
                .font(.custom("BradleyHandITCTT-Bold", size: 26))
                .foregroundStyle(Color(red: 0.15, green: 0.13, blue: 0.12))
                .lineLimit(1)
                .minimumScaleFactor(0.6)

            if !location.isEmpty {
                Text(location.uppercased())
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(1.2)
                    .foregroundStyle(.black.opacity(0.5))
            }

            Text(date.formatted(date: .abbreviated, time: .omitted))
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.black.opacity(0.4))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Subtle warm-toned, lowered-contrast wash that reads as an aged instant
/// photo rather than a crisp modern shot.
private struct VintageFilterModifier: ViewModifier {
    let enabled: Bool

    func body(content: Content) -> some View {
        if enabled {
            content
                .contrast(0.92)
                .saturation(1.08)
                .colorMultiply(Color(red: 1.0, green: 0.93, blue: 0.8))
                .overlay(Color(red: 0.98, green: 0.85, blue: 0.6).opacity(0.08))
        } else {
            content
        }
    }
}

/// A small distressed-looking "CHECKED IN • <DATE>" badge used when a
/// check-in has no generated ink stamp yet (e.g. mid-flow preview).
private struct CheckedInStampBadge: View {
    let date: Date
    var rotation: Double = -12

    var body: some View {
        VStack(spacing: 1) {
            Text("CHECKED IN")
                .font(.system(size: 10, weight: .black))
                .tracking(1)
            Text(date.formatted(date: .abbreviated, time: .omitted))
                .font(.system(size: 8, weight: .bold))
        }
        .foregroundStyle(PizzaTheme.tomatoRed.opacity(0.85))
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .overlay(
            RoundedRectangle(cornerRadius: 4)
                .stroke(PizzaTheme.tomatoRed.opacity(0.7), lineWidth: 1.5)
        )
        .rotationEffect(.degrees(rotation))
    }
}

/// Lightweight procedural paper-grain texture, drawn from a seeded RNG so
/// it's stable per-card instead of flickering on every re-render.
private struct GrainOverlay: View {
    let seed: UInt64

    var body: some View {
        Canvas { context, size in
            var generator = SeededGenerator(seed: seed == 0 ? 42 : seed)
            for _ in 0..<140 {
                let x = Double(generator.next() % 1000) / 1000 * size.width
                let y = Double(generator.next() % 1000) / 1000 * size.height
                let diameter = Double(generator.next() % 100) / 100 * 0.8 + 0.2
                let opacity = Double(generator.next() % 100) / 100 * 0.06
                context.fill(
                    Path(ellipseIn: CGRect(x: x, y: y, width: diameter, height: diameter)),
                    with: .color(.black.opacity(opacity))
                )
            }
        }
    }
}

#Preview {
    PolaroidView(
        photoData: Data(),
        restaurantName: "Lucali",
        location: "Brooklyn, NY",
        date: .now,
        seed: 7
    )
    .frame(width: 260)
    .padding()
    .background(PizzaTheme.backgroundGradient)
}
