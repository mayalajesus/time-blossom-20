import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"];
const supabasePublishableKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
const neonAuthUrl = import.meta.env["VITE_NEON_AUTH_URL"];
const requestedAuthProvider = import.meta.env["VITE_AUTH_PROVIDER"];
const isProductionEnvironment = import.meta.env["VITE_APP_ENV"] === "production";

export type AuthProvider = "local" | "neon" | "supabase";

export const authProvider: AuthProvider = isProductionEnvironment
  ? "supabase"
  : requestedAuthProvider === "neon" || requestedAuthProvider === "supabase"
    ? requestedAuthProvider
    : neonAuthUrl
      ? "neon"
      : supabaseUrl && supabasePublishableKey
        ? "supabase"
        : "local";

export const isSupabaseConfigured = Boolean(
  authProvider === "supabase" && supabaseUrl && supabasePublishableKey,
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export { neonAuthUrl };

export function getAuthRedirect(path = "/auth/callback"): string {
  return new URL(path, window.location.origin).toString();
}
