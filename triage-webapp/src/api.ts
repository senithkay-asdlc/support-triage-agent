import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./generated/ticket-api";
import { authorizationHeader, classifyResponse, ForbiddenError } from "./authz/client";

// Same-origin: nginx (production) or mock/plugin.ts (mock mode) proxies /api
// to the ticket-api sibling. No browser-visible TICKET_API_URL — that address
// is pod env for nginx only (react-webapp).
export const ticketApi = createClient<paths>({ baseUrl: "/api" });

// This client adds NOTHING of its own about authorization: the bearer and the
// 401 rule both come straight from src/authz/client.ts (thunder-authentication §4).
const authMiddleware: Middleware = {
  async onRequest({ request }) {
    const header = await authorizationHeader();
    if (header) request.headers.set("Authorization", header);
    return request;
  },
  async onResponse({ response }) {
    if ((await classifyResponse(response.status)) === "forbidden") {
      throw new ForbiddenError(response.status);
    }
    return response;
  },
};

ticketApi.use(authMiddleware);
