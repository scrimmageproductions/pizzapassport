"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import confetti from "canvas-confetti";
import { MapPin, Camera, Loader2 } from "lucide-react";
import { useLocalProfile } from "@/lib/useLocalProfile";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import { generateInkStamp, generateNameArchStamp, dataUrlToBlob, seedFromString } from "@/lib/stampFilter";
import { fetchLogoUrl } from "@/lib/logoFetcher";
import { CRUST_TYPES, INK_COLORS, type InkColor } from "@/lib/constants";
import PlateRating from "@/components/PlateRating";
import PolaroidCard from "@/components/PolaroidCard";
import SauceSplatter from "@/components/SauceSplatter";

type Step = "place" | "photos" | "details" | "review";
const STEPS: Step[] = ["place", "photos", "details", "review"];

export default function CheckInPage() {
  const router = useRouter();
  const { userId, isReady } = useLocalProfile();

  const [step, setStep] = useState<Step>("place");
  const [restaurantName, setRestaurantName] = useState("");
  const [city, setCity] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [venueFile, setVenueFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [venuePreview, setVenuePreview] = useState<string | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);

  const [rating, setRating] = useState(4);
  const [crust, setCrust] = useState<string>(CRUST_TYPES[1]);
  const [inkColor, setInkColor] = useState<InkColor>("red");

  const [stampPreview, setStampPreview] = useState<string | null>(null);
  const [isGeneratingStamp, setIsGeneratingStamp] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [usePolaroidPreview, setUsePolaroidPreview] = useState(false);

  const stepIndex = STEPS.indexOf(step);

  function handleFile(kind: "venue" | "selfie", file: File | null) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (kind === "venue") {
      setVenueFile(file);
      setVenuePreview(url);
    } else {
      setSelfieFile(file);
      setSelfiePreview(url);
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationError("Geolocation isn't available in this browser.");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocating(false);
      },
      (error) => {
        setLocationError(error.message);
        setLocating(false);
      }
    );
  }

  const canAdvance = useMemo(() => {
    switch (step) {
      case "place":
        return restaurantName.trim().length > 0 && coords !== null;
      case "photos":
        return venueFile !== null && selfieFile !== null;
      case "details":
        return true;
      case "review":
        return stampPreview !== null;
      default:
        return false;
    }
  }, [step, restaurantName, coords, venueFile, selfieFile, stampPreview]);

  async function goNext() {
    if (step === "details" && !stampPreview) {
      setIsGeneratingStamp(true);
      try {
        const seed = seedFromString(restaurantName + inkColor);
        // 3-tier international logo fetch (Places photo -> Clearbit/
        // Brandfetch -> favicon); if all three come up empty, fall back to
        // the full-name arch stamp instead of ever truncating to a letter.
        const logo = await fetchLogoUrl(restaurantName);
        const dataUrl = logo
          ? await generateInkStamp(logo.url, { inkColor, seed })
          : await generateNameArchStamp(restaurantName, city, { inkColor, seed });
        setStampPreview(dataUrl);
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#C8102E", "#FFFDD0", "#D1A34F"],
        });
      } finally {
        setIsGeneratingStamp(false);
      }
    }
    const nextIndex = stepIndex + 1;
    if (nextIndex < STEPS.length) setStep(STEPS[nextIndex]);
  }

  function goBack() {
    const prevIndex = stepIndex - 1;
    if (prevIndex >= 0) setStep(STEPS[prevIndex]);
  }

  async function saveEntry() {
    if (!userId || !venueFile || !selfieFile || !coords || !stampPreview) return;
    setIsSaving(true);
    setSaveError(null);

    try {
      const supabase = getBrowserSupabaseClient();
      const entryId = crypto.randomUUID();

      const [venueUpload, selfieUpload] = await Promise.all([
        supabase.storage.from("pizza-photos").upload(`${entryId}/venue.jpg`, venueFile, { upsert: true }),
        supabase.storage.from("pizza-photos").upload(`${entryId}/selfie.jpg`, selfieFile, { upsert: true }),
      ]);
      if (venueUpload.error) throw venueUpload.error;
      if (selfieUpload.error) throw selfieUpload.error;

      const stampBlob = dataUrlToBlob(stampPreview);
      const stampUpload = await supabase.storage
        .from("pizza-photos")
        .upload(`${entryId}/stamp.png`, stampBlob, { contentType: "image/png", upsert: true });
      if (stampUpload.error) throw stampUpload.error;

      const venueUrl = supabase.storage.from("pizza-photos").getPublicUrl(`${entryId}/venue.jpg`).data.publicUrl;
      const selfieUrl = supabase.storage.from("pizza-photos").getPublicUrl(`${entryId}/selfie.jpg`).data.publicUrl;
      const stampUrl = supabase.storage.from("pizza-photos").getPublicUrl(`${entryId}/stamp.png`).data.publicUrl;

      const { error: insertError } = await supabase.from("entries").insert({
        id: entryId,
        user_id: userId,
        restaurant_name: restaurantName,
        latitude: coords.lat,
        longitude: coords.lng,
        rating,
        crust_type: crust,
        venue_photo_url: venueUrl,
        selfie_photo_url: selfieUrl,
        stamp_image_url: stampUrl,
        ink_color: inkColor,
      });
      if (insertError) throw insertError;

      router.push(`/story/${entryId}`);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Something went wrong saving your check-in.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isReady) {
    return <p className="py-20 text-center text-mozzarella/50">Setting up your passport…</p>;
  }

  return (
    <div className="relative mx-auto max-w-xl space-y-6 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] p-6">
      <div aria-hidden="true" className="absolute inset-0 bg-cornmeal opacity-[0.14]" />
      <div className="relative space-y-6">
      <ProgressBar stepIndex={stepIndex} total={STEPS.length} />

      {step === "place" && (
        <PlaceStep
          restaurantName={restaurantName}
          onNameChange={setRestaurantName}
          city={city}
          onCityChange={setCity}
          coords={coords}
          locating={locating}
          locationError={locationError}
          onUseLocation={useCurrentLocation}
        />
      )}
      {step === "photos" && (
        <PhotosStep
          venuePreview={venuePreview}
          selfiePreview={selfiePreview}
          onVenueChange={(f) => handleFile("venue", f)}
          onSelfieChange={(f) => handleFile("selfie", f)}
        />
      )}
      {step === "details" && (
        <DetailsStep
          rating={rating}
          onRatingChange={setRating}
          crust={crust}
          onCrustChange={setCrust}
          inkColor={inkColor}
          onInkColorChange={setInkColor}
        />
      )}
      {step === "review" && (
        <ReviewStep
          isGenerating={isGeneratingStamp}
          stampPreview={stampPreview}
          restaurantName={restaurantName}
          city={city}
          rating={rating}
          venuePreview={venuePreview}
          usePolaroidPreview={usePolaroidPreview}
          onTogglePolaroid={() => setUsePolaroidPreview((v) => !v)}
        />
      )}

      {saveError ? <p className="text-center text-sm text-tomato">{saveError}</p> : null}

      <div className="flex items-center justify-between">
        {stepIndex > 0 ? (
          <button
            onClick={goBack}
            className="rounded-full border border-white/15 px-5 py-2 text-sm font-semibold text-mozzarella/70"
          >
            Back
          </button>
        ) : (
          <span />
        )}

        {step === "review" ? (
          <button
            onClick={saveEntry}
            disabled={!canAdvance || isSaving}
            className="flex items-center gap-2 rounded-full bg-tomato px-6 py-2 text-sm font-bold text-mozzarella disabled:opacity-40"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save to Passport
          </button>
        ) : (
          <button
            onClick={goNext}
            disabled={!canAdvance || isGeneratingStamp}
            className="rounded-full bg-tomato px-6 py-2 text-sm font-bold text-mozzarella disabled:opacity-40"
          >
            {isGeneratingStamp ? "Stamping…" : "Next"}
          </button>
        )}
      </div>
      </div>
    </div>
  );
}

