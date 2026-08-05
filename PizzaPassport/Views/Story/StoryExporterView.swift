import SwiftUI
import UIKit

/// A Shareable Story Card: a 9:16 canvas with the two check-in photos, the
/// generated ink stamp, restaurant details, and a scannable QR code back to
/// the user's public profile. Rendered to a PNG via `ImageRenderer` for a
/// pixel-perfect, native export.
struct StoryExporterView: View {
    let entry: PizzaEntry

    @EnvironmentObject private var store: PassportStore
    @Environment(\.dismiss) private var dismiss

    @State private var palette: StoryPalette = .tomato
    @State private var layout: StoryLayout = .classic
    @State private var renderedImage: UIImage?
    @State private var isExporting = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                ScrollView {
                    storyCanvas
                        .frame(width: 320, height: 320 * 16 / 9)
                        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
                        .shadow(radius: 20)
                        .padding(.top, 12)
                }

                layoutSwitcher
                paletteSwitcher

                HStack(spacing: 16) {
                    if let renderedImage {
                        ShareLink(
                            item: Image(uiImage: renderedImage),
                            preview: SharePreview("My Pizza Passport Stamp", image: Image(uiImage: renderedImage))
                        ) {
                            Label("Share", systemImage: "square.and.arrow.up")
                        }
                        .buttonStyle(.pizzaPrimary)
                    }

                    Button {
                        exportToPhotos()
                    } label: {
                        Label(isExporting ? "Saving..." : "Save PNG", systemImage: "square.and.arrow.down")
                    }
                    .buttonStyle(.bordered)
                    .disabled(isExporting)
                }
                .padding(.horizontal)
                .padding(.bottom, 12)
            }
            .background(PizzaTheme.backgroundGradient.ignoresSafeArea())
            .navigationTitle("Share Your Stamp")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
            .task(id: "\(palette.rawValue)-\(layout.rawValue)") {
                renderedImage = renderCanvas()
            }
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - Canvas

    @ViewBuilder
    private var storyCanvas: some View {
        switch layout {
        case .classic: classicCanvas
        case .polaroid: polaroidCanvas
        }
    }

    private var classicCanvas: some View {
        ZStack {
            palette.backgroundGradient

            VStack(spacing: 18) {
                Text("PIZZA PASSPORT")
                    .font(.caption.weight(.heavy))
                    .tracking(3)
                    .foregroundStyle(palette.accent)
                    .padding(.top, 28)

                HStack(spacing: 10) {
                    photoCard(entry.atmospherePhotoData)
                    photoCard(entry.actionPhotoData)
                }
                .padding(.horizontal, 20)
                .frame(height: 200)

                stampBadge

                VStack(spacing: 4) {
                    Text(entry.restaurant.name)
                        .font(.title2.bold())
                    Text(entry.restaurant.city)
                        .font(.subheadline)
                        .opacity(0.8)
                    Text(entry.date.formatted(date: .abbreviated, time: .omitted))
                        .font(.caption)
                        .opacity(0.6)
                }
                .foregroundStyle(palette.text)
                .multilineTextAlignment(.center)

                PlateRatingBadge(rating: entry.rating)

                Spacer(minLength: 0)

                profileFooter
            }
        }
    }

    /// Frames the atmosphere photo as an instant-camera Polaroid — the
    /// generated ink stamp rides along on its corner — instead of the
    /// classic dual-photo grid.
    private var polaroidCanvas: some View {
        ZStack {
            palette.backgroundGradient

            VStack(spacing: 18) {
                Text("PIZZA PASSPORT")
                    .font(.caption.weight(.heavy))
                    .tracking(3)
                    .foregroundStyle(palette.accent)
                    .padding(.top, 28)

                PolaroidView(
                    photoData: entry.atmospherePhotoData,
                    restaurantName: entry.restaurant.name,
                    location: entry.restaurant.city,
                    date: entry.date,
                    stampImageData: entry.stampImageData,
                    seed: UInt64(bitPattern: Int64(entry.id.hashValue))
                )
                .frame(width: 220)

                PlateRatingBadge(rating: entry.rating)

                Spacer(minLength: 0)

                profileFooter
            }
        }
    }

    private var profileFooter: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("@\(store.profileHandle)")
                    .font(.caption.weight(.bold))
                Text(store.publicProfileURL.host ?? APIConfig.vercelWebDomain)
                    .font(.caption2)
                    .opacity(0.6)
            }
            Spacer()
            Image(uiImage: QRCodeGenerator.profileCode(for: store.profileHandle))
                .interpolation(.none)
                .resizable()
                .frame(width: 54, height: 54)
                .padding(4)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 6))
        }
        .foregroundStyle(palette.text)
        .padding(.horizontal, 24)
        .padding(.bottom, 24)
    }

    private var layoutSwitcher: some View {
        Picker("Layout", selection: $layout) {
            ForEach(StoryLayout.allCases) { l in
                Text(l.label).tag(l)
            }
        }
        .pickerStyle(.segmented)
        .padding(.horizontal)
    }

    private var stampBadge: some View {
        Group {
            if let uiImage = UIImage(data: entry.stampImageData) {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 100, height: 100)
            }
        }
    }

    private func photoCard(_ data: Data) -> some View {
        Group {
            if let uiImage = UIImage(data: data) {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFill()
            } else {
                Rectangle().fill(.gray.opacity(0.3))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(.white.opacity(0.2), lineWidth: 1)
        )
    }

    private var paletteSwitcher: some View {
        HStack(spacing: 14) {
            ForEach(StoryPalette.allCases) { p in
                Circle()
                    .fill(p.swatch)
                    .frame(width: 30, height: 30)
                    .overlay(Circle().stroke(.white, lineWidth: palette == p ? 2 : 0))
                    .onTapGesture { palette = p }
            }
        }
    }

    // MARK: - Export

    @MainActor
    private func renderCanvas() -> UIImage? {
        let renderer = ImageRenderer(content: storyCanvas.frame(width: 1080, height: 1920))
        renderer.scale = 1
        return renderer.uiImage
    }

    private func exportToPhotos() {
        isExporting = true
        Task {
            defer { isExporting = false }
            guard let image = renderCanvas() else { return }
            UIImageWriteToSavedPhotosAlbum(image, nil, nil, nil)
            renderedImage = image
        }
    }
}

