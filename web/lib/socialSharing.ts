/**
 * Sharing helpers for the story exporter's social action bar.
 *
 * Platform reality check baked into these implementations: browsers have
 * no API to push an image directly into Instagram Stories, Snapchat, or a
 * Facebook post — those integrations only exist inside native apps (see
 * `Utilities/SocialShareManager.swift` for the iOS versions that actually
 * can, via the pasteboard/URL-scheme tricks Instagram and Snapchat
 * document for native callers). On web, every one of these functions does
 * the most honest thing actually available in a browser: the Web Share
 * API where the OS share sheet can hand the image to an installed app,
 * clipboard-copy so a user can paste into a compose box, a real intent/
 * dialog URL where the platform provides one (X, Facebook), and a plain
 * download as the universal fallback.
 */

import { getBrowserSupabaseClient } from "./supabase/client";

export const PIZZA_PASSPORT_WEB_ORIGIN = "https://pizzapassport.vercel.app";

export function buildProfileUrl(username: string): string {
  if (typeof window !== "undefined" && window.location.origin) {
    return `${window.location.origin}/u/${encodeURIComponent(username)}`;
  }
  return `${PIZZA_PASSPORT_WEB_ORIGIN}/u/${encodeURIComponent(username)}`;
}

export function buildTweetIntentUrl(restaurantName: string, profileUrl: string): string {
  const text = `Just stamped my pizza passport at ${restaurantName}! 🍕 Check out my stamp profile:`;
  const url = new URL("https://x.com/intent/post");
  url.searchParams.set("text", text);
  url.searchParams.set("url", profileUrl);
  return url.toString();
}

export function buildFacebookShareUrl(profileUrl: string): string {
  const url = new URL("https://www.facebook.com/sharer/sharer.php");
  url.searchParams.set("u", profileUrl);
  return url.toString();
}

/** Converts a PNG data URL into a `File`, for both Web Share and downloads. */
export async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], filename, { type: "image/png" });
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

/** True on browsers that can actually receive `files` via `navigator.share`
 * (support varies — most desktop browsers implement `share()` for text/URL
 * only, not files, so this check matters and isn't just a `"share" in
 * navigator` test). */
export function canShareFiles(file: File): boolean {
  return typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [file] });
}

export async function shareFileViaWebShare(file: File, title: string, text?: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.share || !canShareFiles(file)) return false;
  try {
    await navigator.share({ files: [file], title, text });
    return true;
  } catch (error) {
    // AbortError just means the user dismissed the OS share sheet — not a
    // real failure worth surfacing.
    if (error instanceof DOMException && error.name === "AbortError") return true;
    return false;
  }
}

/**
 * Best-effort clipboard image copy so a user can paste the story image
 * straight into a platform's compose box (e.g. a new X post or Instagram
 * DM/Story upload). Requires a secure context and browser support for
 * `ClipboardItem` — silently returns `false` rather than throwing when
 * unavailable, since this is always paired with a download fallback.
 */
export async function copyImageToClipboard(dataUrl: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard || typeof ClipboardItem === "undefined") {
    return false;
  }
  try {
    const blob = await (await fetch(dataUrl)).blob();
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    return true;
  } catch {
    return false;
  }
}

export type SharePlatform = "instagram" | "snapchat" | "x" | "facebook" | "system";

/** Fire-and-forget insert into `public.story_share_events`, powering the
 * merchant dashboard's "Total Story Shares" metric. Never throws — a
 * failed metrics ping should never surface as a broken share button. */
async function recordStoryShare(entryId: string, platform: SharePlatform): Promise<void> {
  try {
    const supabase = getBrowserSupabaseClient();
    await supabase.from("story_share_events").insert({ entry_id: entryId, platform });
  } catch {
    // Non-critical — the share itself already happened.
  }
}

export interface ShareOutcome {
  platform: SharePlatform;
  /** What actually happened, so the UI can show an accurate toast instead
   * of a generic "shared!" that may not be true on this platform/browser. */
  method: "web-share" | "clipboard+download" | "download" | "intent+clipboard" | "dialog";
}

/**
 * Routes a share request to the most capable thing actually available for
 * `platform` in a browser, always falling through to a plain download so
 * the user is never left with a dead button.
 */
export async function shareStoryImage(
  platform: SharePlatform,
  params: { dataUrl: string; restaurantName: string; profileUrl: string; entryId: string }
): Promise<ShareOutcome> {
  const filename = `pizza-passport-${params.restaurantName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
  const file = await dataUrlToFile(params.dataUrl, filename);
  void recordStoryShare(params.entryId, platform);

  switch (platform) {
    case "instagram":
    case "snapchat": {
      // Neither platform exposes a web API to receive an image directly;
      // the OS share sheet (Web Share) is the only path where an
      // installed app can actually pick it up.
      if (await shareFileViaWebShare(file, "My Pizza Passport Stamp")) {
        return { platform, method: "web-share" };
      }
      const copied = await copyImageToClipboard(params.dataUrl);
      downloadDataUrl(params.dataUrl, filename);
      return { platform, method: copied ? "clipboard+download" : "download" };
    }
    case "x": {
      window.open(buildTweetIntentUrl(params.restaurantName, params.profileUrl), "_blank", "noopener,noreferrer");
      await copyImageToClipboard(params.dataUrl);
      return { platform, method: "intent+clipboard" };
    }
    case "facebook": {
      window.open(buildFacebookShareUrl(params.profileUrl), "_blank", "noopener,noreferrer");
      await copyImageToClipboard(params.dataUrl);
      return { platform, method: "intent+clipboard" };
    }
    case "system":
    default: {
      if (await shareFileViaWebShare(file, "My Pizza Passport Stamp", params.profileUrl)) {
        return { platform: "system", method: "web-share" };
      }
      downloadDataUrl(params.dataUrl, filename);
      return { platform: "system", method: "download" };
    }
  }
}
