import * as Sentry from "@sentry/node";

const SENSITIVE_KEY =
  /authorization|cookie|token|email|description|task|query|sql|database|signed|url/i;
let initialized = false;

function sanitizeText(value) {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [Filtered]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[Filtered email]")
    .replace(/(?:postgres(?:ql)?|https?):\/\/[^\s"']+/gi, "[Filtered URL]");
}

export function sanitizeTelemetry(value, seen = new WeakSet()) {
  if (typeof value === "string") return sanitizeText(value);
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeTelemetry(item, seen));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key) ? "[Filtered]" : sanitizeTelemetry(item, seen),
    ]),
  );
}

export function initializeServerObservability(env = process.env) {
  if (initialized || !env.SENTRY_DSN) return;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.VERCEL_ENV || env.NODE_ENV || "development",
    release: env.VERCEL_GIT_COMMIT_SHA || undefined,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    beforeSend(event) {
      return sanitizeTelemetry(event);
    },
    beforeSendTransaction(event) {
      return sanitizeTelemetry(event);
    },
    beforeBreadcrumb(breadcrumb) {
      return sanitizeTelemetry(breadcrumb);
    },
  });
  initialized = true;
}

export function captureServerError(error, context, env = process.env) {
  initializeServerObservability(env);
  if (!env.SENTRY_DSN) return;
  Sentry.withScope((scope) => {
    scope.setTags({
      request_id: context.requestId,
      operation: context.operation || "unknown",
      http_status: String(context.status || 500),
    });
    Sentry.captureException(error);
  });
}