/// Photo treatment for the story canvas: the classic dual-photo grid, or an
/// instant-camera Polaroid frame around the atmosphere photo.
enum StoryLayout: String, CaseIterable, Identifiable {
    case classic, polaroid

    var id: String { rawValue }

    var label: String {
        switch self {
        case .classic: "Classic"
        case .polaroid: "Polaroid"
        }
    }
}

/// Background/accent/text theme for the story canvas. Free users can switch
/// between all palettes — no VIP gating on customization.
enum StoryPalette: String, CaseIterable, Identifiable {
    case tomato, mozzarella, basil, charcoal

    var id: String { rawValue }

    var backgroundGradient: LinearGradient {
        switch self {
        case .tomato:
            LinearGradient(colors: [PizzaTheme.tomatoRed, PizzaTheme.charcoalBlack], startPoint: .top, endPoint: .bottom)
        case .mozzarella:
            LinearGradient(colors: [PizzaTheme.mozzarellaCream, PizzaTheme.crustGold], startPoint: .top, endPoint: .bottom)
        case .basil:
            LinearGradient(colors: [PizzaTheme.basilGreen, PizzaTheme.charcoalBlack], startPoint: .top, endPoint: .bottom)
        case .charcoal:
            LinearGradient(colors: [PizzaTheme.charcoalBlack, Color.black], startPoint: .top, endPoint: .bottom)
        }
    }

    var accent: Color {
        self == .mozzarella ? PizzaTheme.tomatoRed : PizzaTheme.crustGold
    }

    var text: Color {
        self == .mozzarella ? PizzaTheme.charcoalBlack : PizzaTheme.mozzarellaCream
    }

    var swatch: Color {
        switch self {
        case .tomato: PizzaTheme.tomatoRed
        case .mozzarella: PizzaTheme.mozzarellaCream
        case .basil: PizzaTheme.basilGreen
        case .charcoal: PizzaTheme.charcoalBlack
        }
    }
}

#Preview {
    StoryExporterView(entry: PizzaEntry.sampleEntries[0])
        .environmentObject(PassportStore())
}
