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
        return finish(normalized, inkColor: inkColor, canvasSize: canvasSize, seed: seed)
    }

    /// Generates a stamp when no venue logo could be resolved: the full
    /// restaurant name arced along the top inner border, its city/country
    /// arced along the bottom, and a pizza glyph centered — then run
    /// through the exact same distress/tint/bleed/rotation finishing as a
    /// real logo, so it reads identically on the passport page. This is
    /// the tier-4 fallback `LogoFetchService` calls out to when it can't
    /// find any real artwork.
    /// - Parameters:
    ///   - restaurantName: Always rendered in full — never truncated to a
    ///     single initial. Long names shrink to fit the arc instead.
    ///   - location: City/country line arced along the bottom; pass an
    ///     empty string to omit it.
    func makeNameArchStamp(
        restaurantName: String,
        location: String,
        inkColor: StampInkColor,
        canvasSize: CGFloat = 512,
        seed: UInt64
    ) -> UIImage? {
        guard let artwork = ArcTextStampArtwork.render(
            restaurantName: restaurantName,
            location: location,
            size: canvasSize
        ), let artworkCG = artwork.cgImage else {
            return nil
        }
        let source = CIImage(cgImage: artworkCG)
        return finish(source, inkColor: inkColor, canvasSize: canvasSize, seed: seed)
    }

    /// Shared back half of the pipeline: monochrome -> contrast/posterize
    /// -> grunge distress -> ink tint -> bleed -> rotation. Both a fetched
    /// logo (already scaled into the canvas by `fit`) and generated arc-text
    /// artwork (already rendered at full canvas size) funnel through here.
    private func finish(
        _ normalized: CIImage,
        inkColor: StampInkColor,
        canvasSize: CGFloat,
        seed: UInt64
    ) -> UIImage? {
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

/// Renders the vector "no logo yet" stamp source: a full restaurant name
/// arced along the top inner border, an optional location line arced along
/// the bottom, and a centered icon — all drawn crisply with Core Graphics
/// so it feeds cleanly into `StampInkFilter`'s monochrome/distress pipeline.
enum ArcTextStampArtwork {
    static func render(restaurantName: String, location: String, size: CGFloat) -> UIImage? {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: size, height: size))
        return renderer.image { rendererContext in
            let context = rendererContext.cgContext
            UIColor.white.setFill()
            context.fill(CGRect(x: 0, y: 0, width: size, height: size))

            let center = CGPoint(x: size / 2, y: size / 2)
            let outerRadius = size * 0.46
            let textRadius = outerRadius * 0.82
            let maxArcLength = outerRadius * (.pi * 0.72)

            let nameFont = fittedFont(
                for: restaurantName,
                baseFont: .systemFont(ofSize: size * 0.075, weight: .bold),
                maxArcLength: maxArcLength,
                letterSpacingRatio: 0.12
            )
            drawTextOnArc(
                restaurantName.uppercased(),
                context: context,
                center: center,
                radius: textRadius,
                font: nameFont,
                letterSpacingRatio: 0.12,
                upsideDown: false
            )

            let trimmedLocation = location.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmedLocation.isEmpty {
                let locationFont = fittedFont(
                    for: trimmedLocation,
                    baseFont: .systemFont(ofSize: size * 0.05, weight: .semibold),
                    maxArcLength: maxArcLength,
                    letterSpacingRatio: 0.14
                )
                drawTextOnArc(
                    trimmedLocation.uppercased(),
                    context: context,
                    center: center,
                    radius: textRadius,
                    font: locationFont,
                    letterSpacingRatio: 0.14,
                    upsideDown: true
                )
            }

            if let icon = UIImage(systemName: "fork.knife.circle")?
                .withTintColor(.black, renderingMode: .alwaysOriginal) {
                let iconSize = size * 0.22
                icon.draw(in: CGRect(
                    x: center.x - iconSize / 2,
                    y: center.y - iconSize / 2,
                    width: iconSize,
                    height: iconSize
                ))
            }
        }
    }

    /// Shrinks a font until the string's total arc length fits within
    /// `maxArcLength`, so a long pizzeria name is always shown in full —
    /// just smaller — instead of ever being truncated to an initial.
    private static func fittedFont(
        for text: String,
        baseFont: UIFont,
        maxArcLength: CGFloat,
        letterSpacingRatio: CGFloat
    ) -> UIFont {
        guard !text.isEmpty else { return baseFont }

        func arcLength(of font: UIFont) -> CGFloat {
            let attributes: [NSAttributedString.Key: Any] = [.font: font]
            let widths = text.map { (String($0) as NSString).size(withAttributes: attributes).width }
            let spacing = font.pointSize * letterSpacingRatio
            return widths.reduce(0, +) + spacing * CGFloat(max(text.count - 1, 0))
        }

        var font = baseFont
        let minPointSize: CGFloat = baseFont.pointSize * 0.4
        while arcLength(of: font) > maxArcLength && font.pointSize > minPointSize {
            font = font.withSize(font.pointSize * 0.92)
        }
        return font
    }

    /// Draws `text` along a circular arc centered on `center`, one glyph at
    /// a time, using the standard "rotate half a glyph's angle, draw,
    /// rotate the other half" technique so widths never drift out of
    /// alignment. `upsideDown` both reverses the walking direction and
    /// flips each glyph 180° — required for text arced along the *bottom*
    /// of a circle to read right-side up and left-to-right, since the
    /// tangent direction there is mirrored relative to the top.
    private static func drawTextOnArc(
        _ text: String,
        context: CGContext,
        center: CGPoint,
        radius: CGFloat,
        font: UIFont,
        letterSpacingRatio: CGFloat,
        upsideDown: Bool
    ) {
        guard !text.isEmpty else { return }

        let attributes: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: UIColor.black]
        let letterSpacing = font.pointSize * letterSpacingRatio
        let chars = Array(text)
        let widths = chars.map { (String($0) as NSString).size(withAttributes: attributes).width }
        let totalArcLength = widths.reduce(0, +) + letterSpacing * CGFloat(max(chars.count - 1, 0))
        let totalAngle = totalArcLength / radius
        let direction: CGFloat = upsideDown ? -1 : 1

        context.saveGState()
        context.translateBy(x: center.x, y: center.y)
        context.rotate(by: -(totalAngle / 2) * direction)

        for (index, ch) in chars.enumerated() {
            let charAngle = (widths[index] / radius) * direction
            context.rotate(by: charAngle / 2)

            context.saveGState()
            context.translateBy(x: 0, y: -radius)
            if upsideDown {
                context.rotate(by: .pi)
            }
            let str = String(ch) as NSString
            let glyphSize = str.size(withAttributes: attributes)
            str.draw(at: CGPoint(x: -glyphSize.width / 2, y: -glyphSize.height / 2), withAttributes: attributes)
            context.restoreGState()

            var spacingAngle: CGFloat = 0
            if index < chars.count - 1 {
                spacingAngle = (letterSpacing / radius) * direction
            }
            context.rotate(by: charAngle / 2 + spacingAngle)
        }

        context.restoreGState()
    }
}
