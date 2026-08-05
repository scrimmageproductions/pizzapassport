"use client";

import type { ClaimMethod } from "./types";

const LOCAL_ENTRIES_KEY = "pizza-passport:local-entries";
const LOCAL_USER_ID_KEY = "pizza-passport:local-user-id";
/** Keeps localStorage footprint bounded — a handful of compressed photos
 * per entry is the realistic ceiling for a ~5MB quota, so this cap is
 * deliberate, not an oversight. */
const MAX_LOCAL_ENTRIES = 12;

/**
 * A check-in saved entirely on-device — used when Supabase is unreachable
 * or unconfigured (e.g. missing env vars on a fresh deploy), so the app
 * stays fully usable instead of hanging or erroring out. Shape mirrors
 * `Entry` closely enough that the same UI components render either.
 */
export interface LocalEntry {
  id: string;
  user_id: string;
  restaurant_name: string;
  latitude: number;
  longitude: number;
  rating: number;
  crust_type: string;
  venue_photo_url: string;
  selfie_photo_url: string;
  stamp_image_url: string | null;
  ink_color: string;
  place_id: string | null;
  serial_number: number;
  claim_method: ClaimMethod;
  created_at: string;
  moment_note?: string;
  moment_photo_url?: string;
}

export function getOrCreateLocalUserId(): string {
  if (typeof window === "undefined") return "local-user";
  let id = window.localStorage.getItem(LOCAL_USER_ID_KEY);
  if (!id) {
    id = `local:${crypto.randomUUID()}`;
    window.localStorage.setItem(LOCAL_USER_ID_KEY, id);
  }
  return id;
}

export function loadLocalEntries(): LocalEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_ENTRIES_KEY);
    return raw ? (JSON.parse(raw) as LocalEntry[]) : [];
  } catch {
    return [];
  }
}

/** Prepends a new entry, trimming the oldest ones if the list is at the
 * cap — keeps storage bounded rather than growing unboundedly. */
export function saveLocalEntry(entry: LocalEntry): void {
  const existing = loadLocalEntries();
  persist([entry, ...existing].slice(0, MAX_LOCAL_ENTRIES));
}

/** Merges a Moment's note/photo into its parent entry — there's no local
 * relational store, so a Moment just lives as extra fields on the entry. */
export function saveLocalMoment(entryId: string, note: string, photoUrl: string | null): void {
  const updated = loadLocalEntries().map((entry) =>
    entry.id === entryId
      ? { ...entry, moment_note: note || undefined, moment_photo_url: photoUrl ?? undefined }
      : entry
  );
  persist(updated);
}

function persist(entries: LocalEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_ENTRIES_KEY, JSON.stringify(entries));
  } catch {
    // Quota exceeded (most likely cause: photo data). Drop the older half
    // and try once more before giving up silently — losing the oldest
    // demo entries is a much better failure mode than crashing the save.
    try {
      const trimmed = entries.slice(0, Math.max(1, Math.floor(entries.length / 2)));
      window.localStorage.setItem(LOCAL_ENTRIES_KEY, JSON.stringify(trimmed));
    } catch {
      console.warn("Pizza Passport: local storage is full — this check-in may not persist after reload.");
    }
  }
}

/**
 * Downscales and recompresses an image file to a small JPEG data URL, so a
 * handful of demo-mode check-ins (each with 2-3 photos) stay well within
 * localStorage's ~5MB quota instead of storing full-resolution originals.
 */
export function compressImageToDataUrl(file: File, maxDimension = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas isn't supported in this browser."));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Couldn't read that image."));
    };
    img.src = objectUrl;
  });
}
