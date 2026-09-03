export function sanitizeTelemetry<T>(value: T): T;
export function initializeServerObservability(env?: NodeJS.ProcessEnv): void;
export function captureServerError(
  error: unknown,
  context: { requestId: string; operation?: string; status?: number },
  env?: NodeJS.ProcessEnv,
): void;
