"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient, isSupabaseConfigured } from "./supabase/client";
import { getOrCreateLocalUserId } from "./localEntries";

const USERNAME_KEY = "pizza-passport:username";
/** If Supabase hasn't responded within this window, stop waiting and fall
 * back to local demo mode — a hung network call must never be able to
 * leave the app stuck on a loading screen. */
const BOOTSTRAP_TIMEOUT_MS = 3000;

function randomUsername() {
  const adjectives = ["cheesy", "saucy", "crispy", "smoky", "zesty", "doughy"];
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${adjective}-slice-${suffix}`;
}

function getStoredUsername(): string {
  if (typeof window === "undefined") return randomUsername();
  const stored = window.localStorage.getItem(USERNAME_KEY);
  if (stored) return stored;
  const generated = randomUsername();
  window.localStorage.setItem(USERNAME_KEY, generated);
  return generated;
}

function delay<T extends string>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export interface LocalProfile {
  isReady: boolean;
  userId: string | null;
  username: string;
  /** true if Supabase was unreachable, unconfigured, or too slow to
   * respond, and the app fell back to a local-only, on-device passport
   * instead of hanging or erroring out. */
  isOfflineMode: boolean;
  setUsername: (next: string) => Promise<{ error?: string }>;
}

/**
 * Client-side identity for the standalone web app: signs the visitor in
 * anonymously via Supabase Auth (no login screen, no password), then keeps
 * a public `username` in sync between localStorage and their `profiles`
 * row. If Supabase is unreachable, misconfigured (e.g. missing env vars on
 * a fresh Vercel deploy), or simply doesn't respond within
 * `BOOTSTRAP_TIMEOUT_MS`, this falls back to a local-only identity instead
 * of leaving the app stuck on a loading screen forever — `isReady` is
 * *always* set in a `finally`, regardless of which path was taken.
 */
export function useLocalProfile(): LocalProfile {
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsernameState] = useState<string>("");
  const [isReady, setIsReady] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  useEffect(() => {
    let cancelled = false;

    function fallBackToLocal() {
      if (cancelled) return;
      setUserId(getOrCreateLocalUserId());
      setUsernameState(getStoredUsername());
      setIsOfflineMode(true);
    }

    async function connectToSupabase(): Promise<void> {
      const supabase = getBrowserSupabaseClient();

      const { data: sessionData } = await supabase.auth.getSession();
      let session = sessionData.session;

      if (!session) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        session = data.session;
      }
      if (!session) throw new Error("No session returned from Supabase.");

      const storedUsername = getStoredUsername();
      await supabase.from("profiles").upsert(
        { id: session.user.id, username: storedUsername, is_vip: false },
        { onConflict: "id" }
      );

      if (cancelled) return;
      setUserId(session.user.id);
      setUsernameState(storedUsername);
      setIsOfflineMode(false);
    }

    async function bootstrap() {
      if (!isSupabaseConfigured()) {
        console.warn("Pizza Passport: Supabase isn't configured — running in local demo mode.");
        fallBackToLocal();
        setIsReady(true);
        return;
      }

      try {
        // `connectToSupabase()` never rejects here — failures are caught
        // and turned into a "failed" sentinel — so `Promise.race` can never
        // leave an unobserved rejection behind if the timeout wins first.
        const connectResult = connectToSupabase().then(
          () => "connected" as const,
          (error) => {
            console.error("Pizza Passport: Supabase connection failed — falling back to local demo mode.", error);
            return "failed" as const;
          }
        );

        const result = await Promise.race([connectResult, delay(BOOTSTRAP_TIMEOUT_MS, "timeout" as const)]);

        if (result !== "connected") {
          if (result === "timeout") {
            console.warn("Pizza Passport: Supabase didn't respond in time — falling back to local demo mode.");
          }
          fallBackToLocal();
        }
      } catch (error) {
        // Belt-and-suspenders — connectToSupabase() shouldn't throw past
        // its own catch above, but nothing here may ever hang the app.
        console.error("Pizza Passport: unexpected error during startup — falling back to local demo mode.", error);
        fallBackToLocal();
      } finally {
        if (!cancelled) setIsReady(true);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  async function setUsername(next: string): Promise<{ error?: string }> {
    const trimmed = next.trim();
    if (!trimmed) return { error: "Username can't be empty." };
    if (!userId) return { error: "Still connecting — try again in a moment." };

    if (isOfflineMode) {
      window.localStorage.setItem(USERNAME_KEY, trimmed);
      setUsernameState(trimmed);
      return {};
    }

    try {
      const supabase = getBrowserSupabaseClient();
      const { error } = await supabase.from("profiles").update({ username: trimmed }).eq("id", userId);
      if (error) {
        return {
          error: error.message.toLowerCase().includes("duplicate") ? "That username is taken." : error.message,
        };
      }
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Couldn't save — try again." };
    }

    window.localStorage.setItem(USERNAME_KEY, trimmed);
    setUsernameState(trimmed);
    return {};
  }

  return { isReady, userId, username, isOfflineMode, setUsername };
}
