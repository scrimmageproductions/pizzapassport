import type { Metadata } from "next";
import type { ReactNode } from "react";
import Navbar from "@/components/Navbar";
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
        <Navbar />
        <div className="mx-auto flex min-h-[calc(100vh-57px)] max-w-5xl flex-col px-4 pb-16 pt-8 sm:px-6">
          <main className="flex flex-1 flex-col">{children}</main>
          <footer className="mt-10 text-center text-xs text-mozzarella/40">
            © {new Date().getFullYear()} Pizza Passport
          </footer>
        </div>
      </body>
    </html>
  );
}
