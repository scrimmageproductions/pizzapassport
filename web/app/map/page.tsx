"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Loader2, Globe2 } from "lucide-react";
import { getBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { CountryActivity } from "@/lib/types";
import { COUNTRY_CENTROIDS } from "@/lib/countryCentroids";
import SauceSplatter from "@/components/SauceSplatter";

const MAP_WIDTH = 720;
const MAP_HEIGHT = 360;

/** Equirectangular projection — good enough for a stylized activity map,
 * not intended for anything precision-sensitive. */
function project(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng + 180) / 360) * MAP_WIDTH;
  const y = ((90 - lat) / 180) * MAP_HEIGHT;
  return { x, y };
}

function dotRadius(count: number, max: number): number {
  if (max <= 0) return 4;
  const scale = Math.sqrt(count / max);
  return 4 + scale * 14;
}

export default function GlobalMapPage() {
  const [rows, setRows] = useState<CountryActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [configured] = useState(isSupabaseConfigured);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;

    async function load() {
      try {
        const supabase = getBrowserSupabaseClient();
        const { data, error } = await supabase
          .from("country_activity")
          .select("*")
          .returns<CountryActivity[]>();
        if (error) throw error;
        if (!cancelled) setRows(data ?? []);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Couldn't load global activity.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [configured]);

  const ranked = useMemo(() => [...rows].sort((a, b) => b.total_checkins - a.total_checkins), [rows]);
  const maxCheckins = ranked[0]?.total_checkins ?? 0;
  const selected = ranked.find((row) => row.country === selectedCountry) ?? null;

  return (
    <div className="relative mx-auto max-w-3xl space-y-6 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] p-6">
      <div aria-hidden="true" className="absolute inset-0 bg-cornmeal opacity-[0.14]" />
      <SauceSplatter className="absolute -left-8 -bottom-8" size={130} opacity={0.25} />

      <div className="relative space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-basil/15 text-2xl">
            <Globe2 className="h-6 w-6 text-basil" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-mozzarella">World Pizza Map</h1>
          <p className="text-sm text-mozzarella/50">
            Every dot is a country where a Pizza Passport holder has checked in — bigger dot, more slices stamped.
          </p>
        </div>

        {!configured ? (
          <p className="rounded-xl border border-crust/30 bg-crust/10 px-4 py-6 text-center text-sm text-crust">
            🔌 The world map needs a connected passport — this deployment isn't linked to Supabase yet.
          </p>
        ) : isLoading ? (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-mozzarella/50">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading global activity…
          </p>
        ) : loadError ? (
          <p className="rounded-xl border border-tomato/40 bg-tomato/10 px-4 py-3 text-center text-sm text-tomato">
            {loadError}
          </p>
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
              <svg
                viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                className="h-auto w-full"
                role="img"
                aria-label="World map of pizza check-in activity by country"
              >
                <rect x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} fill="#12100e" />
                {/* Graticule — a lightweight lat/lng grid stands in for
                    coastlines, keeping this dependency-free while still
                    reading clearly as a world map. */}
                {Array.from({ length: 7 }).map((_, i) => (
                  <line
                    key={`lat-${i}`}
                    x1={0}
                    x2={MAP_WIDTH}
                    y1={(i * MAP_HEIGHT) / 6}
                    y2={(i * MAP_HEIGHT) / 6}
                    stroke="#ffffff"
                    strokeOpacity={0.06}
                  />
                ))}
                {Array.from({ length: 13 }).map((_, i) => (
                  <line
                    key={`lng-${i}`}
                    y1={0}
                    y2={MAP_HEIGHT}
                    x1={(i * MAP_WIDTH) / 12}
                    x2={(i * MAP_WIDTH) / 12}
                    stroke="#ffffff"
                    strokeOpacity={0.06}
                  />
                ))}
                <line x1={0} x2={MAP_WIDTH} y1={MAP_HEIGHT / 2} y2={MAP_HEIGHT / 2} stroke="#ffffff" strokeOpacity={0.14} />

                {ranked.map((row) => {
                  const centroid = COUNTRY_CENTROIDS[row.country];
                  if (!centroid) return null;
                  const { x, y } = project(centroid[0], centroid[1]);
                  const r = dotRadius(row.total_checkins, maxCheckins);
                  const active = row.country === selectedCountry;
                  return (
                    <g key={row.country}>
                      <circle
                        cx={x}
                        cy={y}
                        r={r}
                        fill={active ? "#D1A34F" : "#C8102E"}
                        fillOpacity={active ? 0.85 : 0.6}
                        stroke={active ? "#FFFDD0" : "transparent"}
                        strokeWidth={2}
                        className="cursor-pointer transition"
                        onClick={() => setSelectedCountry(active ? null : row.country)}
                      >
                        <title>{`${row.country}: ${row.total_checkins} slices stamped`}</title>
                      </circle>
                    </g>
                  );
                })}
              </svg>
            </div>

            {selected ? (
              <div className="rounded-xl border border-crust/40 bg-crust/10 px-4 py-3 text-center">
                <p className="font-serif text-lg font-bold text-mozzarella">
                  🍕 {selected.country}: {selected.total_checkins.toLocaleString()} Slices Stamped
                </p>
                <p className="text-xs text-mozzarella/50">
                  {selected.total_explorers.toLocaleString()} explorer{selected.total_explorers === 1 ? "" : "s"}{" "}
                  checking in
                </p>
              </div>
            ) : null}

            {ranked.length === 0 ? (
              <p className="py-6 text-center text-sm text-mozzarella/40">
                No check-ins with a detected country yet — go check in somewhere!
              </p>
            ) : (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-mozzarella/50">Top Countries</p>
                {ranked.slice(0, 10).map((row, index) => (
                  <button
                    key={row.country}
                    type="button"
                    onClick={() => setSelectedCountry(row.country === selectedCountry ? null : row.country)}
                    className={clsx(
                      "flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-left text-sm transition",
                      row.country === selectedCountry
                        ? "border-crust bg-crust/10"
                        : "border-white/10 bg-white/5 hover:bg-white/10"
                    )}
                  >
                    <span className="font-semibold text-mozzarella">
                      #{index + 1} {row.country}
                    </span>
                    <span className="font-bold text-crust">{row.total_checkins.toLocaleString()} slices</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
