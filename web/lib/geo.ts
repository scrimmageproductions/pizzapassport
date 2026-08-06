import { isChainPizzeria } from "./constants";

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface NearbyPlace {
  /** Stable id for this venue (an OpenStreetMap node id) — stored on the
   * entry as `place_id` for de-duplication and future "trending
   * pizzerias" features. */
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  distanceMeters: number;
}

export interface ReverseGeocodeResult {
  label: string;
  city: string;
  country: string;
}

/** Thrown specifically for a permission denial, so callers can show a
 * "you'll need to allow location access" message instead of a generic error. */
export class GeolocationDeniedError extends Error {}

/** Maximum distance (meters) a device may be from a selected pizzeria for
 * a check-in to count as "there" — generous enough to absorb typical GPS
 * drift and imprecise OpenStreetMap coordinates. */
export const MAX_CHECKIN_DISTANCE_METERS = 500;

/**
 * Deterministic place id for a manually-typed check-in with no matched
 * OpenStreetMap venue, so it can still be grouped with future check-ins
 * at the same spot under `public.pizzerias`. Coordinates are rounded to
 * ~100m precision so repeat visits collapse into the same place instead
 * of fragmenting on GPS noise.
 */
export function synthesizePlaceId(name: string, coords: Coordinates): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `manual:${slug || "pizzeria"}:${coords.lat.toFixed(3)},${coords.lng.toFixed(3)}`;
}

/** Wraps the browser Geolocation API in a Promise with friendlier errors. */
export function getCurrentPosition(options: PositionOptions = {}): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new Error("Geolocation isn't available in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new GeolocationDeniedError("Location access was denied."));
        } else {
          reject(new Error(error.message || "Couldn't determine your location."));
        }
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000, ...options }
    );
  });
}

/** Great-circle distance between two coordinates, in meters. */
export function haversineDistanceMeters(a: Coordinates, b: Coordinates): number {
  const earthRadiusMeters = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(h));
}

/**
 * Reverse geocodes a coordinate into a human-readable city label using
 * OpenStreetMap's free Nominatim API — no key required.
 *
 * Nominatim's usage policy is meant for light, occasional lookups (one per
 * check-in, which is exactly this call pattern) and may rate-limit or
 * block heavier traffic. For production scale, self-host Nominatim or
 * swap this out for a paid geocoder (e.g. Google Geocoding) — every
 * caller here goes through this one function, so that's a localized change.
 */
export async function reverseGeocode(coords: Coordinates): Promise<ReverseGeocodeResult | null> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(coords.lat));
    url.searchParams.set("lon", String(coords.lng));
    url.searchParams.set("zoom", "14");

    const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!response.ok) return null;

    const data = await response.json();
    const address = data.address ?? {};
    const city: string = address.city ?? address.town ?? address.village ?? address.county ?? "";
    const country: string = address.country ?? "";
    const label = [city, country].filter(Boolean).join(", ");
    return label ? { label, city, country } : null;
  } catch {
    // Network hiccup or the free API is temporarily unavailable — the
    // check-in flow treats this as "no city detected" and lets the user
    // type one in manually rather than blocking on it.
    return null;
  }
}

