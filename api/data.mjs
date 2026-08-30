import { handleDataRequest } from "../server/data-api.mjs";

export default function handler(request, response) {
  return handleDataRequest(request, response);
}
