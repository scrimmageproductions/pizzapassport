import CoreImage.CIFilterBuiltins
import UIKit

/// Generates scannable QR codes for the story exporter's "link to profile"
/// badge.
enum QRCodeGenerator {
    static func image(from string: String, scale: CGFloat = 10) -> UIImage {
        let context = CIContext()
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(string.utf8)
        filter.correctionLevel = "M"

        guard let outputImage = filter.outputImage else { return UIImage() }

        let scaled = outputImage.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        guard let cgImage = context.createCGImage(scaled, from: scaled.extent) else {
            return UIImage()
        }
        return UIImage(cgImage: cgImage)
    }

    /// Generates a QR code pointing at a user's public web passport, e.g.
    /// `\(APIConfig.vercelWebDomain)/u/<username>` — the canonical link
    /// shared from story exports and profile share sheets.
    static func profileCode(for username: String, scale: CGFloat = 10) -> UIImage {
        image(from: APIConfig.profileURL(username: username).absoluteString, scale: scale)
    }
}
