import type { ReactNode } from "react";
import BizHeader from "@/components/biz/BizHeader";

/**
 * Shell for the entire merchant portal (`/biz/*`) — a deliberately distinct
 * "executive dark parchment" look (espresso background, gold serif
 * accents) rather than the consumer app's tomato/cream/checkered theme,
 * since pizzeria owners are a different audience running a business tool,
 * not logging a slice.
 */
export default function BizLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative -mx-4 -mt-8 min-h-[calc(100vh-65px)] overflow-hidden bg-[#1C1201] px-4 pb-16 pt-8 sm:-mx-6 sm:px-6">
      <div aria-hidden="true" className="absolute inset-0 bg-guilloche opacity-[0.04]" />
      <div className="relative mx-auto max-w-4xl">
        <BizHeader />
        {children}
      </div>
    </div>
  );
}
