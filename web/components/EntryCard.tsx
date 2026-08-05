import Image from "next/image";
import Link from "next/link";
import type { Entry } from "@/lib/types";
import { INK_COLORS, type InkColor } from "@/lib/constants";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isInkColor(value: string): value is InkColor {
  return value in INK_COLORS;
}

/**
 * A single check-in: dual photos (venue + selfie), the generated ink
 * stamp, restaurant name, crust style, date, and Plate rating.
 */
export default function EntryCard({ entry }: { entry: Entry }) {
  const inkHex = isInkColor(entry.ink_color) ? INK_COLORS[entry.ink_color] : INK_COLORS.red;

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-lg shadow-black/30 transition hover:border-white/20">
      <div className="grid grid-cols-2 gap-px bg-black/40">
        <div className="relative aspect-square">
          <Image
            src={entry.venue_photo_url}
            alt={`${entry.restaurant_name} venue`}
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            className="object-cover"
          />
        </div>
        <div className="relative aspect-square">
          <Image
            src={entry.selfie_photo_url}
            alt={`${entry.restaurant_name} selfie`}
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            className="object-cover"
          />
        </div>
      </div>

      <div className="relative flex items-start gap-3 overflow-hidden p-4">
        <div aria-hidden="true" className="absolute inset-0 bg-cornmeal opacity-[0.1]" />
        {entry.stamp_image_url ? (
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-dashed"
            style={{ borderColor: `${inkHex}66` }}
          >
            <Image
              src={entry.stamp_image_url}
              alt="Ink stamp"
              width={44}
              height={44}
              className="object-contain"
            />
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          {entry.place_id ? (
            <Link
              href={`/place/${encodeURIComponent(entry.place_id)}`}
              className="block truncate font-serif text-lg font-bold text-mozzarella hover:text-crust"
            >
              {entry.restaurant_name}
            </Link>
          ) : (
            <h3 className="truncate font-serif text-lg font-bold text-mozzarella">{entry.restaurant_name}</h3>
          )}
          <p className="text-xs uppercase tracking-wide text-mozzarella/50">
            {entry.crust_type} · {formatDate(entry.created_at)}
          </p>

          <div className="mt-2 flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, index) => {
              const filled = index + 1 <= Math.round(entry.rating);
              return (
                <span
                  key={index}
                  className={filled ? "text-crust" : "text-white/15"}
                  aria-hidden
                >
                  🍽️
                </span>
              );
            })}
            <span className="ml-1 text-sm font-semibold text-crust">
              {entry.rating.toFixed(1)}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
