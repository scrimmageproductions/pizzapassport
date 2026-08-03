import type { Entry } from "@/lib/types";
import EntryCard from "./EntryCard";

interface StampGridProps {
  entries: Entry[];
}

/** Renders every collected stamp for a public passport as a responsive grid. */
export default function StampGrid({ entries }: StampGridProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-mozzarella/60">
        No stamps collected yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map((entry) => (
        <EntryCard key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
