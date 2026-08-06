"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Loader2, CheckCircle2, Clock } from "lucide-react";
import clsx from "clsx";
import {
  getCurrentPosition,
  searchNearbyPizzerias,
  synthesizePlaceId,
  GeolocationDeniedError,
  type NearbyPlace,
  type Coordinates,
} from "@/lib/geo";
import { signInMerchant, signUpMerchant } from "@/lib/merchant";

type Mode = "claim" | "signin";
type ClaimStep = "search" | "details" | "result";

interface SelectedVenue {
  placeId: string;
  name: string;
  coords: Coordinates | null;
  website?: string;
}

export default function ClaimPage() {
  const [mode, setMode] = useState<Mode>("claim");

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="text-center">
        <h1 className="font-serif text-2xl font-bold text-[#FDFBF7]">Claim Your Pizzeria</h1>
        <p className="mt-1 text-sm text-[#FDFBF7]/50">
          Manage your official stamp, see every check-in, and reply to your customers.
        </p>
      </div>

      <div className="flex justify-center gap-2 rounded-full border border-[#D1A34F]/20 bg-white/5 p-1 text-sm font-semibold">
        <button
          onClick={() => setMode("claim")}
          className={clsx(
            "rounded-full px-4 py-1.5 transition",
            mode === "claim" ? "bg-[#D1A34F] text-[#1C1201]" : "text-[#FDFBF7]/60"
          )}
        >
          Claim Your Pizzeria
        </button>
        <button
          onClick={() => setMode("signin")}
          className={clsx(
            "rounded-full px-4 py-1.5 transition",
            mode === "signin" ? "bg-[#D1A34F] text-[#1C1201]" : "text-[#FDFBF7]/60"
          )}
        >
          Sign In
        </button>
      </div>

      {mode === "claim" ? <ClaimFlow /> : <SignInForm />}
    </div>
  );
}

function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const result = await signInMerchant(email, password);
    setIsSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/biz/dashboard");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-[#D1A34F]/20 bg-white/[0.03] p-6">
      <Field label="Business Email" type="email" value={email} onChange={setEmail} required />
      <Field label="Password" type="password" value={password} onChange={setPassword} required />
      {error ? <p className="text-xs text-tomato">{error}</p> : null}
      <button
        type="submit"
        disabled={isSubmitting}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-[#D1A34F] px-4 py-2.5 text-sm font-bold text-[#1C1201] disabled:opacity-50"
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Sign In
      </button>
    </form>
  );
}

