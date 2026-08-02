import CoreImage
import CoreImage.CIFilterBuiltins
import UIKit

/// Converts a remote restaurant logo into a distressed, realistic rubber
/// ink stamp — as if it had been physically pressed onto a passport page.
///
/// Pipeline: normalize → monochrome silhouette → contrast/posterize →
/// procedural grunge distress → ink tint → bleed/blur → random rotation.
struct StampInkFilter {
    private let context: CIContext

    init(context: CIContext = CIContext(options: [.useSoftwareRenderer: false])) {
        self.context = context
    }

    /// Generates a stamp image from a source logo.
    /// - Parameters:
    ///   - image: The raw logo artwork (ideally on a plain/white background).
    ///   - inkColor: Which ink tint to apply (red, blue, or charcoal).
    ///   - canvasSize: Output square canvas size, in pixels.
    ///   - seed: Deterministic seed so the same restaurant always renders
    ///     the same "random" rotation and distress pattern — pass a stable
    ///     hash of the restaurant's identifier.
    func makeStamp(
        from image: UIImage,
        inkColor: StampInkColor,
        canvasSize: CGFloat = 512,
        seed: UInt64
    ) -> UIImage? {
        guard let sourceCG = image.cgImage else { return nil }
        let source = CIImage(cgImage: sourceCG)

        let normalized = fit(source, into: canvasSize)
        let mono = monochrome(normalized)
        let posterized = highContrast(mono)
        let distressed = distress(posterized, canvasSize: canvasSize)
        let tinted = tint(distressed, color: inkColor)
        let bled = inkBleed(tinted)
        let rotated = randomRotate(bled, seed: seed)

        guard let cgOut = context.createCGImage(rotated, from: rotated.extent) else {
            return nil
        }
        return UIImage(cgImage: cgOut)
    }

    // MARK: - Pipeline steps

    /// Centers and scales the source artwork into a square canvas so every
    /// stamp — regardless of the source logo's aspect ratio — reads
    /// consistently on the passport page.
    private func fit(_ image: CIImage, into size: CGFloat) -> CIImage {
        let extent = image.extent
        guard extent.width > 0, extent.height > 0 else { return image }

        let scale = (size * 0.72) / max(extent.width, extent.height)
        let scaled = image.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        let dx = (size - scaled.extent.width) / 2 - scaled.extent.origin.x
        let dy = (size - scaled.extent.height) / 2 - scaled.extent.origin.y

        return scaled
            .transformed(by: CGAffineTransform(translationX: dx, y: dy))
            .cropped(to: CGRect(x: 0, y: 0, width: size, height: size))
    }

    private func monochrome(_ image: CIImage) -> CIImage {
        let mono = CIFilter.colorMonochrome()
        mono.inputImage = image
        mono.color = CIColor(red: 1, green: 1, blue: 1)
        mono.intensity = 1
        return mono.outputImage ?? image
    }

    /// Pushes contrast and posterizes so the logo reads as a hard-edged
    /// stamp silhouette rather than a soft photograph.
    private func highContrast(_ image: CIImage) -> CIImage {
        let controls = CIFilter.colorControls()
        controls.inputImage = image
        controls.contrast = 3.5
        controls.brightness = 0.05
        controls.saturation = 0

        let posterize = CIFilter.colorPosterize()
        posterize.inputImage = controls.outputImage
        posterize.levels = 3
        return posterize.outputImage ?? image
    }

    /// Multiplies the silhouette against a sharpened procedural noise mask
    /// so the ink only "takes" on part of the surface — the classic worn,
    /// hand-stamped rubber texture.
    private func distress(_ image: CIImage, canvasSize: CGFloat) -> CIImage {
        let random = CIFilter.randomGenerator()
        guard let rawNoise = random.outputImage else { return image }

        let noise = rawNoise
            .transformed(by: CGAffineTransform(scaleX: 6, y: 6))
            .cropped(to: CGRect(x: 0, y: 0, width: canvasSize, height: canvasSize))

        let noiseContrast = CIFilter.colorControls()
        noiseContrast.inputImage = noise
        noiseContrast.contrast = 6
        noiseContrast.brightness = -0.05
        let grungeMask = noiseContrast.outputImage ?? noise

        let multiply = CIFilter.multiplyCompositing()
        multiply.inputImage = image
        multiply.backgroundImage = grungeMask
        return (multiply.outputImage ?? image).cropped(to: image.extent)
    }

    /// Uses the (now-distressed) grayscale silhouette as an alpha mask for a
    /// flat ink color, producing a true monochromatic/duo-tone stamp.
    private func tint(_ image: CIImage, color: StampInkColor) -> CIImage {
        let inverted = image.applyingFilter("CIColorInvert")

        let maskToAlpha = CIFilter.maskToAlpha()
        maskToAlpha.inputImage = inverted
        guard let alphaMask = maskToAlpha.outputImage else { return image }

        let inkColorImage = CIImage(color: color.ciColor).cropped(to: alphaMask.extent)
        let blend = CIFilter.sourceInCompositing()
        blend.inputImage = inkColorImage
        blend.backgroundImage = alphaMask
        return (blend.outputImage ?? image).cropped(to: image.extent)
    }

    /// Simulates ink spreading slightly into the paper fibers: a touch of
    /// blur followed by a morphological dilation.
    private func inkBleed(_ image: CIImage) -> CIImage {
        let blur = CIFilter.gaussianBlur()
        blur.inputImage = image
        blur.radius = 0.6

        let morph = CIFilter.morphologyMaximum()
        morph.inputImage = blur.outputImage
        morph.radius = 0.4

        return (morph.outputImage ?? image).cropped(to: image.extent)
    }

    /// Applies a small random rotation, like a hand-pressed stamp that
    /// never lands perfectly straight.
    private func randomRotate(_ image: CIImage, seed: UInt64) -> CIImage {
        var generator = SeededGenerator(seed: seed)
        let degrees = Double.random(in: -9...9, using: &generator)
        let radians = degrees * .pi / 180

        let center = CGPoint(x: image.extent.midX, y: image.extent.midY)
        var transform = CGAffineTransform(translationX: center.x, y: center.y)
        transform = transform.rotated(by: radians)
        transform = transform.translatedBy(x: -center.x, y: -center.y)

        return image.transformed(by: transform)
    }
}

/// A tiny deterministic xorshift RNG so a given seed (e.g. a restaurant's
/// identifier) always reproduces the same "random" rotation and distress
/// look — stamps stay stable across app launches instead of re-rolling.
struct SeededGenerator: RandomNumberGenerator {
    private var state: UInt64

    init(seed: UInt64) {
        state = seed == 0 ? 0xDEAD_BEEF : seed
    }

    mutating func next() -> UInt64 {
        state ^= state << 13
        state ^= state >> 7
        state ^= state << 17
        return state
    }
}
