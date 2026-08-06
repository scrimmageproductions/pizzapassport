import UIKit

/// What actually happened when a share function ran, so the calling view
/// can react correctly instead of assuming success:
/// - `.openedApp`: the target app was installed and launched with the
///   image handed off (Instagram Stories) or copied to the pasteboard
///   (Snapchat/X/Facebook, which have no official "receive an image via
///   URL scheme" API — see the per-platform notes below).
/// - `.openedWebFallback`: the app wasn't installed; a browser-based
///   share/intent URL was opened instead.
/// - `.needsSystemShareSheet`: neither an app nor a web fallback exists
///   (or opening one failed) — the caller should present
///   `UIActivityViewController` with the given items.
enum SocialShareResult {
    case openedApp
    case openedWebFallback
    case needsSystemShareSheet(items: [Any])
}

/// Native deep-linking + pasteboard wrapper for one-tap sharing to
/// Instagram Stories, Snapchat, X, and Facebook from `StoryExporterView`.
///
/// Deliberately UI-agnostic (no `present(_:)` calls) — it only decides
/// *what* should happen and returns that as a `SocialShareResult`; the
/// calling view owns presenting the system share sheet when asked to, via
/// `ActivityView` below.
///
/// Every URL scheme this checks with `canOpenURL`/`open` must be declared
/// under `LSApplicationQueriesSchemes` in Info.plist, or iOS treats the
/// app as never installed — already added: `instagram-stories`,
/// `snapchat`, `twitter`, `fb`.
@MainActor
enum SocialShareManager {
    /// Instagram's "Sharing to Stories" API requires a registered Facebook
    /// App ID as `source_application` for referral attribution — see
    /// https://developers.facebook.com/docs/instagram/sharing-to-stories.
    /// Sharing still works with a placeholder; only attribution is lost.
    /// Replace with a real ID before shipping.
    static var facebookAppID = "YOUR_FACEBOOK_APP_ID"

    static func isInstalled(_ scheme: String) -> Bool {
        guard let url = URL(string: "\(scheme)://") else { return false }
        return UIApplication.shared.canOpenURL(url)
    }

    // MARK: - Instagram Stories

    /// Instagram is the one platform here with an official, documented way
    /// to receive an image from another app: write it to the pasteboard
    /// under Instagram's own UTI keys, then launch `instagram-stories://`.
    static func shareToInstagramStories(image: UIImage, profileURL: URL) -> SocialShareResult {
        guard isInstalled("instagram-stories"),
              let imageData = image.pngData(),
              let shareURL = URL(string: "instagram-stories://share?source_application=\(facebookAppID)") else {
            return .needsSystemShareSheet(items: [image, profileURL])
        }

        let pasteboardItems: [String: Any] = [
            "com.instagram.sharedSticker.backgroundImage": imageData,
            "com.instagram.sharedSticker.contentURL": profileURL.absoluteString,
        ]
        UIPasteboard.general.setItems(
            [pasteboardItems],
            options: [.expirationDate: Date().addingTimeInterval(60 * 5)]
        )
        UIApplication.shared.open(shareURL)
        return .openedApp
    }

    // MARK: - Snapchat

    /// Snapchat's public integration path is the Creative Kit SDK
    /// (`SCSDKCreativeKit`), which isn't linked in this project — adding it
    /// means a new Swift Package dependency plus a Snapchat developer app
    /// registration, both outside what a source-only change can wire up.
    /// Until then, the most a bare URL scheme can do is *launch* Snapchat;
    /// it has no pasteboard contract like Instagram's, so this just copies
    /// the image (Snapchat's camera screen offers a "paste photo"
    /// affordance for a recently-copied image on current versions) and
    /// opens the app.
    static func shareToSnapchat(image: UIImage) -> SocialShareResult {
        guard isInstalled("snapchat"), let url = URL(string: "snapchat://") else {
            return .needsSystemShareSheet(items: [image])
        }
        UIPasteboard.general.image = image
        UIApplication.shared.open(url)
        return .openedApp
    }

    // MARK: - X (Twitter)

    /// X has no scheme for pre-attaching media either. Copies the image to
    /// the pasteboard (X's composer supports pasting a copied image) and
    /// prefers the native compose scheme when the app is installed,
    /// falling back to the same web intent URL the web app uses.
    static func shareToX(image: UIImage, restaurantName: String, profileURL: URL) -> SocialShareResult {
        UIPasteboard.general.image = image
        let text = "Just stamped my pizza passport at \(restaurantName)! 🍕 Check out my stamp profile: \(profileURL.absoluteString)"

        if isInstalled("twitter"), let appURL = twitterComposeURL(text: text) {
            UIApplication.shared.open(appURL)
            return .openedApp
        }
        if let webURL = twitterIntentURL(text: text) {
            UIApplication.shared.open(webURL)
            return .openedWebFallback
        }
        return .needsSystemShareSheet(items: [image, profileURL])
    }

    private static func twitterComposeURL(text: String) -> URL? {
        var components = URLComponents(string: "twitter://post")
        components?.queryItems = [URLQueryItem(name: "message", value: text)]
        return components?.url
    }

    private static func twitterIntentURL(text: String) -> URL? {
        var components = URLComponents(string: "https://x.com/intent/post")
        components?.queryItems = [URLQueryItem(name: "text", value: text)]
        return components?.url
    }

    // MARK: - Facebook

    /// Facebook's own Share Dialog SDK (`FBSDKShareKit`) is likewise not
    /// linked in this project; same pasteboard-copy + deep-link/web
    /// fallback shape as Snapchat and X.
    static func shareToFacebook(image: UIImage, profileURL: URL) -> SocialShareResult {
        UIPasteboard.general.image = image
        if isInstalled("fb"), let url = URL(string: "fb://") {
            UIApplication.shared.open(url)
            return .openedApp
        }
        if let webURL = facebookShareURL(profileURL: profileURL) {
            UIApplication.shared.open(webURL)
            return .openedWebFallback
        }
        return .needsSystemShareSheet(items: [image, profileURL])
    }

    private static func facebookShareURL(profileURL: URL) -> URL? {
        var components = URLComponents(string: "https://www.facebook.com/sharer/sharer.php")
        components?.queryItems = [URLQueryItem(name: "u", value: profileURL.absoluteString)]
        return components?.url
    }
}

/// `UIActivityViewController` bridged into SwiftUI, presented via
/// `.sheet(item:)` from `StoryExporterView` whenever a `SocialShareManager`
/// call comes back `.needsSystemShareSheet`.
struct ActivityView: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
