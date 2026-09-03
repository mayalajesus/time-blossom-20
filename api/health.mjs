import { randomUUID } from "node:crypto";
import { getPool, providerEnv } from "../server/data-api.mjs";
import { captureServerError } from "../server/observability.mjs";
import { hasBearerSecret } from "../server/request-security.mjs";

function send(response, status, requestId, payload) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.setHeader("x-request-id", requestId);
  response.end(JSON.stringify({ ...payload, requestId }));
}

export default async function handler(request, response) {
  const requestId = randomUUID();
  if (request.method !== "GET") {
    response.setHeader("allow", "GET");
    send(response, 405, requestId, { status: "error", error: "Method not allowed." });
    return;
  }
  const url = new URL(request.url || "/api/health", "http://localhost");
  const deep = url.searchParams.get("deep") === "1";
  if (!deep) {
    send(response, 200, requestId, {
      status: "ok",
      version: process.env.VERCEL_GIT_COMMIT_SHA || "local",
    });
    return;
  }
  if (!hasBearerSecret(request, process.env.HEALTHCHECK_SECRET || "")) {
    send(response, 401, requestId, { status: "error", error: "Authentication is required." });
    return;
  }
  try {
    const config = providerEnv(process.env);
    const result = await getPool(config).query("select 1 as healthy");
    send(response, result.rows[0]?.healthy === 1 ? 200 : 503, requestId, {
      status: result.rows[0]?.healthy === 1 ? "ok" : "error",
      database: result.rows[0]?.healthy === 1 ? "reachable" : "unavailable",
      version: process.env.VERCEL_GIT_COMMIT_SHA || "local",
    });
  } catch (error) {
    captureServerError(error, { requestId, operation: "healthcheck", status: 503 });
    send(response, 503, requestId, {
      status: "error",
      database: "unavailable",
      error: "The service is temporarily unavailable.",
    });
  }
}
