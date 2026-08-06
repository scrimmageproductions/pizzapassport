"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { Entry } from "@/lib/types";
import PassportEntryCard from "./PassportEntryCard";

/**
 * Modal chrome around a single passport entry: backdrop, close button, and
 * enter/exit motion. The actual "official passport page" content lives in
 * `PassportEntryCard` so it can be reused without this overlay later (e.g.
 * a printable export) — this component only owns the overlay behavior.
 */
export default function PassportDetailModal({ entry, onClose }: { entry: Entry | null; onClose: () => void }) {
  useEffect(() => {
    if (!entry) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [entry, onClose]);

  return (
    <AnimatePresence>
      {entry ? (
        <motion.div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={onClose}
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="relative w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute -right-3 -top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#FDFBF7] bg-[#2C1A14] text-[#FDFBF7] shadow-lg transition hover:scale-105"
            >
              <X className="h-4 w-4" />
            </button>
            <PassportEntryCard entry={entry} />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
