export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center">
      <span className="text-4xl">🍕</span>
      <h1 className="font-serif text-xl font-bold text-mozzarella">
        Passport not found
      </h1>
      <p className="text-sm text-mozzarella/60">
        This pizza lover hasn&apos;t claimed a public passport yet.
      </p>
    </div>
  );
}
