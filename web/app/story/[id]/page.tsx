"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Entry, Profile } from "@/lib/types";
import PassportStoryExporter from "@/components/PassportStoryExporter";

export default function StoryPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id as string);

  const [entry, setEntry] = useState<Entry | null>(null);
  const [username, setUsername] = useState<string>("pizzalover");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      const supabase = getBrowserSupabaseClient();
      const { data: entryData } = await supabase.from("entries").select("*").eq("id", id).single<Entry>();

      if (!entryData) {
        if (!cancelled) {
          setNotFoundState(true);
          setIsLoading(false);
        }
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", entryData.user_id)
        .single<Profile>();

      const profileUsername = profileData?.username ?? "pizzalover";
      const qrTarget = `${window.location.origin}/u/${profileUsername}`;
      const qrDataUrl = await QRCode.toDataURL(qrTarget, {
        margin: 1,
        width: 240,
        color: { dark: "#1C1C1E", light: "#FFFDD0" },
      });

      if (!cancelled) {
        setEntry(entryData);
        setUsername(profileUsername);
        setQrCode(qrDataUrl);
        setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (isLoading) {
    return <p className="py-20 text-center text-mozzarella/50">Loading your story…</p>;
  }
  if (notFoundState || !entry) {
    return <p className="py-20 text-center text-mozzarella/50">That check-in couldn&apos;t be found.</p>;
  }

  return <PassportStoryExporter entry={entry} username={username} qrCode={qrCode} />;
}
