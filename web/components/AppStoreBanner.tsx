import { Download } from "lucide-react";

/**
 * Bottom-of-page call-to-action inviting web visitors — who by definition
 * don't have the app yet — to download Pizza Passport for iOS.
 */
export default function AppStoreBanner() {
  return (
    <a
      href="https://apps.apple.com/app/pizza-passport"
      target="_blank"
      rel="noreferrer"
      className="mt-10 flex items-center justify-between gap-4 rounded-2xl border border-tomato/30 bg-gradient-to-r from-tomato/20 to-transparent p-5 transition hover:border-tomato/60"
    >
      <div>
        <p className="font-serif text-lg font-bold text-mozzarella">
          Start your own passport
        </p>
        <p className="text-sm text-mozzarella/60">
          Download Pizza Passport on the iOS App Store.
        </p>
      </div>
      <span className="flex shrink-0 items-center gap-2 rounded-full bg-tomato px-4 py-2 text-sm font-semibold text-mozzarella">
        <Download className="h-4 w-4" />
        Get the App
      </span>
    </a>
  );
}
