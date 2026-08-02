import SwiftUI
import StoreKit

/// StoreKit 2 paywall offering the $1.00/year "Pizza Passport VIP" tier,
/// which unlocks social feed publishing, global feed discovery, and cloud
/// backup. Free users keep unlimited local stamps and story exports.
struct PaywallView: View {
    @EnvironmentObject private var storeManager: StoreKitManager
    @Environment(\.dismiss) private var dismiss

    @State private var isPurchasing = false

    var body: some View {
        NavigationStack {
            ZStack {
                PizzaTheme.backgroundGradient.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 24) {
                        header
                        featureList
                        purchaseSection
                        footer
                    }
                    .padding(24)
                }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Not Now") { dismiss() }
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    private var header: some View {
        VStack(spacing: 12) {
            ZStack {
                Circle().fill(PizzaTheme.tomatoRed.opacity(0.2)).frame(width: 120, height: 120)
                Image(systemName: "crown.fill")
                    .font(.system(size: 48))
                    .foregroundStyle(PizzaTheme.crustGold)
            }
            Text("Pizza Passport VIP")
                .font(PizzaTheme.Font.passportTitle)
                .foregroundStyle(PizzaTheme.mozzarellaCream)
            Text("Go beyond your local passport.")
                .font(PizzaTheme.Font.body)
                .foregroundStyle(PizzaTheme.mozzarellaCream.opacity(0.7))
        }
    }

    private var featureList: some View {
        VStack(alignment: .leading, spacing: 16) {
            featureRow(icon: "globe", title: "Global Feed Discovery", detail: "Browse stamps from pizza lovers everywhere.")
            featureRow(icon: "person.2.fill", title: "Social Feed Posting", detail: "Publish your stamps directly to the community feed.")
            featureRow(icon: "icloud.fill", title: "Cloud Backup", detail: "Never lose a stamp — synced across your devices.")
        }
        .padding(20)
        .background(Color.white.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private func featureRow(icon: String, title: String, detail: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(PizzaTheme.tomatoRed)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.semibold))
                Text(detail).font(.caption).foregroundStyle(.secondary)
            }
        }
        .foregroundStyle(PizzaTheme.mozzarellaCream)
    }

    private var purchaseSection: some View {
        VStack(spacing: 12) {
            if storeManager.isVIP {
                Label("You're a VIP Pass holder!", systemImage: "checkmark.seal.fill")
                    .foregroundStyle(PizzaTheme.basilGreen)
                    .font(.headline)
            } else if let product = storeManager.vipProduct {
                Button {
                    Task {
                        isPurchasing = true
                        await storeManager.purchaseVIP()
                        isPurchasing = false
                        if storeManager.isVIP { dismiss() }
                    }
                } label: {
                    if isPurchasing {
                        ProgressView().tint(PizzaTheme.mozzarellaCream)
                    } else {
                        Text("Unlock VIP — \(product.displayPrice)/year")
                    }
                }
                .buttonStyle(.pizzaPrimary)
                .disabled(isPurchasing)

                Button("Restore Purchases") {
                    Task { await storeManager.restorePurchases() }
                }
                .font(.footnote)
                .foregroundStyle(PizzaTheme.mozzarellaCream.opacity(0.6))
            } else {
                ProgressView("Loading VIP Pass...")
                    .tint(PizzaTheme.mozzarellaCream)
                    .foregroundStyle(PizzaTheme.mozzarellaCream)
            }

            if let error = storeManager.purchaseError {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(PizzaTheme.tomatoRed)
            }
        }
    }

    private var footer: some View {
        Text("Just $1.00/year. Cancel anytime in Settings. Free members keep unlimited local stamps and story exports.")
            .font(.caption2)
            .foregroundStyle(PizzaTheme.mozzarellaCream.opacity(0.5))
            .multilineTextAlignment(.center)
    }
}

#Preview {
    PaywallView()
        .environmentObject(StoreKitManager())
}
