import StoreKit

enum StoreError: Error {
    case failedVerification
}

/// Wraps StoreKit 2 for the single "Pizza Passport VIP" annual
/// subscription. Loads the product, drives the purchase flow, and keeps
/// `isVIP` in sync by listening for transaction updates.
@MainActor
final class StoreKitManager: ObservableObject {
    @Published private(set) var vipProduct: Product?
    @Published private(set) var isVIP = false
    @Published var purchaseError: String?

    private var updateListenerTask: Task<Void, Never>?

    init() {
        updateListenerTask = listenForTransactionUpdates()
        Task {
            await loadProducts()
            await refreshEntitlements()
        }
    }

    deinit {
        updateListenerTask?.cancel()
    }

    func loadProducts() async {
        do {
            let products = try await Product.products(for: [APIConfig.vipProductID])
            vipProduct = products.first
        } catch {
            purchaseError = "Couldn't load VIP Pass: \(error.localizedDescription)"
        }
    }

    func purchaseVIP() async {
        guard let product = vipProduct else { return }
        do {
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                let transaction = try checkVerified(verification)
                await transaction.finish()
                await refreshEntitlements()
            case .userCancelled, .pending:
                break
            @unknown default:
                break
            }
        } catch {
            purchaseError = error.localizedDescription
        }
    }

    func restorePurchases() async {
        try? await AppStore.sync()
        await refreshEntitlements()
    }

    private func refreshEntitlements() async {
        var vip = false
        for await result in Transaction.currentEntitlements {
            if let transaction = try? checkVerified(result), transaction.productID == APIConfig.vipProductID {
                vip = true
            }
        }
        isVIP = vip
    }

    private func listenForTransactionUpdates() -> Task<Void, Never> {
        Task.detached { [weak self] in
            for await result in Transaction.updates {
                guard let self else { continue }
                guard let transaction = try? await self.checkVerified(result) else { continue }
                await transaction.finish()
                await self.refreshEntitlements()
            }
        }
    }

    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified:
            throw StoreError.failedVerification
        case .verified(let safe):
            return safe
        }
    }
}
