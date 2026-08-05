import SwiftUI
import PhotosUI
import MapKit
import UIKit

/// Multi-step "Slice" logging flow: find the restaurant, capture the two
/// required photos, rate the visit, then preview and save the generated
/// ink stamp.
struct CheckInView: View {
    @EnvironmentObject private var store: PassportStore
    @Environment(\.dismiss) private var dismiss

    @StateObject private var placeSearch = PlaceSearchService()
    @StateObject private var locationService = LocationService()

    @State private var step: Step = .place
    @State private var searchText = ""
    @State private var selectedRestaurant: Restaurant?

    @State private var atmosphereItem: PhotosPickerItem?
    @State private var actionItem: PhotosPickerItem?
    @State private var atmosphereData: Data?
    @State private var actionData: Data?

    @State private var rating: Double = 4.0
    @State private var crust: CrustType = .nyStyle
    @State private var inkColor: StampInkColor = .red
    @State private var notes = ""

    @State private var generatedStamp: UIImage?
    @State private var isGeneratingStamp = false
    @State private var usePolaroidPreview = false

    private enum Step: Int, CaseIterable {
        case place, photos, details, review
    }

    var body: some View {
        NavigationStack {
            ZStack {
                PizzaTheme.backgroundGradient.ignoresSafeArea()

                VStack {
                    progressBar

                    ScrollView {
                        Group {
                            switch step {
                            case .place: placeStep
                            case .photos: photosStep
                            case .details: detailsStep
                            case .review: reviewStep
                            }
                        }
                        .padding(.vertical, 12)
                    }

                    navigationButtons
                }
                .padding()
            }
            .navigationTitle("New Check-In")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .preferredColorScheme(.dark)
        .onAppear { locationService.requestPermission() }
        .task(id: atmosphereItem) {
            atmosphereData = await loadImageData(atmosphereItem)
        }
        .task(id: actionItem) {
            actionData = await loadImageData(actionItem)
        }
    }

    private func loadImageData(_ item: PhotosPickerItem?) async -> Data? {
        guard let item else { return nil }
        return try? await item.loadTransferable(type: Data.self)
    }

    // MARK: - Progress

    private var progressBar: some View {
        HStack(spacing: 8) {
            ForEach(Step.allCases, id: \.self) { s in
                Capsule()
                    .fill(s.rawValue <= step.rawValue ? PizzaTheme.tomatoRed : PizzaTheme.mozzarellaCream.opacity(0.15))
                    .frame(height: 4)
            }
        }
        .padding(.top, 8)
    }

    // MARK: - Step 1: Place

    private var placeStep: some View {
        VStack(alignment: .leading, spacing: 12) {
            stepTitle("Where's the pizza?")

            TextField("Search restaurants", text: $searchText)
                .textFieldStyle(.roundedBorder)
                .onChange(of: searchText) { _, newValue in
                    placeSearch.updateQuery(newValue)
                }

            ForEach(placeSearch.results, id: \.self) { completion in
                Button {
                    Task {
                        if let restaurant = await placeSearch.resolve(completion) {
                            selectedRestaurant = restaurant
                            searchText = restaurant.name
                        }
                    }
                } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(completion.title).foregroundStyle(PizzaTheme.mozzarellaCream)
                        Text(completion.subtitle).font(.caption).foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.vertical, 4)
                Divider().overlay(PizzaTheme.mozzarellaCream.opacity(0.1))
            }

            if let selectedRestaurant {
                HStack {
                    Image(systemName: "checkmark.seal.fill").foregroundStyle(PizzaTheme.basilGreen)
                    Text("Selected: \(selectedRestaurant.name)")
                        .foregroundStyle(PizzaTheme.mozzarellaCream)
                }
                .padding(.top, 8)
            }
        }
    }

    // MARK: - Step 2: Photos

    private var photosStep: some View {
        VStack(spacing: 20) {
            stepTitle("Capture the moment")
            photoSlot(title: "Venue / Atmosphere", data: atmosphereData, item: $atmosphereItem)
            photoSlot(title: "You + the Slice", data: actionData, item: $actionItem)
        }
    }

