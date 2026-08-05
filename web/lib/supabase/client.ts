"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

/**
 * True only if both Supabase env vars are present and look like a real
 * project URL. Checked before ever touching the network or constructing a
 * client, so a misconfigured deployment (e.g. Vercel env vars not set)
 * fails fast into local demo mode instead of hanging on a doomed call —
 * `createClient()` throws *synchronously* when given an empty URL/key.
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && key && /^https?:\/\//.test(url));
}

/**
 * Lazily-created singleton Supabase client for use in Client Components.
 * Persists the (possibly anonymous) auth session in localStorage so a
 * visitor's passport survives a page reload.
 *
 * Callers should check `isSupabaseConfigured()` first — with missing env
 * vars this throws synchronously rather than returning a broken client.
 */
export function getBrowserSupabaseClient(): SupabaseClient {
  if (!browserClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    browserClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return browserClient;
}
