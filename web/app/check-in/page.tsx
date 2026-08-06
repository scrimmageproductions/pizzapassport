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
  synthesizePlaceId,
  MAX_CHECKIN_DISTANCE_METERS,
  GeolocationDeniedError,
  type NearbyPlace,
  type Coordinates,
} from "@/lib/geo";
import { CRUST_TYPES, INK_COLORS, POINTS_BASE_CHECKIN, POINTS_MENU_PHOTO_BONUS, type InkColor } from "@/lib/constants";
import { loadLocalEntries, saveLocalEntry, saveLocalMoment, compressImageToDataUrl } from "@/lib/localEntries";
import type { Merchant } from "@/lib/types";
import PlateRating from "@/components/PlateRating";
import PolaroidCard from "@/components/PolaroidCard";
import StampCanvas from "@/components/StampCanvas";
import SauceSplatter from "@/components/SauceSplatter";
import MomentComposer from "@/components/MomentComposer";
import GoogleReviewPrompt from "@/components/GoogleReviewPrompt";

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
  const { userId, isReady, username, isOfflineMode, setUsername } = useLocalProfile();

  const [step, setStep] = useState<Step>("place");
  const [restaurantName, setRestaurantName] = useState("");
  const [city, setCity] = useState("");
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [isSearchingNearby, setIsSearchingNearby] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<NearbyPlace | null>(null);

  const [venueFile, setVenueFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [menuFile, setMenuFile] = useState<File | null>(null);
  const [venuePreview, setVenuePreview] = useState<string | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [menuPreview, setMenuPreview] = useState<string | null>(null);

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
  // Screens shown after a successful save, in order: the first-ever-stamp
  // celebration (only for a visitor's first check-in), then an optional
  // Moment (photo/note) capture, then an optional Google review nudge —
  // each stage is skippable and falls through to the next.
  const [postSaveStage, setPostSaveStage] = useState<"celebration" | "moment" | "review" | null>(null);
  const [momentNote, setMomentNote] = useState("");

  const stepIndex = STEPS.indexOf(step);
  const autoLocateRan = useRef(false);

  // Detect whether this will be the visitor's very first check-in, so a
  // successful save can trigger the first-stamp celebration + username
  // claim nudge instead of routing straight to the story export.
  useEffect(() => {
    if (!isReady || !userId) return;
    let cancelled = false;
    async function checkFirstEntry() {
      if (isOfflineMode) {
        if (!cancelled) setIsFirstCheckIn(loadLocalEntries().length === 0);
        return;
      }
      try {
        const supabase = getBrowserSupabaseClient();
        const { count, error } = await supabase
          .from("entries")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId);
        if (error) throw error;
        if (!cancelled) setIsFirstCheckIn((count ?? 0) === 0);
      } catch {
        // Non-critical — worst case a returning visitor sees the first-stamp
        // celebration again, which never blocks anything downstream.
      }
    }
    checkFirstEntry();
    return () => {
      cancelled = true;
    };
  }, [isReady, userId, isOfflineMode]);

  // One-tap entry from the passport's empty state: /check-in?lat=&lng=
  // arrives with coordinates already resolved, so nearby search can start
  // immediately without asking for location a second time. Arriving any
  // other way (e.g. the nav bar) still auto-requests geolocation on mount
  // — nearby pizzerias populate without the user having to tap "Find
  // pizzerias near me" first. A denied/unavailable permission just leaves
  // the existing manual-search UI in place; it's never a hard failure.
  useEffect(() => {
    if (autoLocateRan.current) return;
    autoLocateRan.current = true;

    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    if (lat && lng) {
      locateAndSearch({ lat: Number(lat), lng: Number(lng) });
    } else {
      useCurrentLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function locateAndSearch(position: Coordinates) {
    setCoords(position);
    setIsSearchingNearby(true);
    try {
      const [geocode, places] = await Promise.all([reverseGeocode(position), searchNearbyPizzerias(position)]);
      setCity((current) => current || geocode?.city || current);
      if (geocode?.country) setCountry(geocode.country);
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

  // Every check-in gets a place_id now — either the matched OpenStreetMap
  // venue, or a synthesized one for manual entries — computed once here so
  // the stamp-generation step (which needs it to check for a merchant's
  // official stamp override) and the save step both agree on the same id.
  const placeId = useMemo(() => {
    if (selectedPlace) return selectedPlace.id;
    if (!coords || !restaurantName.trim()) return null;
    return synthesizePlaceId(restaurantName, coords);
  }, [selectedPlace, coords, restaurantName]);

  function handleFile(kind: "venue" | "selfie" | "menu", file: File | null) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (kind === "venue") {
      setVenueFile(file);
      setVenuePreview(url);
    } else if (kind === "selfie") {
      setSelfieFile(file);
      setSelfiePreview(url);
    } else {
      setMenuFile(file);
      setMenuPreview(url);
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
        const merchantOverride = await fetchVerifiedMerchantStamp();

        let dataUrl: string;
        if (merchantOverride?.official_logo_url) {
          // This pizzeria has an official, merchant-designed stamp — use
          // it (and their chosen ink/texture settings) instead of ever
          // generating one from a fetched logo or the name-arch fallback.
          dataUrl = await generateInkStamp(merchantOverride.official_logo_url, {
            inkColor: (merchantOverride.custom_stamp_ink_color as InkColor) || inkColor,
            textureDensity: merchantOverride.stamp_texture_density,
            edgeDistress: merchantOverride.stamp_edge_distress,
            seed,
            fallbackRestaurantName: restaurantName,
            fallbackLocation: city,
          });
        } else {
          // 3-tier international logo fetch (Places photo -> Clearbit/
          // Brandfetch -> favicon); if all three come up empty, fall back
          // to the full-name arch stamp instead of ever truncating to a
          // letter.
          const logo = await fetchLogoUrl(restaurantName);
          dataUrl = logo
            ? await generateInkStamp(logo.url, {
                inkColor,
                seed,
                fallbackRestaurantName: restaurantName,
                fallbackLocation: city,
              })
            : await generateNameArchStamp(restaurantName, city, { inkColor, seed });
        }

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

  /** Looks up whether this venue has a verified merchant with a
   * custom-designed official stamp. Returns `null` (never throws) on any
   * miss — offline mode, no place_id yet, no merchant, or a network
   * error — so this is always safe to call as a "maybe" before the normal
   * logo-fetch chain. */
  async function fetchVerifiedMerchantStamp(): Promise<Merchant | null> {
    if (isOfflineMode || !placeId) return null;
    try {
      const supabase = getBrowserSupabaseClient();
      const { data } = await supabase
        .from("merchants")
        .select("*")
        .eq("place_id", placeId)
        .eq("is_verified", true)
        .maybeSingle<Merchant>();
      return data;
    } catch {
      return null;
    }
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
      const entryId = crypto.randomUUID();
      const entryCoords = selectedPlace ? { lat: selectedPlace.lat, lng: selectedPlace.lng } : coords;
      // Every check-in gets a place_id now — either the matched OpenStreetMap
      // venue, or a synthesized one for manual entries — so it always groups
      // under a pizzeria (see schema_moments.sql) instead of only ever
      // living on this one user's passport. Reuses the same memoized value
      // the stamp-generation step used to check for a merchant override.
      const resolvedPlaceId = placeId ?? synthesizePlaceId(restaurantName, coords);
      const claimMethod = selectedPlace ? "geo" : "manual";
      const pointsEarned = POINTS_BASE_CHECKIN + (menuFile ? POINTS_MENU_PHOTO_BONUS : 0);

      if (isOfflineMode) {
        // No Supabase reachable — compress photos to small data URLs and
        // keep the whole check-in on-device instead of failing the save.
        const [venueDataUrl, selfieDataUrl, menuDataUrl] = await Promise.all([
          compressImageToDataUrl(venueFile),
          compressImageToDataUrl(selfieFile),
          menuFile ? compressImageToDataUrl(menuFile) : Promise.resolve(null),
        ]);
        saveLocalEntry({
          id: entryId,
          user_id: userId,
          restaurant_name: restaurantName,
          latitude: entryCoords.lat,
          longitude: entryCoords.lng,
          rating,
          crust_type: crust,
          venue_photo_url: venueDataUrl,
          selfie_photo_url: selfieDataUrl,
          menu_photo_url: menuDataUrl,
          points_earned: pointsEarned,
          stamp_image_url: stampPreview,
          ink_color: inkColor,
          place_id: resolvedPlaceId,
          country,
          serial_number: loadLocalEntries().length + 1,
          claim_method: claimMethod,
          owner_reply: null,
          owner_replied_at: null,
          created_at: new Date().toISOString(),
        });
        setSavedEntryId(entryId);
        setPostSaveStage(isFirstCheckIn ? "celebration" : "moment");
        return;
      }

      const supabase = getBrowserSupabaseClient();

      const [venueUpload, selfieUpload] = await Promise.all([
        supabase.storage.from("pizza-photos").upload(`${entryId}/venue.jpg`, venueFile, { upsert: true }),
        supabase.storage.from("pizza-photos").upload(`${entryId}/selfie.jpg`, selfieFile, { upsert: true }),
      ]);
      if (venueUpload.error) throw venueUpload.error;
      if (selfieUpload.error) throw selfieUpload.error;

      let menuUrl: string | null = null;
      if (menuFile) {
        const menuUpload = await supabase.storage
          .from("pizza-photos")
          .upload(`${entryId}/menu.jpg`, menuFile, { upsert: true });
        if (menuUpload.error) throw menuUpload.error;
        menuUrl = supabase.storage.from("pizza-photos").getPublicUrl(`${entryId}/menu.jpg`).data.publicUrl;
      }

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
        latitude: entryCoords.lat,
        longitude: entryCoords.lng,
        rating,
        crust_type: crust,
        venue_photo_url: venueUrl,
        selfie_photo_url: selfieUrl,
        menu_photo_url: menuUrl,
        points_earned: pointsEarned,
        stamp_image_url: stampUrl,
        ink_color: inkColor,
        place_id: resolvedPlaceId,
        country,
        claim_method: claimMethod,
      });
      if (insertError) throw insertError;

      setSavedEntryId(entryId);
      setPostSaveStage(isFirstCheckIn ? "celebration" : "moment");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Something went wrong saving your check-in.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveMoment({ photo, note }: { photo: File | null; note: string }) {
    if (!savedEntryId || !userId || !coords) return;

    if (isOfflineMode) {
      const photoDataUrl = photo ? await compressImageToDataUrl(photo) : null;
      saveLocalMoment(savedEntryId, note, photoDataUrl);
      setMomentNote(note);
      setPostSaveStage("review");
      return;
    }

    const supabase = getBrowserSupabaseClient();
    const resolvedPlaceId = placeId ?? synthesizePlaceId(restaurantName, coords);

    let photoUrl: string | null = null;
    if (photo) {
      const path = `${savedEntryId}/moment.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("pizza-photos")
        .upload(path, photo, { upsert: true });
      if (!uploadError) {
        photoUrl = supabase.storage.from("pizza-photos").getPublicUrl(path).data.publicUrl;
      }
    }

    await supabase.from("moments").insert({
      entry_id: savedEntryId,
      user_id: userId,
      place_id: resolvedPlaceId,
      photo_url: photoUrl,
      note: note || null,
    });

    setMomentNote(note);
    setPostSaveStage("review");
  }

  // Local demo-mode entries only ever live in this browser's localStorage —
  // `/story/[id]` fetches from Supabase and would 404 on them, so offline
  // check-ins land on the passport itself instead.
  const goToFinalDestination = () => router.push(isOfflineMode ? "/passport" : `/story/${savedEntryId}`);

  if (!isReady) {
    return <p className="py-20 text-center text-mozzarella/50">Setting up your passport…</p>;
  }

  if (postSaveStage === "celebration" && savedEntryId) {
    return (
      <FirstStampCelebration
        stampPreview={stampPreview}
        restaurantName={restaurantName}
        username={username}
        onClaim={setUsername}
        onContinue={() => setPostSaveStage("moment")}
      />
    );
  }

  if (postSaveStage === "moment" && savedEntryId) {
    return (
      <div className="relative mx-auto max-w-md overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-8">
        <div aria-hidden="true" className="absolute inset-0 bg-cornmeal opacity-[0.14]" />
        <div className="relative">
          <MomentComposer
            restaurantName={restaurantName}
            onSave={handleSaveMoment}
            onSkip={goToFinalDestination}
          />
        </div>
      </div>
    );
  }

  if (postSaveStage === "review" && savedEntryId) {
    return (
      <div className="relative mx-auto max-w-md overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-8">
        <div aria-hidden="true" className="absolute inset-0 bg-cornmeal opacity-[0.14]" />
        <div className="relative">
          <GoogleReviewPrompt
            restaurantName={restaurantName}
            rating={rating}
            note={momentNote}
            coords={coords}
            onDismiss={goToFinalDestination}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-xl space-y-6 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] p-6">
      <div aria-hidden="true" className="absolute inset-0 bg-cornmeal opacity-[0.14]" />
      <div className="relative space-y-6">
        {isOfflineMode ? (
          <p className="rounded-xl border border-crust/30 bg-crust/10 px-4 py-2 text-center text-xs font-semibold text-crust">
            🔌 Working offline — this check-in will be saved on this device only.
          </p>
        ) : null}
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
            menuPreview={menuPreview}
            onVenueChange={(f) => handleFile("venue", f)}
            onSelfieChange={(f) => handleFile("selfie", f)}
            onMenuChange={(f) => handleFile("menu", f)}
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
            pointsEarned={POINTS_BASE_CHECKIN + (menuFile ? POINTS_MENU_PHOTO_BONUS : 0)}
            hasMenuPhoto={menuFile !== null}
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
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-mozzarella/50">Nearby Pizzerias</p>
            <span className="rounded-full bg-basil/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-basil">
              🍕 Local &amp; Artisanal Pizzerias Only
            </span>
          </div>
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
  menuPreview: string | null;
  onVenueChange: (file: File | null) => void;
  onSelfieChange: (file: File | null) => void;
  onMenuChange: (file: File | null) => void;
}) {
  return (
    <div className="space-y-4">
      <SectionTitle>Capture the moment</SectionTitle>
      <PhotoSlot label="Venue / Atmosphere" preview={props.venuePreview} onChange={props.onVenueChange} />
      <PhotoSlot label="You + the Slice" preview={props.selfiePreview} onChange={props.onSelfieChange} />
      <PhotoSlot
        label="Pizzeria Menu Photo"
        badge="+100 Bonus Points"
        optional
        preview={props.menuPreview}
        onChange={props.onMenuChange}
      />
    </div>
  );
}

function PhotoSlot({
  label,
  preview,
  onChange,
  optional = false,
  badge,
}: {
  label: string;
  preview: string | null;
  onChange: (file: File | null) => void;
  optional?: boolean;
  badge?: string;
}) {
  return (
    <label className="block cursor-pointer">
      <span className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-mozzarella/50">
        {label}
        {optional ? <span className="normal-case text-mozzarella/30">(optional)</span> : null}
        {badge ? (
          <span className="rounded-full bg-crust/20 px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal text-crust">
            {badge}
          </span>
        ) : null}
      </span>
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
  pointsEarned,
  hasMenuPhoto,
}: {
  isGenerating: boolean;
  stampPreview: string | null;
  restaurantName: string;
  city: string;
  rating: number;
  venuePreview: string | null;
  usePolaroidPreview: boolean;
  onTogglePolaroid: () => void;
  pointsEarned: number;
  hasMenuPhoto: boolean;
}) {
  return (
    <div className="relative flex flex-col items-center gap-4 text-center">
      <SectionTitle>Your Stamp</SectionTitle>
      <div className="relative flex h-40 w-40 items-center justify-center">
        <SauceSplatter className="absolute -bottom-3 -right-3" size={70} opacity={0.35} />
        <StampCanvas
          stampDataUrl={stampPreview}
          isGenerating={isGenerating}
          seed={seedFromString(restaurantName)}
          size={160}
        />
      </div>
      <p className="font-serif text-lg font-bold text-mozzarella">{restaurantName}</p>
      <PlateRating value={rating} readOnly />

      <div className="flex items-center gap-2 rounded-full bg-crust/15 px-4 py-1.5 text-sm font-bold text-crust">
        <span>🏆 +{pointsEarned} Points</span>
        {hasMenuPhoto ? <span className="text-xs font-semibold text-crust/70">(incl. +100 menu bonus)</span> : null}
      </div>

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
