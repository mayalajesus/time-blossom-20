export interface AuthIdentityInput {
  id?: unknown;
  email?: unknown;
  name?: unknown;
  metadata?: Record<string, unknown>;
}

export interface AuthIdentity {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export function trustedGoogleAvatarUrl(value: unknown): string | null;
export function avatarDataValue(value: unknown, defaultAvatarUrls?: string[]): string | null;
export function extractAuthIdentity(input: AuthIdentityInput): AuthIdentity;
