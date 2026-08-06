"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, Clock } from "lucide-react";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import { getCurrentMerchant } from "@/lib/merchant";
import type { Merchant } from "@/lib/types";
import CustomerFeed from "@/components/biz/CustomerFeed";

interface Metrics {
  totalStamps: number;
  averageRating: number;
  totalPoints: number;
  totalStoryShares: number;
}

export default function MerchantDashboardPage() {
  const router = useRouter();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const session = await getCurrentMerchant();
        if (!session) {
          router.replace("/biz/claim");
          return;
        }
        if (!session.merchant) {
          // Signed up but the claim never completed (e.g. the API call
          // failed after account creation) — send them back to finish it.
          router.replace("/biz/claim");
          return;
        }
        if (!cancelled) setMerchant(session.merchant);

        const supabase = getBrowserSupabaseClient();
        const { data: placeEntries, error } = await supabase
          .from("entries")
          .select("id, rating, points_earned")
          .eq("place_id", session.merchant.place_id)
          .returns<{ id: string; rating: number; points_earned: number }[]>();
        if (error) throw error;

        const entryIds = (placeEntries ?? []).map((e) => e.id);
        let totalStoryShares = 0;
        if (entryIds.length > 0) {
          const { count } = await supabase
            .from("story_share_events")
            .select("*", { count: "exact", head: true })
            .in("entry_id", entryIds);
          totalStoryShares = count ?? 0;
        }

        const totalStamps = placeEntries?.length ?? 0;
        const averageRating =
          totalStamps > 0 ? (placeEntries ?? []).reduce((sum, e) => sum + e.rating, 0) / totalStamps : 0;
        const totalPoints = (placeEntries ?? []).reduce((sum, e) => sum + e.points_earned, 0);

        if (!cancelled) setMetrics({ totalStamps, averageRating, totalPoints, totalStoryShares });
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Couldn't load your dashboard.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (isLoading) {
    return (
      <p className="flex items-center justify-center gap-2 py-20 text-sm text-[#FDFBF7]/50">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your dashboard…
      </p>
    );
  }
  if (loadError || !merchant) {
    return (
      <p className="rounded-xl border border-tomato/40 bg-tomato/10 px-4 py-3 text-center text-sm text-tomato">
        {loadError ?? "Couldn't load your dashboard."}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#FDFBF7]">{merchant.business_name}</h1>
          {merchant.is_verified ? (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-basil">
              <ShieldCheck className="h-3.5 w-3.5" /> Verified Pizzeria
            </p>
          ) : (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-[#D1A34F]">
              <Clock className="h-3.5 w-3.5" /> Pending verification
            </p>
          )}
        </div>
      </div>

      {!merchant.is_verified ? (
        <div className="rounded-xl border border-[#D1A34F]/30 bg-[#D1A34F]/10 px-4 py-3 text-sm text-[#FDFBF7]/80">
          Your claim is under manual review since your business email didn&apos;t match a known website domain. You
          can preview your dashboard and feed now — official badges and owner replies go live once verified.
        </div>
      ) : null}

      {metrics ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricTile label="Stamps Collected" value={metrics.totalStamps.toLocaleString()} />
          <MetricTile label="Avg Plate Rating" value={`${metrics.averageRating.toFixed(1)} / 5.0`} />
          <MetricTile label="Points Awarded" value={metrics.totalPoints.toLocaleString()} />
          <MetricTile label="Story Shares" value={metrics.totalStoryShares.toLocaleString()} />
        </div>
      ) : null}

      <div>
        <h2 className="mb-3 font-serif text-lg font-bold text-[#FDFBF7]">Live Customer Feed</h2>
        <CustomerFeed merchant={merchant} />
      </div>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#D1A34F]/20 bg-white/[0.03] p-4 text-center">
      <p className="text-xl font-bold text-[#FDFBF7]">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wide text-[#FDFBF7]/50">{label}</p>
    </div>
  );
}
