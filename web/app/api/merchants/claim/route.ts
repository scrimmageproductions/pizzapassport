import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

interface ClaimRequestBody {
  userId: string;
  placeId: string;
  placeName: string;
  latitude?: number | null;
  longitude?: number | null;
  businessName: string;
  businessEmail: string;
  phoneNumber?: string;
  /** Optional proof-of-ownership URL (the venue's own website). Used only
   * for the domain-match auto-verify check below — never displayed. */
  websiteUrl?: string;
}

function extractDomain(input: string): string | null {
  try {
    const withProtocol = input.includes("://") ? input : `https://${input}`;
    return new URL(withProtocol).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function extractEmailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  return at === -1 ? null : email.slice(at + 1).toLowerCase();
}

/**
 * Creates a merchant account row. Deliberately a server route using the
 * Supabase *service role* key rather than a client-side insert: a claim's
 * `is_verified` value must never be something the browser can set for
 * itself. This route computes it from a real (if modest) check — does the
 * business email's domain match the venue's own website domain, when one
 * was provided — and everything else (RLS on `public.merchants`) still
 * applies to every read/update *after* this point.
 */
export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "The merchant portal isn't configured on this deployment yet (missing SUPABASE_SERVICE_ROLE_KEY)." },
      { status: 503 }
    );
  }

  let body: ClaimRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { userId, placeId, placeName, businessName, businessEmail } = body;
  if (!userId || !placeId || !placeName || !businessName || !businessEmail) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  // Confirm the caller is who they claim to be — the service role key
  // bypasses RLS entirely, so this route is the only thing standing
  // between "any request" and creating a merchant row.
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  // The pizzeria this claim targets may not exist yet (schema_moments.sql
  // only creates a `pizzerias` row the first time someone checks in there)
  // — upsert it so a brand-new, never-checked-into venue can still be
  // claimed.
  const { error: pizzeriaError } = await admin.from("pizzerias").upsert(
    {
      place_id: placeId,
      name: placeName,
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
    },
    { onConflict: "place_id", ignoreDuplicates: true }
  );
  if (pizzeriaError) {
    return NextResponse.json({ error: pizzeriaError.message }, { status: 500 });
  }

  const websiteDomain = body.websiteUrl ? extractDomain(body.websiteUrl) : null;
  const emailDomain = extractEmailDomain(businessEmail);
  const isVerified = Boolean(websiteDomain && emailDomain && websiteDomain === emailDomain);

  const { data: merchant, error: insertError } = await admin
    .from("merchants")
    .insert({
      id: userId,
      business_name: businessName,
      business_email: businessEmail,
      phone_number: body.phoneNumber ?? null,
      place_id: placeId,
      is_verified: isVerified,
    })
    .select("*")
    .single();

  if (insertError) {
    const message = insertError.code === "23505" // unique_violation
      ? "This account or this pizzeria has already been claimed."
      : insertError.message;
    return NextResponse.json({ error: message }, { status: 409 });
  }

  return NextResponse.json({ merchant, autoVerified: isVerified });
}
