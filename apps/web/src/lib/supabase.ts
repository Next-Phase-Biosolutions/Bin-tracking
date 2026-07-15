import { createClient } from "@supabase/supabase-js";

const url = (import.meta.env.VITE_SUPABASE_URL as string) ?? "";
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ?? "";

/** True only when real Supabase creds are present; the app runs in demo mode otherwise. */
export const supabaseConfigured = Boolean(url && key);

// Never throws when env is missing, so the app still builds/runs on mock data
// until the real values are dropped into the monorepo-root .env.
export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  key || "public-anon-placeholder",
);
