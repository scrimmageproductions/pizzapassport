import SwiftUI
import UIKit

/// A single entry's detail view, redesigned as a tactile "Official Passport
/// Entry Booklet" page: cream parchment paper with a leather-bound border
/// and gold foil accent, tilted Polaroid-style photos, the entry's ink
/// stamp overlaid across them, and official-looking metadata badges — in
/// place of the flat dark card the app used to show here. Presented as a
/// sheet from `PassportView`.
struct PassportDetailSheet: View {
    let entry: PizzaEntry
    var onExportStory: () -> Void

    @Environment(\.dismiss) private var dismiss

    static let leatherBrown = Color(red: 0.173, green: 0.102, blue: 0.078) // #2C1A14
    static let parchment = Color(red: 0.992, green: 0.984, blue: 0.969) // #FDFBF7
    static let goldFoil = PizzaTheme.crustGold
    static let goldDeep = Color(red: 0.541, green: 0.376, blue: 0.082) // #8A6015

    var body: some View {
        NavigationStack {
            ScrollView {
                passportPage
                    .padding(16)
            }
            .background(PizzaTheme.backgroundGradient.ignoresSafeArea())
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(PizzaTheme.mozzarellaCream.opacity(0.6))
                    }
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - Passport page

    private var passportPage: some View {
        VStack(alignment: .leading, spacing: 20) {
            header
            photoFrames
            badges
            goldPlateRating
            actions
        }
        .padding(20)
        .background(pageBackground)
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .strokeBorder(Self.leatherBrown, lineWidth: 7)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 21, style: .continuous)
                .strokeBorder(Self.goldFoil.opacity(0.5), lineWidth: 1)
                .padding(7)
        )
        .shadow(color: .black.opacity(0.5), radius: 20, x: 0, y: 12)
    }

    /// Parchment fill + procedural grain/guilloché texture + a faint
    /// pizza-slice "seal" watermark, all drawn with `Canvas` so no image
    /// assets are needed.
    private var pageBackground: some View {
        ZStack {
            Self.parchment
            PassportSecurityPattern()
            GeometryReader { geo in
                Text("🍕")
                    .font(.system(size: min(geo.size.width, geo.size.height) * 0.9))
                    .opacity(0.045)
                    .rotationEffect(.degrees(-8))
                    .position(x: geo.size.width / 2, y: geo.size.height / 2)
            }
        }
    }

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 3) {
                Text("VISA / ENTRY PERMIT")
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                    .tracking(3)
                    .foregroundStyle(Self.leatherBrown.opacity(0.6))
                Text(entry.restaurant.name)
                    .font(.system(.title2, design: .serif).weight(.bold))
                    .foregroundStyle(Self.leatherBrown)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                if !locationLabel.isEmpty {
                    Label(locationLabel, systemImage: "mappin.circle.fill")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Self.leatherBrown.opacity(0.5))
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text("STAMP #\(stampNumber)")
                    .font(.system(size: 12, weight: .black, design: .monospaced))
                    .tracking(1.5)
                    .foregroundStyle(PizzaTheme.tomatoRed)
                Text(entry.date.formatted(date: .abbreviated, time: .omitted))
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Self.leatherBrown.opacity(0.4))
            }
        }
        .padding(.bottom, 12)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Self.leatherBrown.opacity(0.15)).frame(height: 1)
        }
    }

    private var locationLabel: String {
        entry.restaurant.city.isEmpty ? (entry.restaurant.country ?? "") : entry.restaurant.city
    }

    private var stampNumber: String {
        String(format: "%03d", abs(entry.id.hashValue) % 1000)
    }

    private var photoFrames: some View {
        ZStack(alignment: .bottomTrailing) {
            VStack(spacing: 16) {
                PolaroidView(
                    photoData: entry.atmospherePhotoData,
                    restaurantName: entry.restaurant.name,
                    location: "",
                    date: entry.date,
                    seed: seed,
                    tiltDegrees: -2,
                    captionOverride: "Venue",
                    hideStampFallback: true
                )
                PolaroidView(
                    photoData: entry.actionPhotoData,
                    restaurantName: entry.restaurant.name,
                    location: "",
                    date: entry.date,
                    seed: seed &+ 1,
                    tiltDegrees: 3,
                    captionOverride: "You + the Slice",
                    hideStampFallback: true
                )
            }
            .frame(maxWidth: .infinity)

            // One shared ink stamp overlapping both photos and the page
            // itself, rather than a per-photo placeholder.
            if let stampImage = UIImage(data: entry.stampImageData) {
                Image(uiImage: stampImage)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 96, height: 96)
                    .rotationEffect(.degrees(-12))
                    .opacity(0.92)
                    .blendMode(.multiply)
                    .offset(x: -4, y: 12)
            }
        }
        .padding(.bottom, 12)
    }

    private var seed: UInt64 {
        UInt64(bitPattern: Int64(entry.id.hashValue))
    }

    private var badges: some View {
        HStack(spacing: 8) {
            Text(entry.crust.rawValue.uppercased())
                .font(.system(size: 11, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Self.leatherBrown.opacity(0.7))
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Capsule().fill(Self.leatherBrown.opacity(0.06)))
                .overlay(Capsule().stroke(Self.leatherBrown.opacity(0.15), lineWidth: 1))

            Text("+\(entry.pointsEarned) PTS")
                .font(.system(size: 11, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(PizzaTheme.mozzarellaCream)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Capsule().fill(PizzaTheme.basilGreen))
        }
    }

    private var goldPlateRating: some View {
        HStack(spacing: 8) {
            HStack(spacing: 4) {
                ForEach(1...5, id: \.self) { plate in
                    GoldPlateSeal(level: plateFillLevel(entry.rating, plate))
                }
            }
            Text(entry.plateRatingText + " Plates")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Self.goldDeep)
        }
    }

    private func plateFillLevel(_ value: Double, _ plate: Int) -> GoldPlateSeal.Level {
        let diff = value - Double(plate - 1)
        if diff >= 1 { return .full }
        if diff >= 0.5 { return .half }
        return .empty
    }

    private var actions: some View {
        VStack(spacing: 10) {
            Button {
                onExportStory()
            } label: {
                Text("EXPORT PASSPORT STORY")
                    .font(.system(size: 14, weight: .black))
                    .tracking(1.2)
                    .foregroundStyle(PizzaTheme.mozzarellaCream)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .fill(PizzaTheme.tomatoRed)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .strokeBorder(PizzaTheme.mozzarellaCream.opacity(0.3), lineWidth: 2)
                            )
                    )
                    .rotationEffect(.degrees(-1))
            }
            .padding(.top, 4)
        }
        .overlay(alignment: .top) {
            Rectangle().fill(Self.leatherBrown.opacity(0.15)).frame(height: 1)
        }
    }
}

