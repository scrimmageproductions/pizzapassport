"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Pencil, X } from "lucide-react";
import clsx from "clsx";
import { useLocalProfile } from "@/lib/useLocalProfile";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Entry } from "@/lib/types";
import PlateRating from "@/components/PlateRating";

const STAMPS_PER_PAGE = 6;

export default function PassportPage() {
  const { userId, username, isReady, setUsername } = useLocalProfile();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);

  useEffect(() => {
    if (!isReady || !userId) return;
    let cancelled = false;

    async function load() {
      const supabase = getBrowserSupabaseClient();
      const { data } = await supabase
        .from("entries")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .returns<Entry[]>();
      if (!cancelled) {
        setEntries(data ?? []);
        setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [isReady, userId]);

  const pages = useMemo(() => {
    const chunks: Entry[][] = [];
    for (let i = 0; i < entries.length; i += STAMPS_PER_PAGE) {
      chunks.push(entries.slice(i, i + STAMPS_PER_PAGE));
    }
    return chunks.length > 0 ? chunks : [[]];
  }, [entries]);

  const stats = useMemo(() => {
    if (entries.length === 0) {
      return { total: 0, topCrust: "—", avgRating: 0 };
    }
    const crustCounts = new Map<string, number>();
    let ratingSum = 0;
    for (const entry of entries) {
      crustCounts.set(entry.crust_type, (crustCounts.get(entry.crust_type) ?? 0) + 1);
      ratingSum += entry.rating;
    }
    const topCrust = [...crustCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    return { total: entries.length, topCrust, avgRating: ratingSum / entries.length };
  }, [entries]);

  if (!isReady || isLoading) {
    return <p className="py-20 text-center text-mozzarella/50">Loading your passport…</p>;
  }

  return (
    <div className="space-y-6">
      <header className="text-center">
        <UsernameEditor username={username} onSave={setUsername} />
        <p className="text-sm text-mozzarella/50">
          Every stamp, one page at a time — public at{" "}
          <Link href={`/u/${username}`} className="text-crust hover:underline">
            /u/{username}
          </Link>
        </p>
      </header>

      <div className="grid grid-cols-3 gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
        <Stat label="Slices" value={String(stats.total)} />
        <Stat label="Top Crust" value={stats.topCrust} />
        <Stat label="Avg Plates" value={stats.avgRating.toFixed(1)} />
      </div>

      {entries.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <AnimatePresence mode="wait">
            <motion.div
              key={pageIndex}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25 }}
              className="rounded-3xl border border-white/10 bg-white/[0.03] p-6"
            >
              <div className="mb-4 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-crust">
                <span>Page {pageIndex + 1}</span>
                <span>✈️</span>
              </div>
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
                {pages[pageIndex].map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => setSelectedEntry(entry)}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-tomato/30 bg-white/5 p-3">
                      {entry.stamp_image_url ? (
                        <Image
                          src={entry.stamp_image_url}
                          alt={entry.restaurant_name}
                          width={72}
                          height={72}
                          className="object-contain"
                        />
                      ) : (
                        <span className="text-3xl">🍕</span>
                      )}
                    </div>
                    <span className="max-w-[6rem] truncate text-xs font-semibold text-mozzarella">
                      {entry.restaurant_name}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>

          {pages.length > 1 ? (
            <div className="flex items-center justify-center gap-2">
              {pages.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setPageIndex(index)}
                  className={clsx(
                    "h-2 w-2 rounded-full transition",
                    index === pageIndex ? "bg-tomato" : "bg-white/15"
                  )}
                  aria-label={`Go to page ${index + 1}`}
                />
              ))}
            </div>
          ) : null}
        </>
      )}

      <EntryModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
    </div>
  );
}

function UsernameEditor({
  username,
  onSave,
}: {
  username: string;
  onSave: (v: string) => Promise<{ error?: string }>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(username);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => setValue(username), [username]);

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="group inline-flex items-center gap-1.5">
        <h1 className="font-serif text-2xl font-bold text-mozzarella">@{username}&apos;s Passport</h1>
        <Pencil className="h-3.5 w-3.5 text-mozzarella/30 opacity-0 transition group-hover:opacity-100" />
      </button>
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    const result = await onSave(value);
    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      setEditing(false);
    }
  }

  return (
    <div className="mx-auto mb-1 flex max-w-xs flex-col items-center gap-2">
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-center text-mozzarella focus:border-tomato focus:outline-none"
        />
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-tomato px-3 py-1.5 text-sm font-bold text-mozzarella disabled:opacity-50"
        >
          {saving ? "…" : "Save"}
        </button>
      </div>
      {error ? <p className="text-xs text-tomato">{error}</p> : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="truncate text-lg font-bold text-mozzarella">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-mozzarella/50">{label}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center">
      <span className="text-4xl">🍕</span>
      <h2 className="font-serif text-xl font-bold text-mozzarella">Your passport is empty</h2>
      <p className="text-sm text-mozzarella/60">Check in at your first pizzeria to earn a stamp.</p>
      <Link href="/check-in" className="rounded-full bg-tomato px-6 py-2.5 text-sm font-bold text-mozzarella">
        Check In
      </Link>
    </div>
  );
}

function EntryModal({ entry, onClose }: { entry: Entry | null; onClose: () => void }) {
  if (!entry) return null;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-charcoal p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="font-serif text-xl font-bold text-mozzarella">{entry.restaurant_name}</h3>
            <p className="text-xs uppercase tracking-wide text-mozzarella/50">
              {entry.crust_type} ·{" "}
              {new Date(entry.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          <button onClick={onClose} className="text-mozzarella/50 hover:text-mozzarella">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <div className="relative aspect-square overflow-hidden rounded-xl">
            <Image src={entry.venue_photo_url} alt="Venue" fill className="object-cover" />
          </div>
          <div className="relative aspect-square overflow-hidden rounded-xl">
            <Image src={entry.selfie_photo_url} alt="Selfie" fill className="object-cover" />
          </div>
        </div>

        <PlateRating value={entry.rating} readOnly />

        <Link
          href={`/story/${entry.id}`}
          className="mt-5 block rounded-full bg-tomato px-4 py-2.5 text-center text-sm font-bold text-mozzarella"
        >
          Create Story
        </Link>
      </div>
    </div>
  );
}
