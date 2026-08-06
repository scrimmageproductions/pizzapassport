import SwiftUI

/// The main digital passport: a paged grid of collected ink stamps, styled
/// like flipping through a physical passport booklet. Tapping a stamp opens
/// its entry detail, from which a Visual Story Card can be generated via
/// `StoryExporterView`.
struct PassportView: View {
    @EnvironmentObject private var store: PassportStore

    @State private var selectedEntry: PizzaEntry?
    @State private var showingCheckIn = false
    @State private var storyEntry: PizzaEntry?

    private let stampsPerPage = 6
    private let columns = [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())]

    private var pages: [[PizzaEntry]] {
        stride(from: 0, to: store.entries.count, by: stampsPerPage).map {
            Array(store.entries[$0..<min($0 + stampsPerPage, store.entries.count)])
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                PizzaTheme.backgroundGradient.ignoresSafeArea()

                VStack(spacing: 0) {
                    statsHeader

                    if store.entries.isEmpty {
                        emptyState
                    } else {
                        TabView {
                            ForEach(Array(pages.enumerated()), id: \.offset) { index, page in
                                passportPage(page, number: index + 1)
                                    .padding(.horizontal, 20)
                                    .padding(.bottom, 40)
                            }
                        }
                        .tabViewStyle(.page(indexDisplayMode: .always))
                        .indexViewStyle(.page(backgroundDisplayMode: .always))
                    }
                }
            }
            .navigationTitle("🍕 Pizza Passport")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingCheckIn = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.title2)
                            .foregroundStyle(PizzaTheme.tomatoRed)
                    }
                }
            }
        }
        .preferredColorScheme(.dark)
        .sheet(isPresented: $showingCheckIn) {
            CheckInView()
                .environmentObject(store)
        }
        .sheet(item: $selectedEntry) { entry in
            PassportDetailSheet(entry: entry) {
                selectedEntry = nil
                storyEntry = entry
            }
        }
        .fullScreenCover(item: $storyEntry) { entry in
            StoryExporterView(entry: entry)
                .environmentObject(store)
        }
    }

    private var statsHeader: some View {
        HStack(spacing: 24) {
            statTile(value: "\(store.stampCount)", label: "Stamps")
            statTile(value: String(format: "%.1f", store.averageRating), label: "Avg Plates")
            statTile(value: "\(max(pages.count, 1))", label: "Pages")
        }
        .padding(.vertical, 16)
    }

    private func statTile(value: String, label: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.title3.bold())
                .foregroundStyle(PizzaTheme.mozzarellaCream)
            Text(label.uppercased())
                .font(.caption2)
                .foregroundStyle(PizzaTheme.mozzarellaCream.opacity(0.6))
        }
        .frame(maxWidth: .infinity)
    }

    private func passportPage(_ entries: [PizzaEntry], number: Int) -> some View {
        VStack(spacing: 20) {
            HStack {
                Text("PAGE \(number)")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(PizzaTheme.crustGold)
                Spacer()
                Image(systemName: "airplane")
                    .foregroundStyle(PizzaTheme.mozzarellaCream.opacity(0.3))
            }

            LazyVGrid(columns: columns, spacing: 28) {
                ForEach(entries) { entry in
                    StampView(entry: entry)
                        .contentShape(Rectangle())
                        .onTapGesture { selectedEntry = entry }
                }
            }

            Spacer(minLength: 0)
        }
        .padding(20)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(Color.white.opacity(0.03))
                .overlay(
                    RoundedRectangle(cornerRadius: 24, style: .continuous)
                        .stroke(PizzaTheme.mozzarellaCream.opacity(0.08), lineWidth: 1)
                )
        )
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "fork.knife.circle")
                .font(.system(size: 64))
                .foregroundStyle(PizzaTheme.tomatoRed)
            Text("Your passport is empty")
                .font(PizzaTheme.Font.passportTitle)
                .foregroundStyle(PizzaTheme.mozzarellaCream)
            Text("Check in at your first pizzeria to earn a stamp.")
                .font(PizzaTheme.Font.body)
                .foregroundStyle(PizzaTheme.mozzarellaCream.opacity(0.7))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            Button("Check In") { showingCheckIn = true }
                .buttonStyle(.pizzaPrimary)
                .padding(.horizontal, 60)
                .padding(.top, 8)
            Spacer()
            Spacer()
        }
    }
}

#Preview {
    PassportView()
        .environmentObject(PassportStore())
}
