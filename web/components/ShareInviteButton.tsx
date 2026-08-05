"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";

interface ShareInviteButtonProps {
  /** Path to share, e.g. `/place/osm:123456` — the absolute URL is built
   * client-side from `window.location.origin` so this works the same in
   * local dev and in production without needing a configured site URL. */
  path: string;
  title: string;
  label?: string;
}

/** "Invite a friend here" — uses the native share sheet where available,
 * falling back to copying the link to the clipboard. */
export default function ShareInviteButton({ path, title, label = "Invite a friend here" }: ShareInviteButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = `${window.location.origin}${path}`;

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // User cancelled or the share sheet failed — fall through to copy.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard permission and no share sheet — nothing more to do.
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-mozzarella/80 transition hover:bg-white/5"
    >
      {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      {copied ? "Link copied!" : label}
    </button>
  );
}
