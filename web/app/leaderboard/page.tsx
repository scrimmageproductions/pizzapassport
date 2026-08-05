"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";
import { Loader2, Trophy, MapPinned } from "lucide-react";
import { getBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { LeaderboardEntry } from "@/lib/types";
import SauceSplatter from "@/components/SauceSplatter";

type Tab = "explorers" | "points";

const CROWNS = ["🥇", "🥈", "🥉"] as const;

export default function LeaderboardPage() {
  const [tab, setTab] = useState<Tab>("explorers");
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [configured] = useState(isSupabaseConfigured);

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
          .from("leaderboard")
          .select("*")
          .returns<LeaderboardEntry[]>();
        if (error) throw error;
        if (!cancelled) setRows(data ?? []);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Couldn't load the leaderboard.");
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

  const sorted = [...rows].sort((a, b) =>
    tab === "explorers" ? b.total_checkins - a.total_checkins : b.points - a.points
  );

  return (
    <div className="relative mx-auto max-w-2xl space-y-6 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] p-6">
      <div aria-hidden="true" className="absolute inset-0 bg-cornmeal opacity-[0.14]" />
      <SauceSplatter className="absolute -right-8 -top-8" size={130} opacity={0.28} />

      <div className="relative space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-crust/20 text-2xl">
            <Trophy className="h-6 w-6 text-crust" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-mozzarella">Global Pizza Leaderboard</h1>
          <p className="text-sm text-mozzarella/50">See who's collecting the most stamps and points worldwide.</p>
        </div>

        <div className="flex justify-center gap-2">
          <TabButton active={tab === "explorers"} onClick={() => setTab("explorers")}>
            Top Pizza Explorers
          </TabButton>
          <TabButton active={tab === "points"} onClick={() => setTab("points")}>
            Points Leaders
          </TabButton>
        </div>

        {!configured ? (
          <p className="rounded-xl border border-crust/30 bg-crust/10 px-4 py-6 text-center text-sm text-crust">
            🔌 Leaderboards need a connected passport — this deployment isn't linked to Supabase yet.
          </p>
        ) : isLoading ? (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-mozzarella/50">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading leaderboard…
          </p>
        ) : loadError ? (
          <p className="rounded-xl border border-tomato/40 bg-tomato/10 px-4 py-3 text-center text-sm text-tomato">
            {loadError}
          </p>
        ) : sorted.length === 0 ? (
          <p className="py-10 text-center text-sm text-mozzarella/40">
            No public passports yet — be the first to check in and claim the crown.
          </p>
        ) : (
          <ol className="space-y-2">
            {sorted.map((row, index) => (
              <li key={row.id}>
                <Link
                  href={`/u/${encodeURIComponent(row.username)}`}
                  className={clsx(
                    "flex items-center gap-3 rounded-xl border px-4 py-3 transition hover:bg-white/10",
                    index < 3 ? "border-crust/40 bg-crust/10" : "border-white/10 bg-white/5"
                  )}
                >
                  <span className="w-8 shrink-0 text-center text-lg font-bold text-mozzarella/60">
                    {CROWNS[index] ?? `#${index + 1}`}
                  </span>

                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-tomato/20 text-lg">
                    {row.avatar_url ? (
                      <Image src={row.avatar_url} alt={row.username} width={36} height={36} className="object-cover" />
                    ) : (
                      "🍕"
                    )}
                  </div>

                  <span className="min-w-0 flex-1 truncate font-semibold text-mozzarella">@{row.username}</span>

                  <span className="shrink-0 text-right text-sm font-bold text-crust">
                    {tab === "explorers" ? (
                      <>
                        {row.total_checkins} <span className="font-normal text-mozzarella/40">slices</span>
                      </>
                    ) : (
                      <>
                        {row.points} <span className="font-normal text-mozzarella/40">pts</span>
                      </>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}

        <Link
          href="/map"
          className="flex items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-sm font-semibold text-mozzarella/70 hover:bg-white/5"
        >
          <MapPinned className="h-4 w-4" />
          See the World Pizza Map
        </Link>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "rounded-full px-4 py-2 text-sm font-semibold transition",
        active ? "bg-tomato text-mozzarella" : "bg-white/8 text-mozzarella/60 hover:bg-white/15"
      )}
    >
      {children}
    </button>
  );
}
