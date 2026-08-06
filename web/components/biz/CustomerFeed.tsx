"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Loader2, MessageSquare } from "lucide-react";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Entry, Merchant } from "@/lib/types";

interface FeedEntry extends Entry {
  profiles: { username: string } | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Live feed of every check-in at this merchant's pizzeria, newest first —
 * "live" via an actual Supabase Realtime subscription on `public.entries`
 * (not polling), so a new check-in appears while the dashboard is open.
 * Each card lets the verified owner attach one reply, which is written
 * exclusively through the `submit_owner_reply` RPC (see
 * schema_merchants.sql) rather than a direct table update.
 */
export default function CustomerFeed({ merchant }: { merchant: Merchant }) {
  const [entries, setEntries] = useState<FeedEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = getBrowserSupabaseClient();

    async function load() {
      try {
        const { data, error } = await supabase
          .from("entries")
          .select("*, profiles(username)")
          .eq("place_id", merchant.place_id)
          .order("created_at", { ascending: false })
          .returns<FeedEntry[]>();
        if (error) throw error;
        if (!cancelled) setEntries(data ?? []);
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Couldn't load your customer feed.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();

    // Real-time: a fresh check-in at this pizzeria appears immediately
    // without a page refresh. New rows arrive without the `profiles` join,
    // so we patch in a placeholder username rather than firing a second
    // query per event.
    const channel = supabase
      .channel(`entries-place-${merchant.place_id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "entries", filter: `place_id=eq.${merchant.place_id}` },
        (payload) => {
          const newEntry = payload.new as Entry;
          setEntries((current) => [{ ...newEntry, profiles: null }, ...current]);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [merchant.place_id]);

  if (isLoading) {
    return (
      <p className="flex items-center justify-center gap-2 py-10 text-sm text-[#FDFBF7]/50">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your customer feed…
      </p>
    );
  }
  if (loadError) {
    return <p className="rounded-xl border border-tomato/40 bg-tomato/10 px-4 py-3 text-sm text-tomato">{loadError}</p>;
  }
  if (entries.length === 0) {
    return (
      <p className="rounded-2xl border border-[#D1A34F]/20 bg-white/[0.03] p-8 text-center text-sm text-[#FDFBF7]/50">
        No check-ins at your pizzeria yet — once a customer stamps their passport here, they&apos;ll show up live.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map((entry) => (
        <CustomerEntryCard key={entry.id} entry={entry} merchant={merchant} />
      ))}
    </div>
  );
}

function CustomerEntryCard({ entry, merchant }: { entry: FeedEntry; merchant: Merchant }) {
  const [ownerReply, setOwnerReply] = useState(entry.owner_reply);
  const [ownerRepliedAt, setOwnerRepliedAt] = useState(entry.owner_replied_at);
  const [draft, setDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const username = entry.profiles?.username ?? "a pizza lover";

  async function handleReply() {
    if (!draft.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const supabase = getBrowserSupabaseClient();
      const { error: rpcError } = await supabase.rpc("submit_owner_reply", {
        p_entry_id: entry.id,
        p_reply: draft.trim(),
      });
      if (rpcError) throw rpcError;
      setOwnerReply(draft.trim());
      setOwnerRepliedAt(new Date().toISOString());
      setDraft("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Couldn't send your reply.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-[#D1A34F]/20 bg-white/[0.03]">
      <div className="grid grid-cols-2 gap-px bg-black/40">
        <div className="relative aspect-square">
          <Image src={entry.venue_photo_url} alt="Venue" fill sizes="50vw" className="object-cover" />
        </div>
        <div className="relative aspect-square">
          <Image src={entry.selfie_photo_url} alt="Selfie" fill sizes="50vw" className="object-cover" />
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-[#FDFBF7]">@{username}</p>
            <p className="text-xs uppercase tracking-wide text-[#FDFBF7]/40">
              {entry.crust_type} · {formatDate(entry.created_at)}
            </p>
          </div>
          <p className="shrink-0 text-sm font-bold text-[#D1A34F]">🍽️ {entry.rating.toFixed(1)}</p>
        </div>

        {ownerReply ? (
          <div className="mt-3 rounded-xl border border-[#D1A34F]/30 bg-[#D1A34F]/10 p-3">
            <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#D1A34F]">
              <MessageSquare className="h-3 w-3" /> Official Pizzeria Response
            </p>
            <p className="text-sm text-[#FDFBF7]/90">{ownerReply}</p>
            {ownerRepliedAt ? <p className="mt-1 text-[10px] text-[#FDFBF7]/30">{formatDate(ownerRepliedAt)}</p> : null}
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Reply as ${merchant.business_name}…`}
              rows={2}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-[#FDFBF7] placeholder:text-[#FDFBF7]/30 focus:border-[#D1A34F] focus:outline-none"
            />
            {error ? <p className="text-xs text-tomato">{error}</p> : null}
            <button
              onClick={handleReply}
              disabled={isSubmitting || !draft.trim()}
              className="flex items-center gap-2 rounded-full bg-[#D1A34F] px-4 py-1.5 text-xs font-bold text-[#1C1201] disabled:opacity-40"
            >
              {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Post Reply
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
