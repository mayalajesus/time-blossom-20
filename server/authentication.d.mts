export type DataApiAuthenticationConfig = {
  databaseProvider: string;
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  neonAuthUrl?: string;
  neonAuthIssuer?: string;
};

export type AuthenticatedDataUser = {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
};

type QueryResult = { rows: Array<Record<string, unknown>> };
type Pool = { query: (sql: string, values?: unknown[]) => Promise<QueryResult> };

export function authenticateDataRequest(
  request: { headers?: Record<string, string | undefined> },
  config: DataApiAuthenticationConfig,
  getPool: (config: DataApiAuthenticationConfig) => Pool,
): Promise<AuthenticatedDataUser>;
