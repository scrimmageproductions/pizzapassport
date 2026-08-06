import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface GooglePlaceResult {
  place_id: string;
  name: string;
  vicinity?: string;
  geometry?: { location?: { lat: number; lng: number } };
}

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
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
 * Server-side Google Places "Nearby Search" for pizzerias — kept as an API
 * route (never called directly from the browser) so the API key stays out
 * of client bundles and so the request isn't subject to browser CORS at
 * all. This is the primary tier of the place-search fallback chain in
 * lib/geo.ts's `searchNearbyPizzerias`; when `GOOGLE_PLACES_API_KEY` isn't
 * set (the default for this project — see web/README.md), this route is a
 * safe no-op that returns an empty list instead of erroring, so the caller
 * falls through to the free OpenStreetMap tiers automatically.
 */
export async function GET(request: NextRequest) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ places: [], source: "unconfigured" });
  }

  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));
  const radius = Number(request.nextUrl.searchParams.get("radius") ?? "1500");

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat/lng query params are required." }, { status: 400 });
  }

  const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("radius", String(radius));
  url.searchParams.set("type", "restaurant");
  url.searchParams.set("keyword", "pizza");
  url.searchParams.set("key", apiKey);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) {
      return NextResponse.json({ places: [], source: "error" });
    }

    const data = (await response.json()) as { results?: GooglePlaceResult[]; status?: string };
    const origin = { lat, lng };

    const places = (data.results ?? [])
      .filter((result) => result.geometry?.location)
      .map((result) => {
        const location = result.geometry!.location!;
        return {
          id: `google:${result.place_id}`,
          name: result.name,
          lat: location.lat,
          lng: location.lng,
          address: result.vicinity,
          distanceMeters: haversineMeters(origin, location),
        };
      })
      .sort((a, b) => a.distanceMeters - b.distanceMeters);

    return NextResponse.json({ places, source: "google" });
  } catch {
    // Timed out or network error — the caller treats this identically to
    // "no results" and falls through to the free OSM tiers.
    return NextResponse.json({ places: [], source: "error" });
  } finally {
    clearTimeout(timeout);
  }
}
