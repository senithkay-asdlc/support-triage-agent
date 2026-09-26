// The keys the platform actually emits for this component (react-webapp's key
// table): the four USER_AUTH_* OIDC keys. No USER_AUTH_JWKS_URL (src/env.ts
// does not declare it) and no browser-visible ticket-api address (same-origin
// /api instead).
export const mockEnv = {
  USER_AUTH_CLIENT_ID: "mock-client",
  USER_AUTH_ISSUER: "https://mock-idp.test",
  USER_AUTH_SCOPES:
    "openid profile email group ou tickets:read tickets:override-urgency tickets:edit-draft tickets:approve tickets:reject",
  USER_AUTH_RESOURCE: "https://mock-idp.test/resources/mock-project",
};
