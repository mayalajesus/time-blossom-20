import { handleDataRequest } from "../server/data-api.mjs";

export const config = { maxDuration: 30 };

export default function handler(request, response) {
  return handleDataRequest(request, response);
}
