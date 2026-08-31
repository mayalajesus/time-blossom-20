import type { Session } from "@supabase/supabase-js";
import { authClient } from "./auth-client";
import { getAuthRedirect } from "./supabase";
import { getAuthReturnPath } from "./auth-redirect";

export type AuthResult<T = undefined> =
  { success: true; data?: T } | { success: false; error: string };

function getError(error: { message: string } | null): AuthResult<never> | null {
  return error ? { success: false, error: error.message } : null;
}

function requireClient(): AuthResult<never> | null {
  return authClient ? null : { success: false, error: "Authentication is currently unavailable." };
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<AuthResult<Session>> {
  const unavailable = requireClient();
  if (unavailable) return unavailable;
  let response;
  try {
    response = await authClient!.signInWithPassword({ email, password });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to sign in." };
  }
  const failure = getError(response.error);
  return (
    failure ??
    (response.data.session ? { success: true, data: response.data.session } : { success: true })
  );
}

export async function signUpWithPassword(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
): Promise<AuthResult<Session>> {
  const unavailable = requireClient();
  if (unavailable) return unavailable;
  const name = `${firstName.trim()} ${lastName.trim()}`.replace(/\s+/g, " ");
  const response = await authClient!.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getAuthRedirect(),
      data: { name, displayName: name, firstName: firstName.trim(), lastName: lastName.trim() },
    },
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
  const redirect = new URL(getAuthRedirect());
  redirect.searchParams.set("redirect", getAuthReturnPath());
  const { error } = await authClient!.signInWithOAuth({
    provider: "google",
    options: { redirectTo: redirect.toString() },
  });
  return getError(error) ?? { success: true };
}

export async function signOut(): Promise<AuthResult> {
  const unavailable = requireClient();
  if (unavailable) return unavailable;
  const { error } = await authClient!.signOut();
  return getError(error) ?? { success: true };
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const unavailable = requireClient();
  if (unavailable) return unavailable;
  const { error } = await authClient!.resetPasswordForEmail(email, {
    redirectTo: getAuthRedirect("/settings"),
  });
  return getError(error) ?? { success: true };
}

export async function updatePassword(password: string): Promise<AuthResult> {
  const unavailable = requireClient();
  if (unavailable) return unavailable;
  const { error } = await authClient!.updateUser({ password });
  return getError(error) ?? { success: true };
}

export async function updateEmail(email: string): Promise<AuthResult> {
  const unavailable = requireClient();
  if (unavailable) return unavailable;
  const { error } = await authClient!.updateUser({ email });
  return getError(error) ?? { success: true };
}
