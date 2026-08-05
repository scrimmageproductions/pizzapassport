"use client";

import { useMemo } from "react";
import { Caveat } from "next/font/google";

const caveat = Caveat({ subsets: ["latin"], weight: ["600", "700"] });

interface PolaroidCardProps {
  photoUrl: string;
  restaurantName: string;
  location: string;
  date: string | Date;
  stampUrl?: string | null;
  vintageFilter?: boolean;
  /** Degrees to angle the overlaid stamp/badge — e.g. -12 or 15. */
  stampRotation?: number;
  /** Stable per-entry seed so the paper grain and natural card tilt don't
   * re-roll on every re-render — pass a hash of the entry's identifier. */
  seed?: number;
}

/**
 * An authentic-feeling instant-camera "Polaroid" frame: off-white paper
 * border with procedural grain, an optional vintage-filtered photo area, a
 * handwritten-style caption banner (Caveat, via next/font/google), and the
 * check-in's distressed ink stamp overlaid at a jaunty angle. Mirrors
 * `PolaroidView.swift` on iOS.
 */
export default function PolaroidCard({
  photoUrl,
  restaurantName,
  location,
  date,
  stampUrl,
  vintageFilter = true,
  stampRotation = -12,
  seed = 0,
}: PolaroidCardProps) {
  const dateLabel = useMemo(() => {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }, [date]);

  // Deterministic, seeded "natural" tilt + grain dot positions, so a given
  // entry always renders the same instead of re-rolling on every render.
  const tilt = useMemo(() => (seededRandom(seed) - 0.5) * 4, [seed]);
  const grainDots = useMemo(() => makeGrainDots(seed), [seed]);

  return (
    <div
      className="w-full max-w-xs rounded-sm bg-[#FAF8F2] p-3 pb-6 shadow-2xl"
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-black/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl}
          alt={restaurantName}
          className="h-full w-full object-cover"
          style={vintageFilter ? { filter: "saturate(1.1) contrast(0.9) sepia(0.15)" } : undefined}
        />
        {vintageFilter ? <div className="pointer-events-none absolute inset-0 bg-[#F5C97A] opacity-10" /> : null}

        {stampUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={stampUrl}
            alt="Ink stamp"
            className="pointer-events-none absolute right-2 top-2 h-16 w-16 object-contain opacity-90"
            style={{ transform: `rotate(${stampRotation}deg)` }}
          />
        ) : (
          <div
            className="pointer-events-none absolute right-2 top-2 rounded border-2 border-tomato/70 px-2 py-1 text-center text-tomato"
            style={{ transform: `rotate(${stampRotation}deg)` }}
          >
            <p className="text-[9px] font-black tracking-wide">CHECKED IN</p>
            <p className="text-[8px] font-bold">{dateLabel}</p>
          </div>
        )}

        {/* Procedural paper grain */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.06]">
          {grainDots.map((dot, i) => (
            <circle key={i} cx={`${dot.x}%`} cy={`${dot.y}%`} r={dot.r} fill="black" />
          ))}
        </svg>
      </div>

      <div className="px-1 pt-3">
        <p className={`${caveat.className} truncate text-2xl text-[#262220]`} title={restaurantName}>
          {restaurantName}
        </p>
        {location ? (
          <p className="text-[10px] font-semibold uppercase tracking-wide text-black/40">{location}</p>
        ) : null}
        <p className="text-[10px] font-medium text-black/35">{dateLabel}</p>
      </div>
    </div>
  );
}

function seededRandom(seed: number): number {
  let a = (seed || 1) >>> 0;
  a ^= a << 13;
  a ^= a >>> 17;
  a ^= a << 5;
  return ((a >>> 0) % 1000) / 1000;
}

function makeGrainDots(seed: number): { x: number; y: number; r: number }[] {
  let state = (seed || 1) >>> 0;
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  return Array.from({ length: 90 }, () => ({
    x: next() * 100,
    y: next() * 100,
    r: next() * 0.6 + 0.2,
  }));
}
