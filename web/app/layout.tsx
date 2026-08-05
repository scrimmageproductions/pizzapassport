import type { Metadata } from "next";
import type { ReactNode } from "react";
import Navbar from "@/components/Navbar";
import SauceSplatter from "@/components/SauceSplatter";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pizza Passport",
  description:
    "A digital passport for pizza lovers — track visits, collect ink stamps, and share your journey.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-charcoal text-mozzarella antialiased">
        {/* Ambient pizzeria-counter texture: a dark tablecloth weave dusted
            with cornmeal, sitting quietly behind every page. */}
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-checkered-dark opacity-[0.08]" />
          <div className="absolute inset-0 bg-cornmeal opacity-[0.35]" />
          <SauceSplatter className="absolute -right-10 top-24 hidden sm:block" size={220} opacity={0.06} rotation={8} />
          <SauceSplatter
            className="absolute -left-16 bottom-10 hidden sm:block"
            size={260}
            opacity={0.05}
            rotation={-15}
            color="#5C0E17"
          />
        </div>

        <Navbar />
        <div className="mx-auto flex min-h-[calc(100vh-65px)] max-w-5xl flex-col px-4 pb-16 pt-8 sm:px-6">
          <main className="flex flex-1 flex-col">{children}</main>
          <footer className="mt-10 text-center text-xs text-mozzarella/40">
            © {new Date().getFullYear()} Pizza Passport
          </footer>
        </div>
      </body>
    </html>
  );
}
