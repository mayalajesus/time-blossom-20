import type { IncomingMessage } from "node:http";
export function hasBearerSecret(request: IncomingMessage, expectedSecret: string): boolean;
