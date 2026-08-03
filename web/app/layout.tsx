import type { Metadata } from "next";
import type { ReactNode } from "react";
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
        <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 pb-10 pt-8 sm:px-6">
          <header className="mb-8 flex items-center justify-center gap-2">
            <span className="text-2xl">🍕</span>
            <span className="font-serif text-xl font-bold tracking-tight text-mozzarella">
              Pizza Passport
            </span>
          </header>
          <main className="flex flex-1 flex-col">{children}</main>
          <footer className="mt-10 text-center text-xs text-mozzarella/40">
            © {new Date().getFullYear()} Pizza Passport
          </footer>
        </div>
      </body>
    </html>
  );
}
