"use client";

import { getBrowserSupabaseClient, isSupabaseConfigured } from "./supabase/client";
import type { Merchant } from "./types";

/**
 * Merchant accounts use real Supabase email/password auth — unlike the
 * consumer app, which is anonymous-first (see useLocalProfile.ts). Both
 * currently share the same browser Supabase client/session storage, so
 * signing into the merchant portal in a tab replaces that browser's
 * anonymous consumer session. That's an acceptable tradeoff for this
 * project (a merchant using their own passport and running their shop's
 * dashboard is a reasonable thing to do from separate browsers/profiles),
 * but a production build would want a second Supabase client instance
 * pointed at a different `storageKey` so the two identities can coexist
 * in one browser.
 */

export interface MerchantSession {
  userId: string;
  email: string | null;
  merchant: Merchant | null;
}

/** Message shown wherever a merchant flow can't proceed because this
 * deployment has no Supabase project configured — unlike the consumer app,
 * the merchant portal has no offline/local-demo mode: real accounts and
 * RLS-backed verification fundamentally require a real backend. */
export const MERCHANT_PORTAL_UNAVAILABLE_MESSAGE =
  "The merchant portal isn't available on this deployment yet (Supabase isn't configured).";

/** Returns the signed-in merchant's auth session plus their `merchants`
 * row, or `null` if nobody's signed in (or Supabase isn't configured).
 * `merchant` is `null` when the signed-in user hasn't completed a venue
 * claim yet. `getBrowserSupabaseClient()` throws *synchronously* when
 * unconfigured, so this must check first rather than try/catch. */
export async function getCurrentMerchant(): Promise<MerchantSession | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = getBrowserSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session || session.user.is_anonymous) return null;

  const { data: merchant } = await supabase
    .from("merchants")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle<Merchant>();

  return { userId: session.user.id, email: session.user.email ?? null, merchant: merchant ?? null };
}

export async function signInMerchant(email: string, password: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) return { error: MERCHANT_PORTAL_UNAVAILABLE_MESSAGE };
  const supabase = getBrowserSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? { error: error.message } : {};
}

/** Returns the new user's id from the signup response directly — not from
 * a session — since a project with email confirmation enabled won't
 * establish a session immediately, but `data.user.id` is still populated
 * either way and is enough to complete the venue claim below. */
export async function signUpMerchant(email: string, password: string): Promise<{ userId?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { error: MERCHANT_PORTAL_UNAVAILABLE_MESSAGE };
  const supabase = getBrowserSupabaseClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };
  if (!data.user) return { error: "Sign up didn't return a user — try again." };
  return { userId: data.user.id };
}

export async function signOutMerchant(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getBrowserSupabaseClient();
  await supabase.auth.signOut();
}
