"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, CheckCircle2 } from "lucide-react";
import clsx from "clsx";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import { getCurrentMerchant } from "@/lib/merchant";
import { generateInkStamp, seedFromString } from "@/lib/stampFilter";
import { INK_COLORS, type InkColor } from "@/lib/constants";
import type { Merchant } from "@/lib/types";
import StampCanvas from "@/components/StampCanvas";

const INK_LABELS: Record<InkColor, string> = {
  red: "Crimson Red",
  blue: "Tuscan Navy",
  charcoal: "Espresso Black",
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

/**
 * Lets a verified merchant upload their real logo and tune it into their
 * pizzeria's *official* rubber stamp — once saved, every future customer
 * check-in at this venue uses this stamp instead of the auto-generated
 * one (see the merchant-override check added to app/check-in/page.tsx).
 */
export default function StampCustomizerPage() {
  const router = useRouter();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [inkColor, setInkColor] = useState<InkColor>("red");
  const [textureDensity, setTextureDensity] = useState(0.6);
  const [edgeDistress, setEdgeDistress] = useState(0.3);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCurrentMerchant().then((session) => {
      if (cancelled) return;
      if (!session?.merchant) {
        router.replace("/biz/claim");
        return;
      }
      setMerchant(session.merchant);
      setInkColor((session.merchant.custom_stamp_ink_color as InkColor) || "red");
      setTextureDensity(session.merchant.stamp_texture_density);
      setEdgeDistress(session.merchant.stamp_edge_distress);
      if (session.merchant.official_logo_url) setLogoDataUrl(session.merchant.official_logo_url);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const regeneratePreview = useCallback(
    (source: string, ink: InkColor, density: number, distress: number) => {
      setIsGeneratingPreview(true);
      generateInkStamp(source, { inkColor: ink, textureDensity: density, edgeDistress: distress, seed: seedFromString(source) })
        .then((dataUrl) => setPreviewUrl(dataUrl))
        .catch(() => setError("Couldn't render a preview from that image."))
        .finally(() => setIsGeneratingPreview(false));
    },
    []
  );

  useEffect(() => {
    if (!logoDataUrl) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => regeneratePreview(logoDataUrl, inkColor, textureDensity, edgeDistress), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [logoDataUrl, inkColor, textureDensity, edgeDistress, regeneratePreview]);

  async function handleLogoChange(file: File | null) {
    if (!file) return;
    setLogoFile(file);
    setSaved(false);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setLogoDataUrl(dataUrl);
    } catch {
      setError("Couldn't read that image file.");
    }
  }

  async function handleSave() {
    if (!merchant || !logoDataUrl) return;
    setIsSaving(true);
    setError(null);
    setSaved(false);
    try {
      const supabase = getBrowserSupabaseClient();
      let logoUrl = merchant.official_logo_url;

      if (logoFile) {
        const path = `merchants/${merchant.id}/logo.png`;
        const { error: uploadError } = await supabase.storage.from("pizza-photos").upload(path, logoFile, {
          upsert: true,
          contentType: logoFile.type || "image/png",
        });
        if (uploadError) throw uploadError;
        logoUrl = supabase.storage.from("pizza-photos").getPublicUrl(path).data.publicUrl;
      }

      const { error: updateError } = await supabase
        .from("merchants")
        .update({
          official_logo_url: logoUrl,
          custom_stamp_ink_color: inkColor,
          stamp_texture_density: textureDensity,
          stamp_edge_distress: edgeDistress,
        })
        .eq("id", merchant.id);
      if (updateError) throw updateError;

      setSaved(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Couldn't save your stamp — try again.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading || !merchant) {
    return (
      <p className="flex items-center justify-center gap-2 py-20 text-sm text-[#FDFBF7]/50">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-[#FDFBF7]">Official Stamp Design</h1>
        <p className="text-sm text-[#FDFBF7]/50">
          Upload your logo and tune it into your pizzeria&apos;s official rubber stamp. Once saved, every future
          check-in at {merchant.business_name} uses this stamp automatically.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-5 rounded-2xl border border-[#D1A34F]/20 bg-white/[0.03] p-6">
          <label className="block cursor-pointer rounded-xl border-2 border-dashed border-[#D1A34F]/30 p-6 text-center hover:bg-white/5">
            <Upload className="mx-auto mb-2 h-6 w-6 text-[#D1A34F]" />
            <span className="text-sm font-semibold text-[#FDFBF7]">
              {logoFile ? logoFile.name : "Upload your logo (SVG, PNG, or JPG)"}
            </span>
            <input
              type="file"
              accept="image/*,.svg"
              className="hidden"
              onChange={(e) => handleLogoChange(e.target.files?.[0] ?? null)}
            />
          </label>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#FDFBF7]/50">Official Ink Color</p>
            <div className="flex gap-3">
              {(Object.keys(INK_LABELS) as InkColor[]).map((color) => (
                <button
                  key={color}
                  onClick={() => setInkColor(color)}
                  className={clsx(
                    "flex flex-col items-center gap-1.5 rounded-xl border px-3 py-2 text-[10px] font-semibold",
                    inkColor === color ? "border-[#D1A34F] bg-[#D1A34F]/10" : "border-white/10 text-[#FDFBF7]/60"
                  )}
                >
                  <span
                    className="h-6 w-6 rounded-full border border-white/20"
                    style={{ backgroundColor: INK_COLORS[color] }}
                  />
                  {INK_LABELS[color]}
                </button>
              ))}
            </div>
          </div>

          <SliderField
            label="Ink Texture Density"
            hint="Sparse & worn ↔ Dense & solid"
            value={textureDensity}
            onChange={setTextureDensity}
          />
          <SliderField
            label="Edge Distress Level"
            hint="Crisp edges ↔ Heavy ink bleed"
            value={edgeDistress}
            onChange={setEdgeDistress}
          />

          {error ? <p className="text-xs text-tomato">{error}</p> : null}

          <button
            onClick={handleSave}
            disabled={isSaving || !logoDataUrl}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#D1A34F] px-6 py-2.5 text-sm font-bold text-[#1C1201] disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle2 className="h-4 w-4" /> : null}
            {saved ? "Saved!" : "Save Official Stamp"}
          </button>
        </div>

        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#D1A34F]/20 bg-white/[0.03] p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#FDFBF7]/50">Live Preview</p>
          <StampCanvas stampDataUrl={previewUrl} isGenerating={isGeneratingPreview} seed={seedFromString(merchant.place_id)} size={220} />
          {!logoDataUrl ? <p className="text-xs text-[#FDFBF7]/40">Upload a logo to see your stamp.</p> : null}
        </div>
      </div>
    </div>
  );
}

function SliderField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#FDFBF7]/50">{label}</p>
        <p className="text-xs text-[#D1A34F]">{Math.round(value * 100)}%</p>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#D1A34F]"
      />
      <p className="mt-1 text-[10px] text-[#FDFBF7]/30">{hint}</p>
    </div>
  );
}
