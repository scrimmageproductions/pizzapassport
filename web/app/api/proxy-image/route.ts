import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB — generous for a logo/favicon, small enough to bound abuse.
const FETCH_TIMEOUT_MS = 8000;

const PRIVATE_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^\[::1\]$/,
];

function isBlockedHost(hostname: string): boolean {
  return PRIVATE_HOSTNAME_PATTERNS.some((pattern) => pattern.test(hostname));
}

/**
 * Server-side image proxy so the Canvas ink-stamp engine (see
 * lib/stampFilter.ts) can read pixel data back out of a fetched logo
 * without tainting the canvas. Browsers only allow `getImageData` on a
 * cross-origin `<img>` when it was loaded with `crossOrigin="anonymous"`
 * AND the response carries a permissive CORS header — many logo sources
 * (favicon services, brand-logo APIs) don't reliably set one. Fetching
 * server-to-server has no CORS restriction at all, so re-serving the bytes
 * from our own origin with an explicit `Access-Control-Allow-Origin`
 * sidesteps the problem entirely.
 */
export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get("url");
  if (!target) {
    return NextResponse.json({ error: "Missing 'url' query parameter." }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "Only http/https URLs are allowed." }, { status: 400 });
  }
  if (isBlockedHost(parsed.hostname)) {
    return NextResponse.json({ error: "That host isn't allowed." }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const upstream = await fetch(parsed.toString(), {
      signal: controller.signal,
      // A generic browser-like UA — some favicon/logo services 403 on
      // bodyless/bot-looking requests.
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PizzaPassportBot/1.0)" },
      redirect: "follow",
    });

    if (!upstream.ok) {
      return NextResponse.json({ error: `Upstream responded ${upstream.status}` }, { status: 502 });
    }

    const contentType = upstream.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Upstream did not return an image." }, { status: 415 });
    }

    const buffer = await upstream.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "Image too large." }, { status: 413 });
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fetch failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
