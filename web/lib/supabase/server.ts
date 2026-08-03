import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase environment variables are not set — see web/.env.local.example."
  );
}

/**
 * Server-side Supabase client for the public passport viewer. Uses the
 * anon key only: every read here is already covered by the public-select
 * Row Level Security policies in `PizzaPassport/Resources/schema.sql`, so
 * no service-role key (and its elevated privileges) is needed.
 */
export function createServerSupabaseClient() {
  return createClient(supabaseUrl ?? "", supabaseAnonKey ?? "", {
    auth: { persistSession: false },
  });
}
