"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "./supabase/client";

const USERNAME_KEY = "pizza-passport:username";

function randomUsername() {
  const adjectives = ["cheesy", "saucy", "crispy", "smoky", "zesty", "doughy"];
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${adjective}-slice-${suffix}`;
}

export interface LocalProfile {
  isReady: boolean;
  userId: string | null;
  username: string;
  setUsername: (next: string) => Promise<{ error?: string }>;
}

/**
 * Client-side identity for the standalone web app: signs the visitor in
 * anonymously via Supabase Auth (no login screen, no password), then keeps
 * a public `username` in sync between localStorage and their `profiles`
 * row. This mirrors the anonymous-first model `SupabaseService.ensureSession()`
 * uses on iOS, so a web-only visitor can create a passport, check in, and
 * get a shareable `/u/<username>` link with zero signup friction.
 */
export function useLocalProfile(): LocalProfile {
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsernameState] = useState<string>("");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const supabase = getBrowserSupabaseClient();

      const { data: sessionData } = await supabase.auth.getSession();
      let session = sessionData.session;

      if (!session) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) {
          console.error("Anonymous sign-in failed:", error.message);
          return;
        }
        session = data.session;
      }
      if (!session || cancelled) return;

      const storedUsername = window.localStorage.getItem(USERNAME_KEY) ?? randomUsername();
      window.localStorage.setItem(USERNAME_KEY, storedUsername);

      await supabase.from("profiles").upsert(
        { id: session.user.id, username: storedUsername, is_vip: false },
        { onConflict: "id" }
      );

      if (!cancelled) {
        setUserId(session.user.id);
        setUsernameState(storedUsername);
        setIsReady(true);
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

    const supabase = getBrowserSupabaseClient();
    const { error } = await supabase.from("profiles").update({ username: trimmed }).eq("id", userId);
    if (error) {
      return { error: error.message.toLowerCase().includes("duplicate") ? "That username is taken." : error.message };
    }

    window.localStorage.setItem(USERNAME_KEY, trimmed);
    setUsernameState(trimmed);
    return {};
  }

  return { isReady, userId, username, setUsername };
}
