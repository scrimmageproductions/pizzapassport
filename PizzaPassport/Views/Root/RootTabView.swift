import SwiftUI

/// Top-level tab navigation: the Passport (stamp book), the VIP-gated
/// global Feed, and Settings (profile handle + VIP status).
struct RootTabView: View {
    @EnvironmentObject private var storeManager: StoreKitManager
    @State private var showingPaywall = false

    var body: some View {
        TabView {
            PassportView()
                .tabItem { Label("Passport", systemImage: "book.closed.fill") }

            LeaderboardView()
                .tabItem { Label("Leaderboard", systemImage: "trophy.fill") }

            GlobalMapView()
                .tabItem { Label("Map", systemImage: "globe.americas.fill") }

            VIPFeedView(showingPaywall: $showingPaywall)
                .tabItem { Label("Feed", systemImage: "globe") }

            SettingsView(showingPaywall: $showingPaywall)
                .tabItem { Label("Settings", systemImage: "gearshape.fill") }
        }
        .tint(PizzaTheme.tomatoRed)
        .sheet(isPresented: $showingPaywall) {
            PaywallView()
        }
    }
}

/// VIP-gated global feed. Free users see a locked preview that routes them
/// to `PaywallView`; VIP members see the (placeholder) live feed — wiring
/// this to a real backend is the natural next step once VIP status exists.
private struct VIPFeedView: View {
    @EnvironmentObject private var storeManager: StoreKitManager
    @Binding var showingPaywall: Bool

    var body: some View {
        NavigationStack {
            ZStack {
                PizzaTheme.backgroundGradient.ignoresSafeArea()

                if storeManager.isVIP {
                    ContentUnavailableView(
                        "Global Feed Coming Soon",
                        systemImage: "globe",
                        description: Text("VIP feed content will stream in here.")
                    )
                } else {
                    VStack(spacing: 16) {
                        Image(systemName: "lock.fill")
                            .font(.system(size: 40))
                            .foregroundStyle(PizzaTheme.crustGold)
                        Text("VIP Feature")
                            .font(.title2.bold())
                            .foregroundStyle(PizzaTheme.mozzarellaCream)
                        Text("Unlock the global feed with a Pizza Passport VIP Pass.")
                            .multilineTextAlignment(.center)
                            .foregroundStyle(PizzaTheme.mozzarellaCream.opacity(0.7))
                            .padding(.horizontal, 40)
                        Button("Get VIP") { showingPaywall = true }
                            .buttonStyle(.pizzaPrimary)
                            .padding(.horizontal, 60)
                    }
                }
            }
            .navigationTitle("Feed")
        }
        .preferredColorScheme(.dark)
    }
}

private struct SettingsView: View {
    @EnvironmentObject private var store: PassportStore
    @EnvironmentObject private var storeManager: StoreKitManager
    @Binding var showingPaywall: Bool

    var body: some View {
        NavigationStack {
            Form {
                Section("Profile") {
                    TextField("Passport Handle", text: $store.profileHandle)
                }
                Section("Membership") {
                    if storeManager.isVIP {
                        Label("VIP Pass Active", systemImage: "crown.fill")
                            .foregroundStyle(PizzaTheme.crustGold)
                    } else {
                        Button("Upgrade to VIP") { showingPaywall = true }
                    }
                }
                Section {
                    Text("Pizza Passport v1.0")
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Settings")
        }
        .preferredColorScheme(.dark)
    }
}

#Preview {
    RootTabView()
        .environmentObject(PassportStore())
        .environmentObject(StoreKitManager())
}
