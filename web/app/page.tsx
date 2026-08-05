"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, BookOpen, Smartphone, Loader2 } from "lucide-react";
import { generateInkStamp, createLetterLogoDataUrl, seedFromString } from "@/lib/stampFilter";
import { INK_COLORS, type InkColor } from "@/lib/constants";

export default function HomePage() {
  const [name, setName] = useState("Lucali");
  const [inkColor, setInkColor] = useState<InkColor>("red");
  const [stamp, setStamp] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  async function runDemo() {
    if (!name.trim()) return;
    setIsGenerating(true);
    try {
      // The live demo has no restaurant logo to fetch, so it stamps a
      // letter-glyph "logo" instead — this exercises the exact same Canvas
      // pipeline used for real check-ins (see lib/stampFilter.ts).
      const logo = createLetterLogoDataUrl(name.trim()[0] ?? "P");
      const stampUrl = await generateInkStamp(logo, { inkColor, seed: seedFromString(name) });
      setStamp(stampUrl);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="space-y-16 py-8">
      <section className="space-y-5 text-center">
        <h1 className="font-serif text-4xl font-bold leading-tight text-mozzarella sm:text-5xl">
          Your pizza journey,
          <br />
          <span className="text-tomato">stamped.</span>
        </h1>
        <p className="mx-auto max-w-md text-mozzarella/60">
          Check in at every pizzeria, collect distressed ink stamps, and
          export Spotify-Wrapped-style stories — right from your browser.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/passport"
            className="flex items-center gap-2 rounded-full bg-tomato px-6 py-3 text-sm font-bold text-mozzarella"
          >
            <BookOpen className="h-4 w-4" />
            Open Web Passport
          </Link>
          <a
            href="https://apps.apple.com/app/pizza-passport"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-bold text-mozzarella/80"
          >
            <Smartphone className="h-4 w-4" />
            Download for iOS
          </a>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <div className="mb-5 flex items-center gap-2 text-crust">
          <Sparkles className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-wide">Live Demo</span>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 sm:items-center">
          <div className="space-y-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Type a restaurant name…"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-mozzarella placeholder:text-mozzarella/30 focus:border-tomato focus:outline-none"
            />
            <div className="flex gap-3">
              {(Object.keys(INK_COLORS) as InkColor[]).map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setInkColor(color)}
                  className="h-8 w-8 rounded-full border-2 transition"
                  style={{
                    backgroundColor: INK_COLORS[color],
                    borderColor: inkColor === color ? "#FFFDD0" : "transparent",
                  }}
                  aria-label={`${color} ink`}
                />
              ))}
            </div>
            <button
              onClick={runDemo}
              disabled={isGenerating}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-tomato px-4 py-3 text-sm font-bold text-mozzarella disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Generate Stamp
            </button>
          </div>

          <div className="flex h-48 items-center justify-center rounded-2xl border-2 border-dashed border-white/10 bg-black/20">
            {stamp ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={stamp} alt="Generated ink stamp" className="h-36 w-36 object-contain" />
            ) : (
              <span className="text-sm text-mozzarella/30">Your stamp appears here</span>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <FeatureCard
          icon="🍕"
          title="Collect Stamps"
          desc="A real rubber-ink texture, generated live in your browser via Canvas."
        />
        <FeatureCard
          icon="🍽️"
          title="Rate in Plates"
          desc="1–5 Plates with half-plate precision, no stars in sight."
        />
        <FeatureCard
          icon="📸"
          title="Share Your Story"
          desc="Export a 9:16 Spotify-Wrapped-style card with one tap."
        />
      </section>

      <p className="text-center text-sm text-mozzarella/60">
        Have a passport already? Visit{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5 text-crust">/u/&lt;username&gt;</code>.
      </p>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
      <div className="mb-2 text-3xl">{icon}</div>
      <h3 className="mb-1 font-serif text-lg font-bold text-mozzarella">{title}</h3>
      <p className="text-sm text-mozzarella/50">{desc}</p>
    </div>
  );
}
