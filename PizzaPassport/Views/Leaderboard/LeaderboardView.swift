import SwiftUI

/// Global rankings across every public Pizza Passport holder: tabbed
/// between total check-ins ("Top Pizza Explorers") and total points
/// ("Points Leaders"), both backed by `public.leaderboard` (see
/// `Resources/schema_gamification.sql`) so ranking is a cheap server-side
/// sort rather than something computed on-device.
struct LeaderboardView: View {
    private enum Tab {
        case explorers, points
    }

    @State private var tab: Tab = .explorers
    @State private var rows: [LeaderboardRow] = []
    @State private var isLoading = true
    @State private var loadError: String?

    private static let crowns = ["🥇", "🥈", "🥉"]

    private var sortedRows: [LeaderboardRow] {
        rows.sorted { lhs, rhs in
            tab == .explorers ? lhs.totalCheckins > rhs.totalCheckins : lhs.points > rhs.points
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                PizzaTheme.backgroundGradient.ignoresSafeArea()

                VStack(spacing: 16) {
                    Picker("Leaderboard", selection: $tab) {
                        Text("Top Explorers").tag(Tab.explorers)
                        Text("Points Leaders").tag(Tab.points)
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal)
                    .padding(.top, 12)

                    content
                }
            }
            .navigationTitle("Leaderboard")
            .navigationBarTitleDisplayMode(.inline)
        }
        .preferredColorScheme(.dark)
        .task { await load() }
    }

    @ViewBuilder
    private var content: some View {
        if isLoading {
            ProgressView("Loading leaderboard…")
                .tint(PizzaTheme.mozzarellaCream)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let loadError {
            ContentUnavailableView(
                "Couldn't Load Leaderboard",
                systemImage: "wifi.slash",
                description: Text(loadError)
            )
        } else if rows.isEmpty {
            ContentUnavailableView(
                "No Rankings Yet",
                systemImage: "trophy",
                description: Text("Be the first to check in and claim the crown.")
            )
        } else {
            List {
                ForEach(Array(sortedRows.enumerated()), id: \.element.id) { index, row in
                    LeaderboardRowView(rank: index + 1, row: row, crown: Self.crowns[safe: index], showsPoints: tab == .points)
                        .listRowBackground(Color.white.opacity(0.03))
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .refreshable { await load() }
        }
    }

    private func load() async {
        isLoading = true
        loadError = nil
        do {
            rows = try await SupabaseService.shared.fetchLeaderboard()
        } catch {
            loadError = error.localizedDescription
        }
        isLoading = false
    }
}

private struct LeaderboardRowView: View {
    let rank: Int
    let row: LeaderboardRow
    let crown: String?
    let showsPoints: Bool

    var body: some View {
        HStack(spacing: 12) {
            Text(crown ?? "#\(rank)")
                .font(.headline)
                .frame(width: 36)
                .foregroundStyle(crown != nil ? PizzaTheme.crustGold : PizzaTheme.mozzarellaCream.opacity(0.6))

            ZStack {
                Circle().fill(PizzaTheme.tomatoRed.opacity(0.25))
                if let avatarURL = row.avatarURL, let url = URL(string: avatarURL) {
                    AsyncImage(url: url) { image in
                        image.resizable().scaledToFill()
                    } placeholder: {
                        Text("🍕")
                    }
                } else {
                    Text("🍕")
                }
            }
            .frame(width: 36, height: 36)
            .clipShape(Circle())

            Text("@\(row.username)")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(PizzaTheme.mozzarellaCream)
                .lineLimit(1)

            Spacer()

            if showsPoints {
                Text("\(row.points) pts")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(PizzaTheme.crustGold)
            } else {
                Text("\(row.totalCheckins) slices")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(PizzaTheme.crustGold)
            }
        }
        .padding(.vertical, 4)
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

#Preview {
    LeaderboardView()
}