function ProgressBar({ stepIndex, total }: { stepIndex: number; total: number }) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: total }).map((_, index) => (
        <div key={index} className={clsx("h-1 flex-1 rounded-full", index <= stepIndex ? "bg-tomato" : "bg-white/10")} />
      ))}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-serif text-xl font-bold text-mozzarella">{children}</h2>;
}

function PlaceStep(props: {
  restaurantName: string;
  onNameChange: (v: string) => void;
  city: string;
  onCityChange: (v: string) => void;
  coords: { lat: number; lng: number } | null;
  locating: boolean;
  locationError: string | null;
  onUseLocation: () => void;
}) {
  return (
    <div className="space-y-4">
      <SectionTitle>Where&apos;s the pizza?</SectionTitle>
      <input
        value={props.restaurantName}
        onChange={(e) => props.onNameChange(e.target.value)}
        placeholder="Restaurant name"
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-mozzarella placeholder:text-mozzarella/30 focus:border-tomato focus:outline-none"
      />
      <input
        value={props.city}
        onChange={(e) => props.onCityChange(e.target.value)}
        placeholder="City (optional)"
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-mozzarella placeholder:text-mozzarella/30 focus:border-tomato focus:outline-none"
      />
      <button
        onClick={props.onUseLocation}
        type="button"
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-basil/40 bg-basil/10 px-4 py-3 text-sm font-semibold text-basil"
      >
        <MapPin className="h-4 w-4" />
        {props.locating
          ? "Locating…"
          : props.coords
          ? `Pinned at ${props.coords.lat.toFixed(3)}, ${props.coords.lng.toFixed(3)}`
          : "Use my current location"}
      </button>
      {props.locationError ? <p className="text-xs text-tomato">{props.locationError}</p> : null}
      <p className="text-xs text-mozzarella/40">
        Pizza Passport pins your check-in with your device&apos;s location — a Google Places
        search can be swapped in here for exact address lookup (see .env.local.example).
      </p>
    </div>
  );
}

