"use client";

import { useMemo } from "react";
import { Loader2 } from "lucide-react";

interface StampCanvasProps {
  /** The already-generated stamp PNG data URL (see `lib/stampFilter.ts`'s
   * `generateInkStamp`/`generateNameArchStamp`) — this component only owns
   * the *preview presentation* (parchment backdrop, tilt, drop shadow), not
   * the fetch/generation pipeline, so a single check-in flow only ever
   * runs that pipeline once. */
  stampDataUrl: string | null;
  isGenerating?: boolean;
  /** Stable per-restaurant seed so the tilt doesn't jump around on every
   * re-render — pass the same seed used to generate the stamp itself. */
  seed?: number;
  size?: number;
  className?: string;
}

/** Deterministic tilt in the requested -14°..-8° band, derived from `seed`
 * so a given restaurant always previews at the same angle instead of
 * re-rolling on every render. */
function tiltForSeed(seed: number): number {
  const fraction = (Math.abs(Math.sin(seed)) * 10000) % 1;
  return -14 + fraction * 6; // -14 .. -8
}

/**
 * Presents a generated rubber ink stamp (see `lib/stampFilter.ts`) the way
 * it'd sit on a physical passport page: tilted -8° to -14°, a soft drop
 * shadow, resting on a parchment-textured circle — replacing the old flat,
 * un-rotated preview that made even a real generated stamp look generic.
 */
export default function StampCanvas({
  stampDataUrl,
  isGenerating = false,
  seed = 0,
  size = 176,
  className,
}: StampCanvasProps) {
  const tilt = useMemo(() => tiltForSeed(seed), [seed]);

  return (
    <div
      className={`relative flex items-center justify-center rounded-full bg-parchment ${className ?? ""}`}
      style={{ width: size, height: size, boxShadow: "inset 0 0 0 2px rgba(44,26,20,0.12)" }}
    >
      {isGenerating ? (
        <Loader2 className="h-8 w-8 animate-spin text-[#2C1A14]/40" />
      ) : stampDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={stampDataUrl}
          alt="Ink stamp"
          className="h-[78%] w-[78%] object-contain"
          style={{
            transform: `rotate(${tilt}deg)`,
            filter: "drop-shadow(0 6px 8px rgba(0,0,0,0.35))",
          }}
        />
      ) : (
        <span className="text-3xl opacity-40">🍕</span>
      )}
    </div>
  );
}
