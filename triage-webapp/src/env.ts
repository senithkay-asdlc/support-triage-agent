// Typed read of window._env_, mounted at request time by the platform's
// /env-config.js. Never build-time config (import.meta.env.VITE_*, .env
// files) — those are undefined in production. Declares only the keys this
// app actually reads: the four USER_AUTH_* OIDC keys thunder-authentication
// wires (USER_AUTH_JWKS_URL is emitted too, but the browser never validates a
// token, so it is deliberately not declared here). There is no browser-visible
// TICKET_API_URL: the sibling is reached same-origin at /api.

type Env = {
  USER_AUTH_CLIENT_ID: string;
  USER_AUTH_ISSUER: string;
  USER_AUTH_SCOPES: string;
  USER_AUTH_RESOURCE: string;
};

declare global {
  interface Window {
    _env_: Env;
  }
}

if (!window._env_) {
  throw new Error(
    "window._env_ not set — /env-config.js failed to load. " +
      "The platform mounts this file; if you see this locally, host " +
      "/env-config.js from your dev server.",
  );
}

export const env: Env = window._env_;