    private func photoSlot(title: String, data: Data?, item: Binding<PhotosPickerItem?>) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title.uppercased())
                .font(.caption.weight(.semibold))
                .foregroundStyle(PizzaTheme.mozzarellaCream.opacity(0.7))

            PhotosPicker(selection: item, matching: .images) {
                ZStack {
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(Color.white.opacity(0.05))

                    if let data, let uiImage = UIImage(data: data) {
                        Image(uiImage: uiImage)
                            .resizable()
                            .scaledToFill()
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    } else {
                        VStack(spacing: 8) {
                            Image(systemName: "camera.fill").font(.title)
                            Text("Add Photo").font(.caption)
                        }
                        .foregroundStyle(PizzaTheme.mozzarellaCream.opacity(0.6))
                    }
                }
                .frame(height: 180)
                .clipped()
            }
        }
    }

    // MARK: - Step 3: Details

    private var detailsStep: some View {
        VStack(alignment: .leading, spacing: 20) {
            stepTitle("Rate the slice")

            PlateRatingView(rating: $rating)

            VStack(alignment: .leading, spacing: 8) {
                sectionLabel("Crust Style")
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack {
                        ForEach(CrustType.allCases) { c in
                            Button {
                                crust = c
                            } label: {
                                Text("\(c.emoji) \(c.rawValue)")
                                    .font(.subheadline)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 8)
                                    .background(c == crust ? PizzaTheme.tomatoRed : Color.white.opacity(0.08))
                                    .foregroundStyle(PizzaTheme.mozzarellaCream)
                                    .clipShape(Capsule())
                            }
                        }
                    }
                }
            }

            VStack(alignment: .leading, spacing: 8) {
                sectionLabel("Ink Color")
                HStack {
                    ForEach(StampInkColor.allCases) { c in
                        Circle()
                            .fill(c.tint)
                            .frame(width: 32, height: 32)
                            .overlay(Circle().stroke(PizzaTheme.mozzarellaCream, lineWidth: c == inkColor ? 2 : 0))
                            .onTapGesture { inkColor = c }
                    }
                }
            }

            VStack(alignment: .leading, spacing: 8) {
                sectionLabel("Notes")
                TextEditor(text: $notes)
                    .frame(height: 100)
                    .scrollContentBackground(.hidden)
                    .padding(8)
                    .background(Color.white.opacity(0.05))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .foregroundStyle(PizzaTheme.mozzarellaCream)
            }
        }
    }

    // MARK: - Step 4: Review

    private var reviewStep: some View {
        VStack(spacing: 20) {
            stepTitle("Your Stamp")

            ZStack {
                Circle().fill(Color.white.opacity(0.05)).frame(width: 160, height: 160)

                if isGeneratingStamp {
                    ProgressView().tint(PizzaTheme.mozzarellaCream)
                } else if let generatedStamp {
                    Image(uiImage: generatedStamp)
                        .resizable()
                        .scaledToFit()
                        .padding(20)
                        .frame(width: 160, height: 160)
                }
            }
            .task { await generateStampIfNeeded() }

            if let selectedRestaurant {
                Text(selectedRestaurant.name)
                    .font(.headline)
                    .foregroundStyle(PizzaTheme.mozzarellaCream)
            }
            PlateRatingBadge(rating: rating)

            polaroidPreviewToggle

            if usePolaroidPreview, let atmosphereData, let selectedRestaurant {
                PolaroidView(
                    photoData: atmosphereData,
                    restaurantName: selectedRestaurant.name,
                    location: selectedRestaurant.city,
                    date: .now,
                    stampImageData: generatedStamp?.pngData(),
                    seed: UInt64(bitPattern: Int64(selectedRestaurant.id.hashValue))
                )
                .frame(width: 220)
                .padding(.top, 4)
            }
        }
    }

    private var polaroidPreviewToggle: some View {
        Button {
            usePolaroidPreview.toggle()
        } label: {
            Label(
                usePolaroidPreview ? "Polaroid Preview On" : "Preview as Polaroid",
                systemImage: usePolaroidPreview ? "checkmark.circle.fill" : "photo.on.rectangle.angled"
            )
            .font(.caption.weight(.semibold))
        }
        .buttonStyle(.bordered)
        .tint(PizzaTheme.crustGold)
    }

    private func generateStampIfNeeded() async {
        guard generatedStamp == nil, let restaurant = selectedRestaurant else { return }
        isGeneratingStamp = true
        defer { isGeneratingStamp = false }

        let seed = UInt64(bitPattern: Int64(restaurant.id.hashValue))
        if let logo = try? await LogoFetchService().fetchLogo(for: restaurant) {
            generatedStamp = StampInkFilter().makeStamp(from: logo, inkColor: inkColor, seed: seed)
        } else {
            // All three real-artwork tiers (Places photo, Clearbit/Brandfetch,
            // favicon) came up empty — stamp the full restaurant name instead
            // of ever truncating to a single initial.
            generatedStamp = StampInkFilter().makeNameArchStamp(
                restaurantName: restaurant.name,
                location: restaurant.city,
                inkColor: inkColor,
                seed: seed
            )
        }
    }

    // MARK: - Navigation

    private var navigationButtons: some View {
        HStack {
            if step != .place {
                Button("Back") {
                    step = Step(rawValue: step.rawValue - 1) ?? .place
                }
                .buttonStyle(.bordered)
            }

            Spacer()

            Button(step == .review ? "Save to Passport" : "Next") {
                if step == .review {
                    saveEntry()
                } else {
                    step = Step(rawValue: step.rawValue + 1) ?? .review
                }
            }
            .buttonStyle(.pizzaPrimary)
            .disabled(!canAdvance)
        }
        .padding(.top, 8)
    }

    private var canAdvance: Bool {
        switch step {
        case .place: selectedRestaurant != nil
        case .photos: atmosphereData != nil && actionData != nil
        case .details: true
        case .review: generatedStamp != nil
        }
    }

    private func saveEntry() {
        guard let restaurant = selectedRestaurant,
              let atmosphereData, let actionData,
              let generatedStamp, let stampData = generatedStamp.pngData() else { return }

        let entry = PizzaEntry(
            restaurant: restaurant,
            rating: rating,
            crust: crust,
            notes: notes,
            inkColor: inkColor,
            atmospherePhotoData: atmosphereData,
            actionPhotoData: actionData,
            stampImageData: stampData
        )
        store.addEntry(entry)
        dismiss()
    }

    // MARK: - Helpers

    private func stepTitle(_ text: String) -> some View {
        Text(text)
            .font(PizzaTheme.Font.passportTitle.weight(.semibold))
            .foregroundStyle(PizzaTheme.mozzarellaCream)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .foregroundStyle(PizzaTheme.mozzarellaCream.opacity(0.7))
    }
}

#Preview {
    CheckInView()
        .environmentObject(PassportStore())
}
