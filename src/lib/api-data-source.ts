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
  return (await authClient?.getJWTToken?.()) ?? "";
}

async function request<T>(
  operation: string,
  payload: Record<string, unknown> = {},
): Promise<DataSourceResult<T>> {
  const currentSession = await session();
  if (!currentSession.success) return fail<T>(currentSession.error);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${await token(currentSession.data)}`,
      },
      body: JSON.stringify({ operation, ...payload }),
    });
    const body = (await response.json().catch(() => null)) as { data?: T; error?: string } | null;
    if (!response.ok) return fail(body?.error ?? "The data request failed.");
    if (body?.error) return fail(body.error);
    return ok(body?.data as T);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "The data request failed.");
  }
}

export function createApiDataSource(): AccountDataSource {
  return {
    loadAccount: (userId) => request<PersistedAccount>("loadAccount", { userId }),
    syncAccount: (userId, account) => request<null>("syncAccount", { userId, account }),
    getActiveTimer: (userId, workspaceId) =>
      request<TimerState | null>("getActiveTimer", { userId, workspaceId }),
    saveActiveTimer: (userId, timer) => request<TimerState>("saveActiveTimer", { userId, timer }),
    clearActiveTimer: (userId, workspaceId) =>
      request<null>("clearActiveTimer", { userId, workspaceId }),
  };
}
