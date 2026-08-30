import { createAuthClient } from "@neondatabase/auth";
import { SupabaseAuthAdapter } from "@neondatabase/auth/vanilla/adapters";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { authProvider, isSupabaseConfigured, neonAuthUrl, supabase } from "./supabase";

type ErrorLike = { message: string } | null;
type SessionResponse = { data: { session: Session | null }; error: ErrorLike };
type AuthResponse = { data: { session: Session | null }; error: ErrorLike };
type AuthSubscription = {
  data: { subscription: { unsubscribe: () => void } };
};
type AuthStateCallback = (event: AuthChangeEvent, session: Session | null) => void;

type AuthClient = {
  getSession: () => Promise<SessionResponse>;
  onAuthStateChange: (callback: AuthStateCallback) => AuthSubscription;
  signInWithPassword: (credentials: { email: string; password: string }) => Promise<AuthResponse>;
  signUp: (credentials: {
    email: string;
    password: string;
    options?: { emailRedirectTo?: string };
  }) => Promise<AuthResponse>;
  signInWithOAuth: (options: {
    provider: "google";
    options?: { redirectTo?: string };
  }) => Promise<{ error: ErrorLike }>;
  signOut: () => Promise<{ error: ErrorLike }>;
  resetPasswordForEmail: (
    email: string,
    options: { redirectTo?: string },
  ) => Promise<{ error: ErrorLike }>;
  updateUser: (attributes: { password?: string; email?: string }) => Promise<{ error: ErrorLike }>;
};

const neonAuth =
  authProvider === "neon" && neonAuthUrl
    ? createAuthClient(neonAuthUrl, { adapter: SupabaseAuthAdapter() })
    : null;

function unavailable(): never {
  throw new Error("Authentication is currently unavailable.");
}

export const isAuthConfigured = isSupabaseConfigured || Boolean(neonAuth);

export const authClient: AuthClient | null = isAuthConfigured
  ? {
      getSession: () => {
        if (supabase) return supabase.auth.getSession();
        if (neonAuth) return neonAuth.getSession() as unknown as Promise<SessionResponse>;
        return Promise.reject(unavailable());
      },
      onAuthStateChange: (callback) => {
        if (supabase) return supabase.auth.onAuthStateChange(callback);
        if (neonAuth) {
          return neonAuth.onAuthStateChange(callback) as unknown as AuthSubscription;
        }
        return unavailable();
      },
      signInWithPassword: (credentials) => {
        if (supabase) return supabase.auth.signInWithPassword(credentials);
        if (neonAuth) {
          return neonAuth.signInWithPassword(credentials) as unknown as Promise<AuthResponse>;
        }
        return Promise.reject(unavailable());
      },
      signUp: (credentials) => {
        if (supabase) return supabase.auth.signUp(credentials);
        if (neonAuth) return neonAuth.signUp(credentials) as unknown as Promise<AuthResponse>;
        return Promise.reject(unavailable());
      },
      signInWithOAuth: (options) => {
        if (supabase) return supabase.auth.signInWithOAuth(options);
        if (neonAuth) {
          return neonAuth.signInWithOAuth(options) as unknown as Promise<{ error: ErrorLike }>;
        }
        return Promise.reject(unavailable());
      },
      signOut: () => {
        if (supabase) return supabase.auth.signOut();
        if (neonAuth) return neonAuth.signOut() as unknown as Promise<{ error: ErrorLike }>;
        return Promise.reject(unavailable());
      },
      resetPasswordForEmail: (email, options) => {
        if (supabase) return supabase.auth.resetPasswordForEmail(email, options);
        if (neonAuth) {
          return neonAuth.resetPasswordForEmail(email, options) as unknown as Promise<{
            error: ErrorLike;
          }>;
        }
        return Promise.reject(unavailable());
      },
      updateUser: (attributes) => {
        if (supabase) return supabase.auth.updateUser(attributes);
        if (neonAuth) {
          return neonAuth.updateUser(attributes) as unknown as Promise<{ error: ErrorLike }>;
        }
        return Promise.reject(unavailable());
      },
    }
  : null;
