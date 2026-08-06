"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Store } from "lucide-react";
import clsx from "clsx";
import { getCurrentMerchant, signOutMerchant, type MerchantSession } from "@/lib/merchant";

const LINKS = [
  { href: "/biz/dashboard", label: "Dashboard" },
  { href: "/biz/stamp", label: "Stamp Design" },
];

/** Shared header for every `/biz` page — distinct "executive dark
 * parchment" look from the consumer app's tomato/cream palette, since this
 * is a completely different audience (pizzeria owners, not customers). */
export default function BizHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<MerchantSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getCurrentMerchant()
      .then((result) => {
        if (!cancelled) setSession(result);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  async function handleSignOut() {
    await signOutMerchant();
    router.push("/biz/claim");
  }

  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-[#D1A34F]/20 pb-4">
      <Link href="/biz/dashboard" className="flex items-center gap-2">
        <Store className="h-5 w-5 text-[#D1A34F]" />
        <div>
          <p className="font-serif text-lg font-bold text-[#FDFBF7]">Pizza Passport for Business</p>
          {session?.merchant ? (
            <p className="text-xs text-[#FDFBF7]/50">{session.merchant.business_name}</p>
          ) : null}
        </div>
      </Link>

      <nav className="flex items-center gap-1">
        {!isLoading && session?.merchant
          ? LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                  pathname === link.href
                    ? "bg-[#D1A34F] text-[#1C1201]"
                    : "text-[#FDFBF7]/60 hover:bg-white/5 hover:text-[#FDFBF7]"
                )}
              >
                {link.label}
              </Link>
            ))
          : null}

        {!isLoading && session ? (
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-[#FDFBF7]/60 hover:bg-white/5 hover:text-[#FDFBF7]"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        ) : null}
      </nav>
    </div>
  );
}
