import type { AuthError, AuthResponse, Session } from "@supabase/supabase-js";
import { getAuthRedirect, supabase } from "./supabase";

export type AuthResult<T = undefined> =
  { success: true; data?: T } | { success: false; error: string };

function getError(error: AuthError | null): AuthResult<never> | null {
  return error ? { success: false, error: error.message } : null;
}

function requireClient(): AuthResult<never> | null {
  return supabase ? null : { success: false, error: "Authentication is currently unavailable." };
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<AuthResult<Session>> {
  const unavailable = requireClient();
  if (unavailable) return unavailable;
  const response: AuthResponse = await supabase!.auth.signInWithPassword({ email, password });
  const failure = getError(response.error);
  return (
    failure ??
    (response.data.session ? { success: true, data: response.data.session } : { success: true })
  );
}

export async function signUpWithPassword(
  email: string,
  password: string,
): Promise<AuthResult<Session>> {
  const unavailable = requireClient();
  if (unavailable) return unavailable;
  const response = await supabase!.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: getAuthRedirect() },
  });
  const failure = getError(response.error);
  return (
    failure ??
    (response.data.session ? { success: true, data: response.data.session } : { success: true })
  );
}

export async function signInWithGoogle(): Promise<AuthResult> {
  const unavailable = requireClient();
  if (unavailable) return unavailable;
  const { error } = await supabase!.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: getAuthRedirect() },
  });
  return getError(error) ?? { success: true };
}

export async function signOut(): Promise<AuthResult> {
  const unavailable = requireClient();
  if (unavailable) return unavailable;
  const { error } = await supabase!.auth.signOut();
  return getError(error) ?? { success: true };
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const unavailable = requireClient();
  if (unavailable) return unavailable;
  const { error } = await supabase!.auth.resetPasswordForEmail(email, {
    redirectTo: getAuthRedirect("/settings"),
  });
  return getError(error) ?? { success: true };
}

export async function updatePassword(password: string): Promise<AuthResult> {
  const unavailable = requireClient();
  if (unavailable) return unavailable;
  const { error } = await supabase!.auth.updateUser({ password });
  return getError(error) ?? { success: true };
}

export async function updateEmail(email: string): Promise<AuthResult> {
  const unavailable = requireClient();
  if (unavailable) return unavailable;
  const { error } = await supabase!.auth.updateUser({ email });
  return getError(error) ?? { success: true };
}
