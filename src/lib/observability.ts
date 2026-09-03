import * as Sentry from "@sentry/react";

const SENSITIVE_KEY =
  /authorization|cookie|token|email|description|task|query|sql|database|signed|url/i;

function sanitizeText(value: string) {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [Filtered]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[Filtered email]")
    .replace(/(?:postgres(?:ql)?|https?):\/\/[^\s"']+/gi, "[Filtered URL]");
}

export function sanitizeClientTelemetry(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") return sanitizeText(value);
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeClientTelemetry(item, seen));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key) ? "[Filtered]" : sanitizeClientTelemetry(item, seen),
    ]),
  );
}

let initialized = false;

export function initializeClientObservability(router: unknown) {
  const dsn = import.meta.env["VITE_SENTRY_DSN"]?.trim();
  if (initialized || !dsn || import.meta.env.DEV) return;
  Sentry.init({
    dsn,
    environment: import.meta.env["VITE_APP_ENV"] || import.meta.env.MODE,
    release: import.meta.env["VITE_VERCEL_GIT_COMMIT_SHA"] || undefined,
    sendDefaultPii: false,
    integrations(defaultIntegrations) {
      return [
        ...defaultIntegrations.filter(
          (integration) => !integration.name.toLowerCase().includes("replay"),
        ),
        Sentry.tanstackRouterBrowserTracingIntegration(router),
      ];
    },
    tracesSampleRate: 0.1,
    beforeSend(event) {
      return sanitizeClientTelemetry(event) as typeof event;
    },
    beforeSendTransaction(event) {
      return sanitizeClientTelemetry(event) as typeof event;
    },
    beforeBreadcrumb(breadcrumb) {
      return sanitizeClientTelemetry(breadcrumb) as typeof breadcrumb;
    },
  });
  initialized = true;
}

export function captureClientError(error: unknown) {
  if (import.meta.env["VITE_SENTRY_DSN"] && !import.meta.env.DEV) {
    Sentry.captureException(error);
  }
}
