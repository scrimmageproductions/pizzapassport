"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, PlusCircle } from "lucide-react";
import clsx from "clsx";
import CheckeredBand from "./CheckeredBand";

const LINKS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/passport", label: "Passport", icon: BookOpen },
  { href: "/check-in", label: "Check In", icon: PlusCircle },
];

/** Sticky top nav shared across every route, with active-link highlighting. */
export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 bg-charcoal/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">🍕</span>
          <span className="font-serif text-lg font-bold tracking-tight text-mozzarella">
            Pizza Passport
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition",
                  active
                    ? "bg-tomato text-mozzarella"
                    : "text-mozzarella/60 hover:bg-white/5 hover:text-mozzarella"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      <CheckeredBand />
    </header>
  );
}
