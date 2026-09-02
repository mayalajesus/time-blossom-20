export interface QueryClient {
  query: (...args: unknown[]) => Promise<{
    rowCount?: number | null;
    rows?: Array<Record<string, unknown>>;
  }>;
}

export function upsertOwnEntry(
  client: QueryClient,
  userId: string,
  workspaceId: string,
  entry: Record<string, unknown>,
  entryId: string,
): Promise<void>;
export function syncEntries(
  client: QueryClient,
  userId: string,
  workspaceId: string,
  entries: Array<Record<string, unknown>>,
): Promise<void>;
export function readBody(request: unknown): Promise<Record<string, unknown>>;
export function handleDataRequest(
  request: unknown,
  response: unknown,
  env?: Record<string, string | undefined>,
): Promise<void>;
export function createDataMiddleware(
  env?: Record<string, string | undefined>,
): (request: unknown, response: unknown) => void;
