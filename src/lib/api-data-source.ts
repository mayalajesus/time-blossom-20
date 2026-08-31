import type { Session } from "@supabase/supabase-js";
import { authClient } from "./auth-client";
import type { AccountDataSource } from "./account-data-source";
import type { DataSourceResult } from "./data-source";
import type { PersistedAccount, TimerState } from "./store";

const apiBaseUrl = (import.meta.env["VITE_API_BASE_URL"] ?? "").replace(/\/$/, "");
const endpoint = `${apiBaseUrl}/api/data`;

function fail<T>(error: string): DataSourceResult<T> {
  return { success: false, error };
}

function ok<T>(data: T): DataSourceResult<T> {
  return { success: true, data };
}

async function session(): Promise<DataSourceResult<Session>> {
  if (!authClient) return fail("Authentication is currently unavailable.");
  try {
    const response = await authClient.getSession();
    if (response.error) return fail(response.error.message);
    if (!response.data.session) return fail("Authentication is required.");
    return ok(response.data.session);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "The session request failed.");
  }
}

async function token(currentSession: Session): Promise<string> {
  if (currentSession.access_token) return currentSession.access_token;
  const sessionToken = (await authClient?.getJWTToken?.()) ?? "";
  if (!sessionToken) throw new Error("Your authentication session is unavailable.");
  return sessionToken;
}

async function request<T>(
  operation: string,
  payload: Record<string, unknown> = {},
): Promise<DataSourceResult<T>> {
  const currentSession = await session();
  if (!currentSession.success) return fail<T>(currentSession.error);

  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    const response = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${await token(currentSession.data)}`,
      },
      body: JSON.stringify({ operation, ...payload }),
    });
    window.clearTimeout(timeout);
    const body = (await response.json().catch(() => null)) as { data?: T; error?: string } | null;
    const message = body?.error?.trim() || `The data request failed (${response.status}).`;
    if (!response.ok) return fail(message);
    if (body?.error) return fail(message);
    return ok(body?.data as T);
  } catch (error) {
    return fail(
      error instanceof DOMException && error.name === "AbortError"
        ? "The data request timed out."
        : error instanceof Error
          ? error.message
          : "The data request failed.",
    );
  }
}

export function createApiDataSource(): AccountDataSource {
  return {
    loadAccount: () => request<PersistedAccount>("loadAccount"),
    syncAccount: (_userId, account) => request<null>("syncAccount", { account }),
    getActiveTimer: (_userId, workspaceId) =>
      request<TimerState | null>("getActiveTimer", { workspaceId }),
    saveActiveTimer: (_userId, timer) => request<TimerState>("saveActiveTimer", { timer }),
    clearActiveTimer: (_userId, workspaceId) => request<null>("clearActiveTimer", { workspaceId }),
  };
}
