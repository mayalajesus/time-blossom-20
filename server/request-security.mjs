import { timingSafeEqual } from "node:crypto";

export function hasBearerSecret(request, expectedSecret) {
  if (!expectedSecret) return false;
  const authorization = String(request.headers?.authorization ?? "");
  const provided = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!provided) return false;
  const actualBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expectedSecret);
  return (
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  );
}
