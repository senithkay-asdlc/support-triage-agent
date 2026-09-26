// Single place every other module reads environment configuration through.
// Names match exactly what the platform injects — never a guessed alternate.

export const config = {
  port: Number(process.env.PORT ?? 9090),

  // Model access — provider is "anthropic" per agent.afm.md's front matter.
  modelEndpoint: process.env.MODEL_ENDPOINT,
  modelName: process.env.MODEL_NAME ?? "claude-sonnet-5",
  modelApiKey: process.env.MODEL_API_KEY,
  modelApiKeyHeader: process.env.MODEL_API_KEY_HEADER,

  // triage-memory-db (postgres-cnpg) — optional; its absence selects the
  // in-memory conversation store instead of a fault.
  memoryDbHost: process.env.TRIAGE_MEMORY_DB_HOST,
  memoryDbPort: process.env.TRIAGE_MEMORY_DB_PORT,
  memoryDbName: process.env.TRIAGE_MEMORY_DB_DBNAME,
  memoryDbUser: process.env.TRIAGE_MEMORY_DB_USER,
  memoryDbPassword: process.env.TRIAGE_MEMORY_DB_PASSWORD,

  // Tracing — inert unless both are set.
  otelEndpoint: process.env.AMP_OTEL_ENDPOINT,
  ampAgentApiKey: process.env.AMP_AGENT_API_KEY,
  otelServiceName: process.env.OTEL_SERVICE_NAME ?? "triage-agent",
  traceContent: process.env.TRACELOOP_TRACE_CONTENT === "true",

  maxIterations: 6,
};

// What /healthz reports as missing — MODEL_API_KEY only. A missing
// TRIAGE_MEMORY_DB_* is a valid, supported configuration (in-memory store),
// never listed here.
export function missingRequiredEnv(): string[] {
  const missing: string[] = [];
  if (!config.modelApiKey) missing.push("MODEL_API_KEY");
  return missing;
}
