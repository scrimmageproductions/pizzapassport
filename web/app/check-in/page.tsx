"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import confetti from "canvas-confetti";
import { MapPin, Camera, Loader2, PartyPopper } from "lucide-react";
import { useLocalProfile } from "@/lib/useLocalProfile";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import { generateInkStamp, generateNameArchStamp, dataUrlToBlob, seedFromString } from "@/lib/stampFilter";
import { fetchLogoUrl } from "@/lib/logoFetcher";
import {
  getCurrentPosition,
  reverseGeocode,
  searchNearbyPizzerias,
  haversineDistanceMeters,
  MAX_CHECKIN_DISTANCE_METERS,
  GeolocationDeniedError,
  type NearbyPlace,
  type Coordinates,
} from "@/lib/geo";
import { CRUST_TYPES, INK_COLORS, type InkColor } from "@/lib/constants";
import PlateRating from "@/components/PlateRating";
import PolaroidCard from "@/components/PolaroidCard";
import SauceSplatter from "@/components/SauceSplatter";

type Step = "place" | "photos" | "details" | "review";
const STEPS: Step[] = ["place", "photos", "details", "review"];

export default function CheckInPage() {
  return (
    <Suspense fallback={<p className="py-20 text-center text-mozzarella/50">Loading…</p>}>
      <CheckInFlow />
    </Suspense>
  );
}

/** `useSearchParams()` requires a Suspense boundary above it in the App
 * Router — see the wrapper default export. */
function CheckInFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userId, isReady, username, setUsername } = useLocalProfile();

  const [step, setStep] = useState<Step>("place");
  const [restaurantName, setRestaurantName] = useState("");
  const [city, setCity] = useState("");
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [isSearchingNearby, setIsSearchingNearby] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<NearbyPlace | null>(null);

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

  const [isFirstCheckIn, setIsFirstCheckIn] = useState(false);
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  const stepIndex = STEPS.indexOf(step);
  const autoLocateRan = useRef(false);

  // Detect whether this will be the visitor's very first check-in, so a
  // successful save can trigger the first-stamp celebration + username
  // claim nudge instead of routing straight to the story export.
  useEffect(() => {
    if (!isReady || !userId) return;
    let cancelled = false;
    async function checkFirstEntry() {
      const supabase = getBrowserSupabaseClient();
      const { count } = await supabase
        .from("entries")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      if (!cancelled) setIsFirstCheckIn((count ?? 0) === 0);
    }
    checkFirstEntry();
    return () => {
      cancelled = true;
    };
  }, [isReady, userId]);

  // One-tap entry from the passport's empty state: /check-in?lat=&lng=
  // arrives with coordinates already resolved, so nearby search can start
  // immediately without asking for location a second time.
  useEffect(() => {
    if (autoLocateRan.current) return;
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    if (lat && lng) {
      autoLocateRan.current = true;
      locateAndSearch({ lat: Number(lat), lng: Number(lng) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function locateAndSearch(position: Coordinates) {
    setCoords(position);
    setIsSearchingNearby(true);
    try {
      const [geocode, places] = await Promise.all([reverseGeocode(position), searchNearbyPizzerias(position)]);
      setCity((current) => current || geocode?.city || current);
      setNearbyPlaces(places);
    } finally {
      setIsSearchingNearby(false);
    }
  }

  async function useCurrentLocation() {
    setLocating(true);
    setLocationError(null);
    try {
      const position = await getCurrentPosition();
      await locateAndSearch(position);
    } catch (error) {
      if (error instanceof GeolocationDeniedError) {
        setLocationError("Location access was denied — search for your pizzeria manually below.");
      } else {
        setLocationError(error instanceof Error ? error.message : "Couldn't determine your location.");
      }
    } finally {
      setLocating(false);
    }
  }

  function selectNearbyPlace(place: NearbyPlace) {
    setSelectedPlace(place);
    setRestaurantName(place.name);
  }

  function clearSelectedPlace() {
    setSelectedPlace(null);
  }

  const distanceToSelectedPlace = useMemo(() => {
    if (!coords || !selectedPlace) return null;
    return haversineDistanceMeters(coords, { lat: selectedPlace.lat, lng: selectedPlace.lng });
  }, [coords, selectedPlace]);

  const isTooFar = distanceToSelectedPlace !== null && distanceToSelectedPlace > MAX_CHECKIN_DISTANCE_METERS;

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

  const canAdvance = useMemo(() => {
    switch (step) {
      case "place":
        return restaurantName.trim().length > 0 && coords !== null && !isTooFar;
      case "photos":
        return venueFile !== null && selfieFile !== null;
      case "details":
        return true;
      case "review":
        return stampPreview !== null;
      default:
        return false;
    }
  }, [step, restaurantName, coords, isTooFar, venueFile, selfieFile, stampPreview]);

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

      // Prefer the geocoded venue's coordinates (more precise than a phone's
      // live GPS fix) when a nearby place was selected; fall back to the
      // device's own position for manually-typed entries.
      const entryCoords = selectedPlace ? { lat: selectedPlace.lat, lng: selectedPlace.lng } : coords;

      const { error: insertError } = await supabase.from("entries").insert({
        id: entryId,
        user_id: userId,
        restaurant_name: restaurantName,
        latitude: entryCoords.lat,
        longitude: entryCoords.lng,
        rating,
        crust_type: crust,
        venue_photo_url: venueUrl,
        selfie_photo_url: selfieUrl,
        stamp_image_url: stampUrl,
        ink_color: inkColor,
        place_id: selectedPlace?.id ?? null,
      });
      if (insertError) throw insertError;

      setSavedEntryId(entryId);
      if (isFirstCheckIn) {
        setShowCelebration(true);
      } else {
        router.push(`/story/${entryId}`);
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Something went wrong saving your check-in.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isReady) {
    return <p className="py-20 text-center text-mozzarella/50">Setting up your passport…</p>;
  }

  if (showCelebration && savedEntryId) {
    return (
      <FirstStampCelebration
        stampPreview={stampPreview}
        restaurantName={restaurantName}
        username={username}
        onClaim={setUsername}
        onContinue={() => router.push(`/story/${savedEntryId}`)}
      />
    );
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
            nearbyPlaces={nearbyPlaces}
            isSearchingNearby={isSearchingNearby}
            selectedPlace={selectedPlace}
            onSelectPlace={selectNearbyPlace}
            onClearPlace={clearSelectedPlace}
            distanceToSelectedPlace={distanceToSelectedPlace}
            isTooFar={isTooFar}
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

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function PlaceStep(props: {
  restaurantName: string;
  onNameChange: (v: string) => void;
  city: string;
  onCityChange: (v: string) => void;
  coords: Coordinates | null;
  locating: boolean;
  locationError: string | null;
  onUseLocation: () => void;
  nearbyPlaces: NearbyPlace[];
  isSearchingNearby: boolean;
  selectedPlace: NearbyPlace | null;
  onSelectPlace: (place: NearbyPlace) => void;
  onClearPlace: () => void;
  distanceToSelectedPlace: number | null;
  isTooFar: boolean;
}) {
  return (
    <div className="space-y-4">
      <SectionTitle>Where&apos;s the pizza?</SectionTitle>

      <button
        onClick={props.onUseLocation}
        type="button"
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-basil/40 bg-basil/10 px-4 py-3 text-sm font-semibold text-basil"
      >
        <MapPin className="h-4 w-4" />
        {props.locating ? "Locating…" : props.coords ? "Refresh nearby pizzerias" : "Find pizzerias near me"}
      </button>
      {props.locationError ? <p className="text-xs text-tomato">{props.locationError}</p> : null}

      {props.isSearchingNearby ? (
        <p className="flex items-center justify-center gap-2 py-2 text-sm text-mozzarella/50">
          <Loader2 className="h-4 w-4 animate-spin" /> Searching nearby…
        </p>
      ) : props.nearbyPlaces.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-mozzarella/50">Nearby Pizzerias</p>
          <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
            {props.nearbyPlaces.map((place) => {
              const active = props.selectedPlace?.id === place.id;
              return (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => props.onSelectPlace(place)}
                  className={clsx(
                    "flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-left transition",
                    active ? "border-tomato bg-tomato/10" : "border-white/10 bg-white/5 hover:bg-white/10"
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-mozzarella">{place.name}</span>
                    {place.address ? (
                      <span className="block truncate text-xs text-mozzarella/40">{place.address}</span>
                    ) : null}
                  </span>
                  <span className="ml-3 shrink-0 text-xs font-semibold text-crust">
                    {formatDistance(place.distanceMeters)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {props.selectedPlace ? (
        <div
          className={clsx(
            "flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm",
            props.isTooFar ? "border-tomato/60 bg-tomato/10 text-tomato" : "border-basil/40 bg-basil/10 text-basil"
          )}
        >
          <span>
            {props.isTooFar
              ? `You're ${formatDistance(props.distanceToSelectedPlace ?? 0)} away — get closer to check in here.`
              : `✓ ${formatDistance(props.distanceToSelectedPlace ?? 0)} away — close enough!`}
          </span>
          <button type="button" onClick={props.onClearPlace} className="shrink-0 underline">
            Change
          </button>
        </div>
      ) : null}

      <div className="flex items-center gap-3 py-1 text-xs text-mozzarella/30">
        <span className="h-px flex-1 bg-white/10" />
        or enter it yourself
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <input
        value={props.restaurantName}
        onChange={(e) => {
          props.onNameChange(e.target.value);
          if (props.selectedPlace) props.onClearPlace();
        }}
        placeholder="Restaurant name"
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-mozzarella placeholder:text-mozzarella/30 focus:border-tomato focus:outline-none"
      />
      <input
        value={props.city}
        onChange={(e) => props.onCityChange(e.target.value)}
        placeholder="City (optional)"
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-mozzarella placeholder:text-mozzarella/30 focus:border-tomato focus:outline-none"
      />

      <p className="text-xs text-mozzarella/40">
        Nearby pizzerias are found via OpenStreetMap — free, no API key required. Manually-typed spots skip the
        distance check.
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

/**
 * Shown once, right after a visitor's very first successful check-in:
 * a celebratory moment plus a low-friction nudge to claim a memorable
 * username (already a fully-working rename, not a stub) — "create a full
 * account" (email/Google) lands in a follow-up phase once magic-link/OAuth
 * upgrade is wired in, so it isn't offered here yet.
 */
function FirstStampCelebration({
  stampPreview,
  restaurantName,
  username,
  onClaim,
  onContinue,
}: {
  stampPreview: string | null;
  restaurantName: string;
  username: string;
  onClaim: (v: string) => Promise<{ error?: string }>;
  onContinue: () => void;
}) {
  const [handle, setHandle] = useState(username);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    confetti({
      particleCount: 140,
      spread: 100,
      origin: { y: 0.4 },
      colors: ["#C8102E", "#FFFDD0", "#D1A34F", "#2E7D32"],
    });
  }, []);

  async function handleClaim() {
    setClaiming(true);
    setError(null);
    const result = await onClaim(handle);
    setClaiming(false);
    if (result.error) {
      setError(result.error);
    } else {
      setClaimed(true);
    }
  }

  return (
    <div className="relative mx-auto flex max-w-md flex-col items-center gap-5 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
      <div aria-hidden="true" className="absolute inset-0 bg-cornmeal opacity-[0.16]" />
      <SauceSplatter className="absolute -right-6 -top-6" size={120} opacity={0.3} />

      <div className="relative flex flex-col items-center gap-4">
        <PartyPopper className="h-10 w-10 text-crust" />
        <div>
          <h1 className="font-serif text-2xl font-bold text-mozzarella">Your first stamp!</h1>
          <p className="text-sm text-mozzarella/60">{restaurantName} is officially in your passport.</p>
        </div>

        {stampPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={stampPreview} alt="Ink stamp" className="h-32 w-32 object-contain" />
        ) : null}

        <div className="w-full rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="mb-3 text-sm font-semibold text-mozzarella">
            {claimed ? "✓ Your passport handle is set!" : "Claim your passport name"}
          </p>
          {claimed ? (
            <p className="text-sm text-crust">@{handle}</p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <input
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center text-mozzarella focus:border-tomato focus:outline-none"
                />
                <button
                  onClick={handleClaim}
                  disabled={claiming}
                  className="shrink-0 rounded-lg bg-tomato px-4 py-2 text-sm font-bold text-mozzarella disabled:opacity-50"
                >
                  {claiming ? "…" : "Save"}
                </button>
              </div>
              {error ? <p className="mt-2 text-xs text-tomato">{error}</p> : null}
              <p className="mt-2 text-xs text-mozzarella/40">
                This becomes your public link: pizzapassport.app/u/{handle || "you"}
              </p>
            </>
          )}
        </div>

        <button onClick={onContinue} className="rounded-full bg-tomato px-6 py-2.5 text-sm font-bold text-mozzarella">
          See My Story →
        </button>
      </div>
    </div>
  );
}
