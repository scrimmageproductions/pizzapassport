import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Entry, Moment, Pizzeria } from "@/lib/types";
import CheckeredBand from "@/components/CheckeredBand";
import SauceSplatter from "@/components/SauceSplatter";
import ShareInviteButton from "@/components/ShareInviteButton";
import AppStoreBanner from "@/components/AppStoreBanner";

interface MomentWithAuthor extends Moment {
  profiles: { username: string; avatar_url: string | null } | null;
}

interface PageProps {
  params: { placeId: string };
}

async function getPizzeriaData(placeId: string) {
  const supabase = createServerSupabaseClient();

  const { data: pizzeria } = await supabase
    .from("pizzerias")
    .select("*")
    .eq("place_id", placeId)
    .single<Pizzeria>();

  if (!pizzeria) return null;

  // Both queries go through the same RLS policies a public web visitor
  // gets (no session on the server client) — so this naturally only shows
  // entries/moments from users whose profile is public, exactly matching
  // "the pizzeria's aggregated Moments view (if public)".
  const { data: entries } = await supabase
    .from("entries")
    .select("*")
    .eq("place_id", placeId)
    .order("created_at", { ascending: false })
    .returns<Entry[]>();

  const { data: moments } = await supabase
    .from("moments")
    .select("*, profiles(username, avatar_url)")
    .eq("place_id", placeId)
    .order("created_at", { ascending: false })
    .returns<MomentWithAuthor[]>();

  return { pizzeria, entries: entries ?? [], moments: moments ?? [] };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const data = await getPizzeriaData(params.placeId);
  const name = data?.pizzeria.name ?? "Pizzeria";
  return {
    title: `${name} · Pizza Passport`,
    description: `See public stamps and Moments from pizza lovers who checked in at ${name}.`,
  };
}

export default async function PizzeriaPage({ params }: PageProps) {
  const data = await getPizzeriaData(params.placeId);
  if (!data) {
    notFound();
  }

  const { pizzeria, entries, moments } = data;
  const averageRating =
    entries.length > 0 ? entries.reduce((sum, entry) => sum + entry.rating, 0) / entries.length : 0;
  const mapsUrl =
    pizzeria.latitude != null && pizzeria.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${pizzeria.latitude},${pizzeria.longitude}`
      : null;

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center">
        <div aria-hidden="true" className="absolute inset-0 bg-cornmeal opacity-[0.2]" />
        <SauceSplatter className="absolute -left-5 -top-5" size={100} opacity={0.28} />

        <div className="relative">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-tomato/20 text-3xl">
            🍕
          </div>
          <h1 className="font-serif text-2xl font-bold text-mozzarella">{pizzeria.name}</h1>
          {mapsUrl ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs text-mozzarella/50 hover:text-crust"
            >
              <MapPin className="h-3 w-3" />
              View on Google Maps
            </a>
          ) : null}

          <dl className="mt-5 grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs uppercase tracking-wide text-mozzarella/50">Stamps</dt>
              <dd className="text-xl font-bold text-mozzarella">{entries.length}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-mozzarella/50">Avg Plates</dt>
              <dd className="text-xl font-bold text-mozzarella">{averageRating.toFixed(1)}</dd>
            </div>
          </dl>

          <CheckeredBand className="mx-auto mt-5 max-w-[160px] rounded-full opacity-70" />

          <div className="mt-5 flex justify-center">
            <ShareInviteButton
              path={`/place/${encodeURIComponent(pizzeria.place_id)}`}
              title={`Check in at ${pizzeria.name} on Pizza Passport`}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-xl font-bold text-mozzarella">Moments here</h2>
        {moments.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm text-mozzarella/50">
            No public Moments here yet — be the first to check in and leave one.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {moments.map((moment) => (
              <MomentCard key={moment.id} moment={moment} />
            ))}
          </div>
        )}
      </section>

      <AppStoreBanner />
    </div>
  );
}

function MomentCard({ moment }: { moment: MomentWithAuthor }) {
  const author = moment.profiles?.username ?? "a pizza lover";
  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
      {moment.photo_url ? (
        <div className="relative aspect-video w-full">
          <Image src={moment.photo_url} alt={`Moment by @${author}`} fill className="object-cover" />
        </div>
      ) : null}
      <div className="p-4">
        {moment.note ? <p className="text-sm text-mozzarella/80">&ldquo;{moment.note}&rdquo;</p> : null}
        <p className="mt-2 text-xs text-mozzarella/40">
          —{" "}
          <Link href={`/u/${author}`} className="text-crust hover:underline">
            @{author}
          </Link>
        </p>
      </div>
    </article>
  );
}
