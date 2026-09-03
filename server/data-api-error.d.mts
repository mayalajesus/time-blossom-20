export class DataApiError extends Error {
  constructor(status: number, message: string, options?: { code?: string; retryAfter?: number });
  status: number;
  code?: string;
  retryAfter?: number;
}
