import SwiftUI

/// Root application entry point: owns the app-wide `PassportStore` and
/// `StoreKitManager`, and routes into `RootTabView`.
@main
struct PizzaPassportApp: App {
    @StateObject private var store = PassportStore()
    @StateObject private var storeManager = StoreKitManager()

    var body: some Scene {
        WindowGroup {
            RootTabView()
                .environmentObject(store)
                .environmentObject(storeManager)
        }
    }
}
