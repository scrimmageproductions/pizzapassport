"use client";

import { useState } from "react";
import { ExternalLink, Copy, Check } from "lucide-react";
import type { Coordinates } from "@/lib/geo";

interface GoogleReviewPromptProps {
  restaurantName: string;
  rating: number;
  note: string;
  coords: Coordinates | null;
  onDismiss: () => void;
}

/**
 * Nudges a user to turn their check-in into a real Google review for the
 * pizzeria — genuinely useful for the business, but honest about what's
 * actually possible: Google does not expose any documented way to
 * pre-fill a review's star rating or text via URL (this is deliberate on
 * Google's part, to discourage incentivized/fake reviews). What this
 * component actually does:
 *   - Deep-links to the right business on Google Maps via a search query
 *     (works with just a name + coordinates — no Google Place ID needed,
 *     since nearby search here runs on free OpenStreetMap data). One
 *     extra tap from the search result ("Write a review") reaches the
 *     composer.
 *   - Copies the Moment's note to the clipboard so it can be pasted in.
 *   - Tells the user which star rating to tap, since it can't be set
 *     for them.
 * If a real Google Place ID becomes available later (e.g. a Google
 * Places API key gets configured), swap the URL below for
 * `https://search.google.com/local/writereview?placeid=<id>` to land
 * directly on the review composer instead of a search result.
 */
export default function GoogleReviewPrompt({
  restaurantName,
  rating,
  note,
  coords,
  onDismiss,
}: GoogleReviewPromptProps) {
  const [copied, setCopied] = useState(false);

  const mapsSearchUrl = (() => {
    const query = coords ? `${restaurantName} ${coords.lat},${coords.lng}` : restaurantName;
    const url = new URL("https://www.google.com/maps/search/");
    url.searchParams.set("api", "1");
    url.searchParams.set("query", query);
    return url.toString();
  })();

  async function handleCopyAndOpen() {
    if (note && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(note);
        setCopied(true);
      } catch {
        // Clipboard permissions vary by browser/context — opening Maps
        // still works fine even if the copy silently fails.
      }
    }
    window.open(mapsSearchUrl, "_blank", "noreferrer");
    // Give the "Copied ✓" feedback a beat to register before this screen
    // (still in the check-in flow) hands off to the story export.
    setTimeout(onDismiss, 700);
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div>
        <h2 className="font-serif text-xl font-bold text-mozzarella">Share it as a Google Review?</h2>
        <p className="text-sm text-mozzarella/60">
          Help {restaurantName} out — real reviews from real visits matter more than almost anything else for a
          small pizzeria.
        </p>
      </div>

      <div className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left text-sm text-mozzarella/70">
        <p>
          On Google, tap <span className="font-semibold text-crust">{rating.toFixed(1)} stars</span> to match your
          Plates rating.
        </p>
        {note ? (
          <p className="mt-2">We&apos;ll copy your note to your clipboard — just paste it into the review text box.</p>
        ) : null}
      </div>

      <div className="flex w-full items-center justify-between gap-3">
        <button type="button" onClick={onDismiss} className="text-sm font-semibold text-mozzarella/50 underline">
          Not now
        </button>
        <button
          type="button"
          onClick={handleCopyAndOpen}
          className="flex items-center gap-2 rounded-full bg-tomato px-6 py-2.5 text-sm font-bold text-mozzarella"
        >
          {copied ? (
            <Check className="h-4 w-4" />
          ) : note ? (
            <Copy className="h-4 w-4" />
          ) : (
            <ExternalLink className="h-4 w-4" />
          )}
          {copied ? "Copied — opening Maps…" : "Open Google Maps"}
        </button>
      </div>
    </div>
  );
}
