import AppStoreBanner from "@/components/AppStoreBanner";

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-16 text-center">
      <h1 className="font-serif text-3xl font-bold text-mozzarella">
        Your pizza journey, stamped.
      </h1>
      <p className="max-w-md text-mozzarella/60">
        Pizza Passport is a digital passport for pizza lovers. Check in at
        every pizzeria, collect ink stamps, and share your story. Visit a
        passport at{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5 text-crust">
          /u/&lt;username&gt;
        </code>
        .
      </p>
      <AppStoreBanner />
    </div>
  );
}