interface OverpassElement {
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

/** Wraps `fetch` with a hard timeout so a slow/unresponsive third-party
 * search API can never hang the whole nearby-search chain — a tier that
 * doesn't answer in time is treated exactly like a tier that errored. */
function fetchWithTimeout(input: string, init: RequestInit = {}, timeoutMs = 6000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

/**
 * Tier 1 (optional): the app's own `/api/places/nearby` route, which calls
 * Google Places server-side. Returns an empty array immediately — never
 * throws — when `GOOGLE_PLACES_API_KEY` isn't configured (the default for
 * this project), so callers can always fall through to the free tiers
 * below without special-casing "not configured" vs. "no results."
 */
async function searchGooglePlacesPizzerias(coords: Coordinates, radiusMeters: number): Promise<NearbyPlace[]> {
  try {
    const url = `/api/places/nearby?lat=${coords.lat}&lng=${coords.lng}&radius=${radiusMeters}`;
    const response = await fetchWithTimeout(url, {}, 6000);
    if (!response.ok) return [];
    const data = (await response.json()) as { places?: NearbyPlace[] };
    return data.places ?? [];
  } catch {
    return [];
  }
}

/**
 * Tier 2 (free, no key): OpenStreetMap's Overpass API. Matches
 * restaurants/fast-food/cafes tagged `cuisine=pizza` plus anything with
 * "pizza" in its name, within `radiusMeters`, sorted nearest-first.
 */
async function searchOverpassPizzerias(coords: Coordinates, radiusMeters: number): Promise<NearbyPlace[]> {
  const query = `[out:json][timeout:15];(node["amenity"~"restaurant|fast_food|cafe"]["cuisine"~"pizza",i](around:${radiusMeters},${coords.lat},${coords.lng});node["name"~"pizza",i](around:${radiusMeters},${coords.lat},${coords.lng}););out center 30;`;

  try {
    const response = await fetchWithTimeout(
      "https://overpass-api.de/api/interpreter",
      { method: "POST", headers: { "Content-Type": "text/plain" }, body: query },
      8000
    );
    if (!response.ok) return [];

    const data = await response.json();
    const elements: OverpassElement[] = data.elements ?? [];

    const places: NearbyPlace[] = [];
    for (const element of elements) {
      const name = element.tags?.name;
      if (!name) continue;

      places.push({
        id: `osm:${element.id}`,
        name,
        lat: element.lat,
        lng: element.lon,
        address:
          [element.tags?.["addr:housenumber"], element.tags?.["addr:street"]].filter(Boolean).join(" ") ||
          undefined,
        distanceMeters: haversineDistanceMeters(coords, { lat: element.lat, lng: element.lon }),
      });
    }
    return places;
  } catch {
    // Network hiccup, timeout, or Overpass rate-limiting (it's a shared
    // free service and does this under load) — fail soft so the next tier
    // gets a chance instead of surfacing an error to the user.
    return [];
  }
}

interface NominatimSearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

/**
 * Tier 3 (free, no key): OpenStreetMap's Nominatim *search* endpoint
 * (distinct from the reverse-geocode one used elsewhere in this file) as a
 * last-resort fallback if Overpass is unreachable or rate-limited — a
 * different service, so an Overpass outage doesn't take this down too.
 * Nominatim isn't a POI search engine the way Overpass is, so this is
 * strictly a fallback: it free-texts "pizza" near a bounded viewbox around
 * the user rather than querying structured cuisine tags.
 */
async function searchNominatimPizzerias(coords: Coordinates, radiusMeters: number): Promise<NearbyPlace[]> {
  try {
    // ~1 degree of latitude is ~111km; build a small bounding box scaled to
    // the requested radius instead of hardcoding one.
    const deltaDeg = Math.min(0.5, radiusMeters / 111_000);
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", "pizza");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "15");
    url.searchParams.set(
      "viewbox",
      [coords.lng - deltaDeg, coords.lat + deltaDeg, coords.lng + deltaDeg, coords.lat - deltaDeg].join(",")
    );
    url.searchParams.set("bounded", "1");

    const response = await fetchWithTimeout(url.toString(), { headers: { Accept: "application/json" } }, 6000);
    if (!response.ok) return [];

    const results: NominatimSearchResult[] = await response.json();
    return results.map((result) => {
      const placeCoords = { lat: Number(result.lat), lng: Number(result.lon) };
      return {
        id: `nominatim:${result.place_id}`,
        name: result.display_name.split(",")[0].trim(),
        lat: placeCoords.lat,
        lng: placeCoords.lng,
        distanceMeters: haversineDistanceMeters(coords, placeCoords),
      };
    });
  } catch {
    return [];
  }
}

/**
 * Finds nearby pizza-serving venues through a three-tier fallback chain,
 * so a single flaky/rate-limited service never leaves the check-in flow
 * with an empty list: Google Places (server-proxied, only if an API key is
 * configured) → OpenStreetMap Overpass (free, structured cuisine tags) →
 * OpenStreetMap Nominatim search (free, last resort). Whichever tier
 * actually produces results wins; a tier that returns nothing or errors is
 * silently skipped rather than surfaced as a failure.
 *
 * Major national chains (see `CHAIN_BLACKLIST` in lib/constants.ts) are
 * filtered out of the combined results, regardless of which tier found
 * them — Pizza Passport is about discovering local/independent pizzerias,
 * not logging a Domino's run.
 */
export async function searchNearbyPizzerias(coords: Coordinates, radiusMeters = 1500): Promise<NearbyPlace[]> {
  const tiers = [
    () => searchGooglePlacesPizzerias(coords, radiusMeters),
    () => searchOverpassPizzerias(coords, radiusMeters),
    () => searchNominatimPizzerias(coords, radiusMeters),
  ];

  let raw: NearbyPlace[] = [];
  for (const tier of tiers) {
    raw = await tier();
    if (raw.length > 0) break;
  }

  const seenNames = new Set<string>();
  const places: NearbyPlace[] = [];
  for (const place of raw) {
    const key = place.name.toLowerCase();
    if (seenNames.has(key) || isChainPizzeria(place.name)) continue;
    seenNames.add(key);
    places.push(place);
  }

  return places.sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, 12);
}
