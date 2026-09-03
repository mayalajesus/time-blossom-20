import type { Pool, PoolClient } from "pg";

export const TERMS_VERSION: string;
export const PRIVACY_VERSION: string;
export const ACCOUNT_DELETION_DAYS: number;
export function getAccountDeletionStatus(client: PoolClient, userId: string): Promise<unknown>;
export function acceptLegalTerms(
  client: PoolClient,
  userId: string,
  locale: unknown,
): Promise<unknown>;
export function enforceAccountLifecycle(
  client: PoolClient,
  userId: string,
  operation: string,
): Promise<void>;
export function transferWorkspaceOwnership(
  client: PoolClient,
  userId: string,
  body: Record<string, unknown>,
): Promise<{ workspaceId: string; ownerId: string }>;
export function exportAccountData(
  client: PoolClient,
  user: { id: string; email: string },
): Promise<unknown>;
export function requestAccountDeletion(
  client: PoolClient,
  user: { id: string; email: string; authenticatedAt?: number },
  body: Record<string, unknown>,
): Promise<unknown>;
export function cancelAccountDeletion(client: PoolClient, userId: string): Promise<null>;
export function processDueAccountDeletions(
  pool: Pool,
  admin: unknown,
  limit?: number,
): Promise<{ selected: number; completed: number; failed: number }>;
