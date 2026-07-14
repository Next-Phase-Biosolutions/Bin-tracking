"use client";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** True once the team's Supabase URL + anon key are present in env. */
export const supabaseConfigured = Boolean(url && key);

// Never throws when env is missing, so the app still builds/runs on mock data
// until you drop the real values into apps/web/.env.local.
export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  key || "public-anon-placeholder",
);