/// A small embossed gold "wax seal" medallion standing in for a plate icon
/// — a metallic gradient badge with a fork/knife glyph, since color emoji
/// ignore gradient/text-color tricks the way a system symbol doesn't.
private struct GoldPlateSeal: View {
    enum Level { case full, half, empty }
    let level: Level

    private static let goldGradient = LinearGradient(
        colors: [
            Color(red: 0.976, green: 0.890, blue: 0.627),
            PizzaTheme.crustGold,
            Color(red: 0.541, green: 0.376, blue: 0.082),
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    var body: some View {
        ZStack {
            Circle()
                .fill(level == .empty ? AnyShapeStyle(Color.black.opacity(0.06)) : AnyShapeStyle(Self.goldGradient))

            if level == .half {
                // A parchment-colored rectangle over the right half, clipped
                // to the outer circle below — reads as a half-shined coin
                // without relying on an unreliable arc-trim fill.
                Rectangle()
                    .fill(Color(red: 0.992, green: 0.984, blue: 0.969).opacity(0.85))
                    .frame(width: 11, height: 22)
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }

            Image(systemName: "fork.knife")
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(level == .empty ? Color.black.opacity(0.25) : Color(red: 0.29, green: 0.2, blue: 0.09))
        }
        .frame(width: 22, height: 22)
        .clipShape(Circle())
        .overlay(Circle().stroke(Color.black.opacity(0.15), lineWidth: 1))
    }
}

/// A faint, engraved-looking crosshatch — the "security lines" printed on
/// real visa/currency paper — drawn procedurally so no texture asset is
/// needed. Sits at very low opacity beneath the page's content.
private struct PassportSecurityPattern: View {
    var body: some View {
        Canvas { context, size in
            let spacing: CGFloat = 10
            let color = GraphicsContext.Shading.color(PassportDetailSheet.leatherBrown.opacity(0.05))

            var x: CGFloat = -size.height
            while x < size.width {
                var path = Path()
                path.move(to: CGPoint(x: x, y: 0))
                path.addLine(to: CGPoint(x: x + size.height, y: size.height))
                context.stroke(path, with: color, lineWidth: 0.6)
                x += spacing
            }

            x = 0
            while x < size.width + size.height {
                var path = Path()
                path.move(to: CGPoint(x: x, y: 0))
                path.addLine(to: CGPoint(x: x - size.height, y: size.height))
                context.stroke(path, with: color, lineWidth: 0.6)
                x += spacing
            }
        }
        .allowsHitTesting(false)
    }
}

#Preview {
    PassportDetailSheet(entry: PizzaEntry.sampleEntries[0], onExportStory: {})
}
