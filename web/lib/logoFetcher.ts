export type LogoSource = "places" | "brand-logo" | "favicon";

export interface LogoFetchResult {
  url: string;
  source: LogoSource;
}

/** Best-effort domain guess from a restaurant's name, used only when there
 * is no real website on file. Mirrors `LogoFetchService.domainGuess` on
 * iOS — prefer a real domain (e.g. resolved via the Google Places
 * "Place Details" `website` field) over this heuristic in production. */
function domainGuess(restaurantName: string): string | null {
  const slug = restaurantName.toLowerCase().replace(/[^a-z0-9]/g, "");
  return slug ? `${slug}.com` : null;
}

/** Resolves whether an image URL actually loads a real image, with a short
 * timeout so a slow or broken third-party endpoint never hangs the
 * check-in flow. */
function urlLoads(url: string, timeoutMs = 4000): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(false), timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      // Some favicon services return a tiny blank/placeholder image
      // instead of a 404 — treat that as a miss, not a real logo.
      resolve(img.naturalWidth > 8 && img.naturalHeight > 8);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(false);
    };
    img.src = url;
  });
}

/**
 * Routes an external image URL through `/api/proxy-image` so the Canvas
 * ink-stamp engine (`generateInkStamp`) can read its pixel data back out
 * without tainting the canvas — most favicon/logo services don't reliably
 * send a permissive CORS header, and a proxied same-origin response
 * sidesteps that entirely. Never applied to same-origin URLs (a `blob:`
 * preview or already-proxied path), since those don't need it.
 */
function toProxiedUrl(url: string): string {
  if (url.startsWith("/") || url.startsWith("blob:") || url.startsWith("data:")) return url;
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
}

/**
 * Resolves a restaurant logo through a 3-tier international fallback
 * strategy, mirroring `LogoFetchService.swift` on iOS:
 *   1. An explicit Google Places photo URL, if one was already resolved.
 *   2. Brandfetch/Clearbit's Logo API, keyed off a guessed domain.
 *   3. Google's high-res favicon service, keyed off the same domain.
 * Returns `null` if none of the three produce a real, loadable image —
 * callers should fall back to `generateNameArchStamp` (tier 4), which
 * stamps the full restaurant name instead of a logo.
 *
 * The winning URL is returned already wrapped in `/api/proxy-image` (see
 * `toProxiedUrl`) — candidates are still probed against their raw URLs in
 * `urlLoads` (an `<img>` tag can display a cross-origin image just fine;
 * only *reading pixel data back* needs CORS), so only the one URL that's
 * actually used pays the proxy round-trip.
 */
export async function fetchLogoUrl(
  restaurantName: string,
  placesPhotoUrl?: string | null
): Promise<LogoFetchResult | null> {
  if (placesPhotoUrl && (await urlLoads(placesPhotoUrl))) {
    return { url: toProxiedUrl(placesPhotoUrl), source: "places" };
  }

  const domain = domainGuess(restaurantName);
  if (!domain) return null;

  const brandUrl = `https://logo.clearbit.com/${domain}?size=256`;
  if (await urlLoads(brandUrl)) {
    return { url: toProxiedUrl(brandUrl), source: "brand-logo" };
  }

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=256`;
  if (await urlLoads(faviconUrl)) {
    return { url: toProxiedUrl(faviconUrl), source: "favicon" };
  }

  return null;
}
