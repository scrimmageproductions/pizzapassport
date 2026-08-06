"use client";

import Link from "next/link";
import { MapPin, Utensils } from "lucide-react";
import clsx from "clsx";
import type { Entry } from "@/lib/types";
import { seedFromString } from "@/lib/stampFilter";
import PolaroidCard from "./PolaroidCard";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function plateFillLevel(value: number, plate: number): "full" | "half" | "empty" {
  const diff = value - (plate - 1);
  if (diff >= 1) return "full";
  if (diff >= 0.5) return "half";
  return "empty";
}

/** A metallic-gold wax-seal-style plate rating for the passport page —
 * small embossed medallions rather than the flat emoji icons the
 * interactive `PlateRating` control uses during check-in. Built from a
 * gradient badge + a line icon (not a color emoji) so the metallic finish
 * actually renders instead of being ignored by an emoji glyph. */
function GoldPlateRating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((plate) => {
          const level = plateFillLevel(value, plate);
          return (
            <div
              key={plate}
              className={clsx(
                "relative flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border",
                level === "empty"
                  ? "border-[#2C1A14]/15 bg-[#2C1A14]/5"
                  : "border-[#8A6015]/70 bg-gradient-to-br from-[#F9E3A0] via-[#D1A34F] to-[#8A6015] shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),0_1px_1px_rgba(0,0,0,0.2)]"
              )}
            >
              {level === "half" ? <div className="absolute inset-y-0 right-0 w-1/2 bg-[#FDFBF7]/80" /> : null}
              <Utensils className={clsx("relative h-3 w-3", level === "empty" ? "text-[#2C1A14]/25" : "text-[#4A3418]")} />
            </div>
          );
        })}
      </div>
      <span className="text-sm font-bold text-[#8A6015]">{value.toFixed(1)} Plates</span>
    </div>
  );
}

/**
 * The "page" content of a passport entry — a tactile, cream/parchment
 * visa-style layout, in contrast to the app's usual dark theme. Reused
 * inside `PassportDetailModal`; kept as its own component in case a future
 * screen (e.g. a printable passport export) wants the same page without
 * the modal chrome around it.
 */
export default function PassportEntryCard({ entry }: { entry: Entry }) {
  const seed = seedFromString(entry.id);
  const stampNumber = String(entry.serial_number).padStart(3, "0");

  return (
    <div className="relative overflow-hidden rounded-[28px] border-[6px] border-[#2C1A14] bg-[#FDFBF7] shadow-2xl shadow-black/50">
      {/* Gold foil inner line accent, just inside the leather border. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-[6px] rounded-[20px] border border-crust/50" />

      {/* Parchment grain + faint guilloché security pattern + a pizza-peel
          "seal" watermark, all sitting quietly behind the content. */}
      <div aria-hidden="true" className="absolute inset-0 bg-parchment" />
      <div aria-hidden="true" className="absolute inset-0 bg-guilloche opacity-[0.05]" />
      <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center overflow-hidden">
        <span className="select-none text-[220px] leading-none opacity-[0.045]" style={{ transform: "rotate(-8deg)" }}>
          🍕
        </span>
      </div>

      <div className="relative max-h-[80vh] overflow-y-auto p-5 text-[#2C1A14] sm:p-7">
        {/* Header bar */}
        <div className="flex items-start justify-between gap-3 border-b border-[#2C1A14]/15 pb-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-[#2C1A14]/60">
              Visa / Entry Permit
            </p>
            <h2 className="mt-1 truncate font-serif text-2xl font-bold">{entry.restaurant_name}</h2>
            {entry.country ? (
              <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-[#2C1A14]/50">
                <MapPin className="h-3 w-3" /> {entry.country}
              </p>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-xs font-black uppercase tracking-widest text-tomato">Stamp #{stampNumber}</p>
            <p className="text-[10px] font-semibold text-[#2C1A14]/40">{formatDate(entry.created_at)}</p>
          </div>
        </div>

        {/* Photo frames — tilted Polaroids with the ink stamp overlaid at
            the page's bottom-right corner. */}
        <div className="relative mt-6 flex flex-wrap items-start justify-center gap-x-4 gap-y-6 pb-4">
          <PolaroidCard
            photoUrl={entry.venue_photo_url}
            restaurantName={entry.restaurant_name}
            captionOverride="Venue"
            location=""
            date={entry.created_at}
            tiltDegrees={-2}
            seed={seed}
            vintageFilter
            stampUrl={null}
            hideStampFallback
          />
          <PolaroidCard
            photoUrl={entry.selfie_photo_url}
            restaurantName={entry.restaurant_name}
            captionOverride="You + the Slice"
            location=""
            date={entry.created_at}
            tiltDegrees={3}
            seed={seed + 1}
            vintageFilter
            stampUrl={null}
            hideStampFallback
          />

          {entry.stamp_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={entry.stamp_image_url}
              alt="Ink stamp"
              className="pointer-events-none absolute -bottom-2 right-2 h-24 w-24 object-contain opacity-90 mix-blend-multiply sm:h-28 sm:w-28"
              style={{ transform: "rotate(-12deg)" }}
            />
          ) : null}
        </div>

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[#2C1A14]/15 bg-[#2C1A14]/5 px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#2C1A14]/70">
            {entry.crust_type}
          </span>
          <span className="rounded-full bg-basil px-3 py-1 text-xs font-bold uppercase tracking-wide text-mozzarella">
            +{entry.points_earned} Pts
          </span>
        </div>

        {/* Plate rating */}
        <div className="mt-4">
          <GoldPlateRating value={entry.rating} />
        </div>

        {/* Actions */}
        <div className="mt-6 space-y-2 border-t border-[#2C1A14]/15 pt-4">
          <Link
            href={`/story/${entry.id}`}
            className="block -rotate-1 rounded-md border-2 border-tomato bg-tomato/95 px-4 py-2.5 text-center text-sm font-black uppercase tracking-wider text-mozzarella shadow-[inset_0_0_0_2px_rgba(255,253,208,0.25)] transition hover:rotate-0 hover:bg-tomato"
          >
            Export Passport Story
          </Link>
          {entry.place_id ? (
            <Link
              href={`/place/${encodeURIComponent(entry.place_id)}`}
              className="block text-center text-xs font-semibold text-[#8A6015] hover:underline"
            >
              View all moments at {entry.restaurant_name} →
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
