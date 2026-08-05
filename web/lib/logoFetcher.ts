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
 * Resolves a restaurant logo through a 3-tier international fallback
 * strategy, mirroring `LogoFetchService.swift` on iOS:
 *   1. An explicit Google Places photo URL, if one was already resolved.
 *   2. Brandfetch/Clearbit's Logo API, keyed off a guessed domain.
 *   3. Google's high-res favicon service, keyed off the same domain.
 * Returns `null` if none of the three produce a real, loadable image —
 * callers should fall back to `generateNameArchStamp` (tier 4), which
 * stamps the full restaurant name instead of a logo.
 */
export async function fetchLogoUrl(
  restaurantName: string,
  placesPhotoUrl?: string | null
): Promise<LogoFetchResult | null> {
  if (placesPhotoUrl && (await urlLoads(placesPhotoUrl))) {
    return { url: placesPhotoUrl, source: "places" };
  }

  const domain = domainGuess(restaurantName);
  if (!domain) return null;

  const brandUrl = `https://logo.clearbit.com/${domain}?size=256`;
  if (await urlLoads(brandUrl)) {
    return { url: brandUrl, source: "brand-logo" };
  }

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=256`;
  if (await urlLoads(faviconUrl)) {
    return { url: faviconUrl, source: "favicon" };
  }

  return null;
}
