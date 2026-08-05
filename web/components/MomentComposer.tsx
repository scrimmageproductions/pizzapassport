"use client";

import { useState } from "react";
import { Camera, Loader2 } from "lucide-react";

interface MomentComposerProps {
  restaurantName: string;
  onSave: (input: { photo: File | null; note: string }) => Promise<void>;
  onSkip: () => void;
}

/**
 * Optional photo + note a user can attach to a check-in right after
 * saving it — a POAP-style "Moment," grouped under the pizzeria it
 * belongs to (see app/place/[placeId]) rather than living only on the
 * user's own passport.
 */
export default function MomentComposer({ restaurantName, onSave, onSkip }: MomentComposerProps) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function handlePhotoChange(file: File | null) {
    if (!file) return;
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await onSave({ photo, note: note.trim() });
    } finally {
      setIsSaving(false);
    }
  }

  const hasContent = photo !== null || note.trim().length > 0;

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div>
        <h2 className="font-serif text-xl font-bold text-mozzarella">Add a Moment?</h2>
        <p className="text-sm text-mozzarella/60">
          Drop a photo or a quick note about {restaurantName} — it&apos;ll live under this pizzeria&apos;s page for
          other pizza lovers to see.
        </p>
      </div>

      <label className="block w-full cursor-pointer">
        <div className="relative flex h-40 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          {photoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoPreview} alt="Moment" className="h-full w-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-mozzarella/40">
              <Camera className="h-6 w-6" />
              <span className="text-xs">Add a photo (optional)</span>
            </div>
          )}
        </div>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)}
        />
      </label>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What made this slice memorable? (optional)"
        rows={3}
        maxLength={280}
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-mozzarella placeholder:text-mozzarella/30 focus:border-tomato focus:outline-none"
      />

      <div className="flex w-full items-center justify-between gap-3">
        <button type="button" onClick={onSkip} className="text-sm font-semibold text-mozzarella/50 underline">
          Skip
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasContent || isSaving}
          className="flex items-center gap-2 rounded-full bg-tomato px-6 py-2.5 text-sm font-bold text-mozzarella disabled:opacity-40"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save Moment
        </button>
      </div>
    </div>
  );
}
