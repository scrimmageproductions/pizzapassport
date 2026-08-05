import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Entry, Profile } from "@/lib/types";
import StampGrid from "@/components/StampGrid";
import AppStoreBanner from "@/components/AppStoreBanner";
import CheckeredBand from "@/components/CheckeredBand";
import SauceSplatter from "@/components/SauceSplatter";

interface PageProps {
  params: { username: string };
}

async function getProfileWithEntries(username: string) {
  const supabase = createServerSupabaseClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single<Profile>();

  if (!profile) return null;

  const { data: entries } = await supabase
    .from("entries")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .returns<Entry[]>();

  return { profile, entries: entries ?? [] };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  return {
    title: `@${params.username} · Pizza Passport`,
    description: `See every stamp @${params.username} has collected on Pizza Passport.`,
  };
}

export default async function PublicPassportPage({ params }: PageProps) {
  const data = await getProfileWithEntries(params.username);

  if (!data) {
    notFound();
  }

  const { profile, entries } = data;
  const averageRating =
    entries.length > 0
      ? entries.reduce((sum, entry) => sum + entry.rating, 0) / entries.length
      : 0;

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center">
        <div aria-hidden="true" className="absolute inset-0 bg-cornmeal opacity-[0.22]" />
        <SauceSplatter className="absolute -right-5 -top-5" size={100} opacity={0.28} />
        <div className="relative">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-tomato/20 text-3xl">
            🍕
          </div>
          <h1 className="font-serif text-2xl font-bold text-mozzarella">
            @{profile.username}
          </h1>
          {profile.is_vip ? (
            <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-crust">
              👑 VIP Passport Holder
            </p>
          ) : null}

          <dl className="mt-5 grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs uppercase tracking-wide text-mozzarella/50">
                Stamps
              </dt>
              <dd className="text-xl font-bold text-mozzarella">
                {entries.length}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-mozzarella/50">
                Avg Plates
              </dt>
              <dd className="text-xl font-bold text-mozzarella">
                {averageRating.toFixed(1)}
              </dd>
            </div>
          </dl>

          <CheckeredBand className="mx-auto mt-5 max-w-[160px] rounded-full opacity-70" />
        </div>
      </section>

      <StampGrid entries={entries} />

      <AppStoreBanner />
    </div>
  );
}
