"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { toPng } from "html-to-image";
import QRCode from "qrcode";
import { Download, Share2, Loader2 } from "lucide-react";
import clsx from "clsx";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Entry, Profile } from "@/lib/types";

type Palette = "tomato" | "mozzarella" | "basil" | "charcoal";

const PALETTES: Record<Palette, { bg: string; text: string; accent: string }> = {
  tomato: { bg: "linear-gradient(180deg, #C8102E 0%, #1C1C1E 100%)", text: "#FFFDD0", accent: "#D1A34F" },
  mozzarella: { bg: "linear-gradient(180deg, #FFFDD0 0%, #D1A34F 100%)", text: "#1C1C1E", accent: "#C8102E" },
  basil: { bg: "linear-gradient(180deg, #2E7D32 0%, #1C1C1E 100%)", text: "#FFFDD0", accent: "#D1A34F" },
  charcoal: { bg: "linear-gradient(180deg, #1C1C1E 0%, #000000 100%)", text: "#FFFDD0", accent: "#D1A34F" },
};

export default function StoryPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id as string);
  const canvasRef = useRef<HTMLDivElement>(null);

  const [entry, setEntry] = useState<Entry | null>(null);
  const [username, setUsername] = useState<string>("pizzalover");
  const [palette, setPalette] = useState<Palette>("tomato");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [notFoundState, setNotFoundState] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      const supabase = getBrowserSupabaseClient();
      const { data: entryData } = await supabase.from("entries").select("*").eq("id", id).single<Entry>();

      if (!entryData) {
        if (!cancelled) {
          setNotFoundState(true);
          setIsLoading(false);
        }
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", entryData.user_id)
        .single<Profile>();

      const profileUsername = profileData?.username ?? "pizzalover";
      const qrTarget = `${window.location.origin}/u/${profileUsername}`;
      const qrDataUrl = await QRCode.toDataURL(qrTarget, {
        margin: 1,
        width: 240,
        color: { dark: "#1C1C1E", light: "#FFFDD0" },
      });

      if (!cancelled) {
        setEntry(entryData);
        setUsername(profileUsername);
        setQrCode(qrDataUrl);
        setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleExport() {
    if (!canvasRef.current) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(canvasRef.current, { pixelRatio: 3 });
      const link = document.createElement("a");
      link.download = `pizza-passport-${entry?.restaurant_name ?? "stamp"}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setIsExporting(false);
    }
  }

  if (isLoading) {
    return <p className="py-20 text-center text-mozzarella/50">Loading your story…</p>;
  }
  if (notFoundState || !entry) {
    return <p className="py-20 text-center text-mozzarella/50">That check-in couldn&apos;t be found.</p>;
  }

  const theme = PALETTES[palette];

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6">
      <div
        ref={canvasRef}
        className="flex aspect-[9/16] w-full max-w-sm flex-col justify-between overflow-hidden rounded-3xl p-6 shadow-2xl"
        style={{ background: theme.bg, color: theme.text }}
      >
        <p className="text-center text-xs font-black tracking-[0.3em]">PIZZA PASSPORT</p>

        <div className="grid grid-cols-2 gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={entry.venue_photo_url} alt="Venue" className="aspect-square w-full rounded-2xl object-cover" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={entry.selfie_photo_url} alt="Selfie" className="aspect-square w-full rounded-2xl object-cover" />
        </div>

        <div className="flex flex-col items-center gap-1">
          {entry.stamp_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={entry.stamp_image_url} alt="Ink stamp" className="h-20 w-20 object-contain" />
          ) : null}
          <p className="font-serif text-xl font-bold">{entry.restaurant_name}</p>
          <p className="text-xs opacity-70">
            {new Date(entry.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          <p className="text-sm font-bold" style={{ color: theme.accent }}>
            🍽️ {entry.rating.toFixed(1)} Plates
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold">@{username}</p>
            <p className="text-[10px] opacity-60">pizzapassport.app</p>
          </div>
          {qrCode ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrCode} alt="QR code" className="h-14 w-14 rounded-md bg-white p-1" />
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {(Object.keys(PALETTES) as Palette[]).map((key) => (
          <button
            key={key}
            onClick={() => setPalette(key)}
            className={clsx(
              "h-8 w-8 rounded-full border-2 transition",
              palette === key ? "border-mozzarella" : "border-transparent"
            )}
            style={{ background: PALETTES[key].bg }}
            aria-label={`${key} palette`}
          />
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="flex items-center gap-2 rounded-full bg-tomato px-5 py-2.5 text-sm font-bold text-mozzarella disabled:opacity-50"
        >
          {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Save PNG
        </button>
        <ShareButton canvasRef={canvasRef} restaurantName={entry.restaurant_name} />
      </div>
    </div>
  );
}

function ShareButton({
  canvasRef,
  restaurantName,
}: {
  canvasRef: React.RefObject<HTMLDivElement>;
  restaurantName: string;
}) {
  const [isSharing, setIsSharing] = useState(false);

  async function handleShare() {
    if (!canvasRef.current) return;
    setIsSharing(true);
    try {
      const dataUrl = await toPng(canvasRef.current, { pixelRatio: 3 });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `pizza-passport-${restaurantName}.png`, { type: "image/png" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "My Pizza Passport Stamp" });
      } else {
        const link = document.createElement("a");
        link.download = file.name;
        link.href = dataUrl;
        link.click();
      }
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <button
      onClick={handleShare}
      disabled={isSharing}
      className="flex items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 text-sm font-bold text-mozzarella disabled:opacity-50"
    >
      {isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
      Share
    </button>
  );
}
