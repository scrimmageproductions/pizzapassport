"use client";

import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Download, Share2, Loader2 } from "lucide-react";
import clsx from "clsx";
import { seedFromString } from "@/lib/stampFilter";
import type { Entry } from "@/lib/types";
import {
  buildProfileUrl,
  downloadDataUrl,
  shareStoryImage,
  type SharePlatform,
  type ShareOutcome,
} from "@/lib/socialSharing";
import PolaroidCard from "./PolaroidCard";

type Palette = "tomato" | "mozzarella" | "basil" | "charcoal";
type Layout = "classic" | "polaroid";

const PALETTES: Record<Palette, { bg: string; text: string; accent: string }> = {
  tomato: { bg: "linear-gradient(180deg, #C8102E 0%, #1C1C1E 100%)", text: "#FFFDD0", accent: "#D1A34F" },
  mozzarella: { bg: "linear-gradient(180deg, #FFFDD0 0%, #D1A34F 100%)", text: "#1C1C1E", accent: "#C8102E" },
  basil: { bg: "linear-gradient(180deg, #2E7D32 0%, #1C1C1E 100%)", text: "#FFFDD0", accent: "#D1A34F" },
  charcoal: { bg: "linear-gradient(180deg, #1C1C1E 0%, #000000 100%)", text: "#FFFDD0", accent: "#D1A34F" },
};

const SHARE_OUTCOME_MESSAGES: Record<ShareOutcome["method"], string> = {
  "web-share": "Shared! Pick the app you want from the share sheet.",
  "clipboard+download": "Image copied and saved! Open the app and paste, or add the download to your Story.",
  download: "Image saved! Open the app to add it to your post or Story.",
  "intent+clipboard": "Opened the post composer and copied the image — paste it in.",
  dialog: "Opened the share dialog.",
};

/**
 * The vertical (9:16) story card plus its palette/layout controls and a
 * "Share Your Passport" social action bar — everything needed to turn one
 * check-in into a shareable image and get it onto Instagram, Snapchat, X,
 * or Facebook. Rendering (via `html-to-image`) and data-fetching stay
 * separate: this component takes an already-loaded `entry` and just owns
 * the export/share UX, so `app/story/[id]/page.tsx` only has to fetch data.
 */
export default function PassportStoryExporter({
  entry,
  username,
  qrCode,
}: {
  entry: Entry;
  username: string;
  qrCode: string | null;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [palette, setPalette] = useState<Palette>("tomato");
  const [layout, setLayout] = useState<Layout>("classic");
  const [isExporting, setIsExporting] = useState(false);
  const [activeShare, setActiveShare] = useState<SharePlatform | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const theme = PALETTES[palette];
  const profileUrl = buildProfileUrl(username);

  async function renderToDataUrl(): Promise<string | null> {
    if (!canvasRef.current) return null;
    return toPng(canvasRef.current, { pixelRatio: 3 });
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      const dataUrl = await renderToDataUrl();
      if (dataUrl) downloadDataUrl(dataUrl, `pizza-passport-${entry.restaurant_name}.png`);
    } finally {
      setIsExporting(false);
    }
  }

  async function handleShare(platform: SharePlatform) {
    setActiveShare(platform);
    try {
      const dataUrl = await renderToDataUrl();
      if (!dataUrl) return;
      const outcome = await shareStoryImage(platform, {
        dataUrl,
        restaurantName: entry.restaurant_name,
        profileUrl,
      });
      setToast(SHARE_OUTCOME_MESSAGES[outcome.method]);
    } finally {
      setActiveShare(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6">
      <div
        ref={canvasRef}
        className="flex aspect-[9/16] w-full max-w-sm flex-col justify-between overflow-hidden rounded-3xl p-6 shadow-2xl"
        style={{ background: theme.bg, color: theme.text }}
      >
        <p className="text-center text-xs font-black tracking-[0.3em]">PIZZA PASSPORT</p>

        {layout === "classic" ? (
          <>
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
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <PolaroidCard
              photoUrl={entry.venue_photo_url}
              restaurantName={entry.restaurant_name}
              location=""
              date={entry.created_at}
              stampUrl={entry.stamp_image_url}
              seed={seedFromString(entry.id)}
            />
            <p className="text-sm font-bold" style={{ color: theme.accent }}>
              🍽️ {entry.rating.toFixed(1)} Plates
            </p>
          </div>
        )}

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

      <div className="flex rounded-full border border-white/15 bg-white/5 p-1 text-xs font-semibold">
        {(["classic", "polaroid"] as Layout[]).map((key) => (
          <button
            key={key}
            onClick={() => setLayout(key)}
            className={clsx(
              "rounded-full px-4 py-1.5 capitalize transition",
              layout === key ? "bg-tomato text-mozzarella" : "text-mozzarella/60"
            )}
          >
            {key}
          </button>
        ))}
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

      <div className="w-full space-y-3">
        <p className="text-center text-xs font-bold uppercase tracking-wide text-mozzarella/50">
          Share Your Passport
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <ShareBadge
            label="Instagram Story"
            emoji="📸"
            className="bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#4f5bd5] text-white"
            loading={activeShare === "instagram"}
            onClick={() => handleShare("instagram")}
          />
          <ShareBadge
            label="Snapchat Story"
            emoji="👻"
            className="bg-[#FFFC00] text-[#1C1C1E]"
            loading={activeShare === "snapchat"}
            onClick={() => handleShare("snapchat")}
          />
          <ShareBadge
            label="Post to X"
            emoji="𝕏"
            className="bg-[#0f0f0f] text-white"
            loading={activeShare === "x"}
            onClick={() => handleShare("x")}
          />
          <ShareBadge
            label="Facebook"
            emoji="🟦"
            className="bg-[#1877F2] text-white"
            loading={activeShare === "facebook"}
            onClick={() => handleShare("facebook")}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-tomato px-5 py-2.5 text-sm font-bold text-mozzarella disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Save PNG
          </button>
          <button
            onClick={() => handleShare("system")}
            disabled={activeShare === "system"}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/20 px-5 py-2.5 text-sm font-bold text-mozzarella disabled:opacity-50"
          >
            {activeShare === "system" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
            System Share
          </button>
        </div>
      </div>

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full border border-white/15 bg-charcoal px-4 py-2 text-center text-xs font-semibold text-mozzarella shadow-2xl">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function ShareBadge({
  label,
  emoji,
  className,
  loading,
  onClick,
}: {
  label: string;
  emoji: string;
  className: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={clsx(
        "flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-center text-[11px] font-bold transition disabled:opacity-60",
        className
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-lg leading-none">{emoji}</span>}
      <span>{label}</span>
    </button>
  );
}