function PhotosStep(props: {
  venuePreview: string | null;
  selfiePreview: string | null;
  onVenueChange: (file: File | null) => void;
  onSelfieChange: (file: File | null) => void;
}) {
  return (
    <div className="space-y-4">
      <SectionTitle>Capture the moment</SectionTitle>
      <PhotoSlot label="Venue / Atmosphere" preview={props.venuePreview} onChange={props.onVenueChange} />
      <PhotoSlot label="You + the Slice" preview={props.selfiePreview} onChange={props.onSelfieChange} />
    </div>
  );
}

function PhotoSlot({
  label,
  preview,
  onChange,
}: {
  label: string;
  preview: string | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <label className="block cursor-pointer">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-mozzarella/50">{label}</span>
      <div className="relative flex h-44 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-mozzarella/40">
            <Camera className="h-6 w-6" />
            <span className="text-xs">Add Photo</span>
          </div>
        )}
      </div>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

function DetailsStep(props: {
  rating: number;
  onRatingChange: (v: number) => void;
  crust: string;
  onCrustChange: (v: string) => void;
  inkColor: InkColor;
  onInkColorChange: (v: InkColor) => void;
}) {
  return (
    <div className="space-y-6">
      <SectionTitle>Rate the slice</SectionTitle>
      <PlateRating value={props.rating} onChange={props.onRatingChange} size="lg" />

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-mozzarella/50">Crust Style</p>
        <div className="flex flex-wrap gap-2">
          {CRUST_TYPES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => props.onCrustChange(c)}
              className={clsx(
                "rounded-full px-3 py-1.5 text-sm font-medium transition",
                props.crust === c ? "bg-tomato text-mozzarella" : "bg-white/8 text-mozzarella/70 hover:bg-white/15"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-mozzarella/50">Ink Color</p>
        <div className="flex gap-3">
          {(Object.keys(INK_COLORS) as InkColor[]).map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => props.onInkColorChange(color)}
              className={clsx(
                "h-8 w-8 rounded-full border-2 transition",
                props.inkColor === color ? "border-mozzarella" : "border-transparent"
              )}
              style={{ backgroundColor: INK_COLORS[color] }}
              aria-label={`${color} ink`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ReviewStep({
  isGenerating,
  stampPreview,
  restaurantName,
  city,
  rating,
  venuePreview,
  usePolaroidPreview,
  onTogglePolaroid,
}: {
  isGenerating: boolean;
  stampPreview: string | null;
  restaurantName: string;
  city: string;
  rating: number;
  venuePreview: string | null;
  usePolaroidPreview: boolean;
  onTogglePolaroid: () => void;
}) {
  return (
    <div className="relative flex flex-col items-center gap-4 text-center">
      <SectionTitle>Your Stamp</SectionTitle>
      <div className="relative flex h-40 w-40 items-center justify-center">
        <SauceSplatter className="absolute -bottom-3 -right-3" size={70} opacity={0.35} />
        <div className="relative flex h-40 w-40 items-center justify-center rounded-full border-2 border-dashed border-tomato/30 bg-white/5">
          {isGenerating ? (
            <Loader2 className="h-8 w-8 animate-spin text-mozzarella/50" />
          ) : stampPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={stampPreview} alt="Ink stamp" className="h-32 w-32 object-contain" />
          ) : (
            <span className="text-3xl">🍕</span>
          )}
        </div>
      </div>
      <p className="font-serif text-lg font-bold text-mozzarella">{restaurantName}</p>
      <PlateRating value={rating} readOnly />

      <button
        type="button"
        onClick={onTogglePolaroid}
        className={clsx(
          "rounded-full border px-4 py-2 text-xs font-semibold transition",
          usePolaroidPreview
            ? "border-crust bg-crust/10 text-crust"
            : "border-white/15 text-mozzarella/60 hover:bg-white/5"
        )}
      >
        {usePolaroidPreview ? "✓ Polaroid Preview On" : "Preview as Polaroid"}
      </button>

      {usePolaroidPreview && venuePreview ? (
        <PolaroidCard
          photoUrl={venuePreview}
          restaurantName={restaurantName}
          location={city}
          date={new Date()}
          stampUrl={stampPreview}
          seed={seedFromString(restaurantName)}
        />
      ) : null}
    </div>
  );
}
