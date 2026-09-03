import type { PoolClient } from "pg";
import type { IncomingMessage } from "node:http";

export type RateLimitScope = {
  scope: "general" | "read" | "sync" | "sensitive" | "export";
  limit: number;
  windowMs: number;
};

export function rateLimitScopes(
  operation: string,
  options?: { includesUpload?: boolean },
): RateLimitScope[];
export function requestIp(request: IncomingMessage): string;
export function enforceIpBurstLimit(request: IncomingMessage, now?: number): void;
export function enforceUserRateLimits(
  client: PoolClient,
  userId: string,
  operation: string,
  now?: Date,
  options?: { includesUpload?: boolean },
): Promise<void>;
export function resetIpRateLimitsForTests(): void;
