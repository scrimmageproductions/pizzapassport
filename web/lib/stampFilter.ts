import { INK_COLORS, type InkColor } from "./constants";

export interface StampOptions {
  /** Output canvas size in pixels (square). Defaults to 512. */
  size?: number;
  inkColor?: InkColor;
  /** Deterministic seed for distress + rotation — pass a stable hash (see
   * `seedFromString`) so the same restaurant always renders the same look. */
  seed?: number;
}

/** Deterministic string -> 32-bit seed, so a restaurant name/id always
 * distresses and rotates the same way instead of re-rolling on every visit. */
export function seedFromString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

/** Small, fast seeded PRNG (mulberry32) — good enough for visual distress,
 * not for anything security-sensitive. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Lightweight seeded value-noise (a Perlin-style lattice noise with
 * smoothstep interpolation) used to build the grunge/distress mask. */
function makeValueNoise(seed: number) {
  const rand = mulberry32(seed);
  const gridSize = 32;
  const lattice = Array.from({ length: gridSize * gridSize }, () => rand());

  const at = (x: number, y: number) => {
    const xi = ((x % gridSize) + gridSize) % gridSize;
    const yi = ((y % gridSize) + gridSize) % gridSize;
    return lattice[yi * gridSize + xi];
  };

  const smooth = (t: number) => t * t * (3 - 2 * t);

  return (u: number, v: number) => {
    const x = u * gridSize;
    const y = v * gridSize;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = smooth(x - x0);
    const ty = smooth(y - y0);

    const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
    const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
    return top * (1 - ty) + bottom * ty;
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const value = parseInt(clean, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

/**
 * Converts a source logo image into a distressed rubber ink stamp, entirely
 * in the browser via the Canvas 2D API. Mirrors the pipeline used by the
 * iOS app's `StampInkFilter.swift` (Core Image): normalize -> monochrome ->
 * contrast/posterize -> procedural grunge distress -> ink tint via an alpha
 * mask -> bleed/blur -> seeded random rotation.
 *
 * `imageUrl` may be a same-origin path, a `data:` URL, or a same-origin
 * `blob:` object URL — all readable back via `getImageData`. Cross-origin
 * images need permissive CORS headers to avoid a "tainted canvas" security
 * error; if that happens, this falls back to `createFallbackStamp` so the
 * feature still works.
 */
export async function generateInkStamp(
  imageUrl: string,
  options: StampOptions = {}
): Promise<string> {
  const size = options.size ?? 512;
  const inkColor = options.inkColor ?? "red";
  const seed = options.seed ?? seedFromString(imageUrl);

  try {
    const image = await loadImage(imageUrl);

    // 1. Normalize: flatten onto white (handles transparent-background
    // logos) and center/scale the source onto a square canvas.
    const base = document.createElement("canvas");
    base.width = size;
    base.height = size;
    const baseCtx = base.getContext("2d")!;
    const scale = (size * 0.72) / Math.max(image.width, image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    baseCtx.fillStyle = "white";
    baseCtx.fillRect(0, 0, size, size);
    baseCtx.drawImage(
      image,
      (size - drawWidth) / 2,
      (size - drawHeight) / 2,
      drawWidth,
      drawHeight
    );

    // 2 & 3. Monochrome + high-contrast thresholding, plus 4. procedural
    // grunge distress and 5. ink tinting — all done in one pixel pass.
    const imageData = baseCtx.getImageData(0, 0, size, size);
    const { data } = imageData;
    const noise = makeValueNoise(seed);
    const [r, g, b] = hexToRgb(INK_COLORS[inkColor]);

    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const i = (py * size + px) * 4;
        const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

        // Darker source pixels (the logo's ink/strokes) become opaque
        // stamp ink; near-white background stays fully transparent.
        const inkAmount = 1 - Math.min(1, luminance / 235);
        const posterized = inkAmount > 0.35 ? 1 : 0;

        // Multiply the silhouette by noise so ink only "takes" on part of
        // the surface, like a worn rubber stamp pad.
        const grunge = noise(px / size, py / size) * 0.6 + 0.4;
        const alpha = posterized * (grunge > 0.45 ? 1 : grunge / 0.45) * 255;

        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = alpha;
      }
    }
    baseCtx.putImageData(imageData, 0, 0);

    // 6. Ink bleed: a touch of blur softens the hard pixel edges.
    const bleed = document.createElement("canvas");
    bleed.width = size;
    bleed.height = size;
    const bleedCtx = bleed.getContext("2d")!;
    bleedCtx.filter = "blur(1.2px)";
    bleedCtx.drawImage(base, 0, 0);

    // 7. Seeded random rotation, like a hand-pressed stamp that never
    // lands perfectly straight.
    const rand = mulberry32(seed + 1);
    const degrees = (rand() - 0.5) * 18; // -9..9
    const radians = (degrees * Math.PI) / 180;

    const output = document.createElement("canvas");
    output.width = size;
    output.height = size;
    const outputCtx = output.getContext("2d")!;
    outputCtx.translate(size / 2, size / 2);
    outputCtx.rotate(radians);
    outputCtx.drawImage(bleed, -size / 2, -size / 2);

    return output.toDataURL("image/png");
  } catch (error) {
    console.warn(
      "generateInkStamp: falling back to a vector stamp (source image likely blocked by CORS):",
      error
    );
    return createFallbackStamp(size, inkColor, seed);
  }
}

/**
 * Draws a generic pizza-slice glyph inside a rotated dashed ring, tinted
 * with the ink color, entirely via vector canvas drawing — no external
 * image needed. Used when a source logo can't be read back due to CORS.
 */
function createFallbackStamp(size: number, inkColor: InkColor, seed: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const ink = INK_COLORS[inkColor];

  const rand = mulberry32(seed);
  const degrees = (rand() - 0.5) * 18;

  ctx.translate(size / 2, size / 2);
  ctx.rotate((degrees * Math.PI) / 180);

  ctx.strokeStyle = ink;
  ctx.lineWidth = size * 0.03;
  ctx.setLineDash([size * 0.02, size * 0.015]);
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.42, 0, Math.PI * 2);
  ctx.stroke();

  ctx.font = `${size * 0.32}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = ink;
  ctx.fillText("🍕", 0, size * 0.02);

  return canvas.toDataURL("image/png");
}

/**
 * Builds a same-origin `data:` URL of a bold letter glyph — a zero-network,
 * zero-CORS-risk stand-in "logo" for the landing page's live demo (and
 * anywhere a restaurant hasn't got an official logo on file yet).
 */
export function createLetterLogoDataUrl(letter: string, size = 512): string {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#111111";
  ctx.font = `bold ${size * 0.55}px Georgia, serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText((letter || "P").toUpperCase(), size / 2, size / 2 + size * 0.04);
  return canvas.toDataURL("image/png");
}

/** Converts a `data:` URL (e.g. from `generateInkStamp`) into a Blob for upload. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}