function ClaimFlow() {
  const router = useRouter();
  const [step, setStep] = useState<ClaimStep>("search");
  const [venue, setVenue] = useState<SelectedVenue | null>(null);
  const [result, setResult] = useState<{ verified: boolean } | null>(null);

  if (step === "search") {
    return (
      <VenueSearchStep
        onSelect={(selected) => {
          setVenue(selected);
          setStep("details");
        }}
      />
    );
  }

  if (step === "details" && venue) {
    return (
      <BusinessDetailsStep
        venue={venue}
        onBack={() => setStep("search")}
        onSubmitted={(verified) => {
          setResult({ verified });
          setStep("result");
        }}
      />
    );
  }

  if (step === "result" && result) {
    return (
      <div className="space-y-4 rounded-2xl border border-[#D1A34F]/20 bg-white/[0.03] p-8 text-center">
        {result.verified ? (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-basil" />
            <h2 className="font-serif text-xl font-bold text-[#FDFBF7]">You&apos;re verified!</h2>
            <p className="text-sm text-[#FDFBF7]/60">
              Your business email matched your venue&apos;s website, so we verified you automatically.
            </p>
          </>
        ) : (
          <>
            <Clock className="mx-auto h-10 w-10 text-[#D1A34F]" />
            <h2 className="font-serif text-xl font-bold text-[#FDFBF7]">Claim submitted — pending verification</h2>
            <p className="text-sm text-[#FDFBF7]/60">
              We couldn&apos;t auto-verify ownership from your email domain. Your dashboard is ready now in preview
              mode; reach out to support to finish verification.
            </p>
          </>
        )}
        <button
          onClick={() => router.push("/biz/dashboard")}
          className="rounded-full bg-[#D1A34F] px-6 py-2.5 text-sm font-bold text-[#1C1201]"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  return null;
}

function VenueSearchStep({ onSelect }: { onSelect: (venue: SelectedVenue) => void }) {
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [nearby, setNearby] = useState<NearbyPlace[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [manualName, setManualName] = useState("");

  async function findNearby() {
    setIsSearching(true);
    setLocationError(null);
    try {
      const position = await getCurrentPosition();
      setCoords(position);
      const places = await searchNearbyPizzerias(position);
      setNearby(places);
    } catch (error) {
      setLocationError(
        error instanceof GeolocationDeniedError
          ? "Location access denied — enter your pizzeria's name manually below."
          : error instanceof Error
          ? error.message
          : "Couldn't determine your location."
      );
    } finally {
      setIsSearching(false);
    }
  }

  function selectManual() {
    if (!manualName.trim() || !coords) return;
    onSelect({ placeId: synthesizePlaceId(manualName, coords), name: manualName.trim(), coords });
  }

  return (
    <div className="space-y-4 rounded-2xl border border-[#D1A34F]/20 bg-white/[0.03] p-6">
      <p className="text-sm font-semibold text-[#FDFBF7]">Which pizzeria is yours?</p>

      <button
        onClick={findNearby}
        disabled={isSearching}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-basil/40 bg-basil/10 px-4 py-3 text-sm font-semibold text-basil disabled:opacity-60"
      >
        <MapPin className="h-4 w-4" />
        {isSearching ? "Finding nearby pizzerias…" : "Find My Pizzeria Nearby"}
      </button>
      {locationError ? <p className="text-xs text-tomato">{locationError}</p> : null}

      {nearby.length > 0 ? (
        <div className="max-h-64 space-y-1.5 overflow-y-auto">
          {nearby.map((place) => (
            <button
              key={place.id}
              onClick={() => onSelect({ placeId: place.id, name: place.name, coords: { lat: place.lat, lng: place.lng }, website: place.website })}
              className="flex w-full flex-col items-start rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-left hover:bg-white/10"
            >
              <span className="text-sm font-semibold text-[#FDFBF7]">{place.name}</span>
              {place.address ? <span className="text-xs text-[#FDFBF7]/40">{place.address}</span> : null}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-3 py-1 text-xs text-[#FDFBF7]/30">
        <span className="h-px flex-1 bg-white/10" />
        or enter it manually
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <input
        value={manualName}
        onChange={(e) => setManualName(e.target.value)}
        placeholder="Pizzeria name"
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[#FDFBF7] placeholder:text-[#FDFBF7]/30 focus:border-[#D1A34F] focus:outline-none"
      />
      <button
        onClick={selectManual}
        disabled={!manualName.trim() || !coords}
        className="w-full rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-[#FDFBF7]/70 disabled:opacity-40"
      >
        {coords ? "Continue with this name" : "Find your location above first"}
      </button>
    </div>
  );
}

function BusinessDetailsStep({
  venue,
  onBack,
  onSubmitted,
}: {
  venue: SelectedVenue;
  onBack: () => void;
  onSubmitted: (verified: boolean) => void;
}) {
  const [businessName, setBusinessName] = useState(venue.name);
  const [businessEmail, setBusinessEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState(venue.website ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const signUpResult = await signUpMerchant(businessEmail, password);
    if (signUpResult.error || !signUpResult.userId) {
      setError(signUpResult.error ?? "Couldn't create your account — try again.");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/merchants/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: signUpResult.userId,
          placeId: venue.placeId,
          placeName: businessName.trim(),
          latitude: venue.coords?.lat ?? null,
          longitude: venue.coords?.lng ?? null,
          businessName: businessName.trim(),
          businessEmail,
          phoneNumber: phoneNumber || undefined,
          websiteUrl: websiteUrl || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Couldn't submit your claim — try again.");
        return;
      }
      onSubmitted(Boolean(data.autoVerified));
    } catch {
      setError("Couldn't reach the server — check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-[#D1A34F]/20 bg-white/[0.03] p-6">
      <p className="text-sm font-semibold text-[#FDFBF7]">
        Claiming <span className="text-[#D1A34F]">{venue.name}</span>
      </p>

      <Field label="Business Name" value={businessName} onChange={setBusinessName} required />
      <Field label="Business Email" type="email" value={businessEmail} onChange={setBusinessEmail} required />
      <Field label="Password" type="password" value={password} onChange={setPassword} required minLength={6} />
      <Field label="Phone Number (optional)" value={phoneNumber} onChange={setPhoneNumber} />
      <Field
        label="Website (optional — speeds up verification)"
        value={websiteUrl}
        onChange={setWebsiteUrl}
        placeholder="https://yourpizzeria.com"
      />
      <p className="text-xs text-[#FDFBF7]/40">
        If your business email&apos;s domain matches your website, you&apos;re verified instantly. Otherwise your
        claim is submitted for manual review.
      </p>

      {error ? <p className="text-xs text-tomato">{error}</p> : null}

      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={onBack} className="text-sm font-semibold text-[#FDFBF7]/50">
          Back
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-full bg-[#D1A34F] px-6 py-2.5 text-sm font-bold text-[#1C1201] disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Submit Claim
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  minLength,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  minLength?: number;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#FDFBF7]/50">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-[#FDFBF7] placeholder:text-[#FDFBF7]/30 focus:border-[#D1A34F] focus:outline-none"
      />
    </label>
  );
}
