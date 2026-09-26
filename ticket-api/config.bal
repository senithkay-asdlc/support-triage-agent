import ballerina/os;

// Platform-injected dependency wiring (workload.yaml). Every value below has a
// safe fallback so the service starts with no required environment variables.
configurable string ticketsDbHostEnv = os:getEnv("TICKETS_DB_HOST");
configurable string ticketsDbPortEnv = os:getEnv("TICKETS_DB_PORT");
configurable string ticketsDbUserEnv = os:getEnv("TICKETS_DB_USER");
configurable string ticketsDbPasswordEnv = os:getEnv("TICKETS_DB_PASSWORD");
configurable string ticketsDbNameEnv = os:getEnv("TICKETS_DB_DBNAME");
configurable string triageAgentUrlEnv = os:getEnv("TRIAGE_AGENT_URL");
configurable string ingestionApiKeyEnv = os:getEnv("INGESTION_API_KEY");

final int ticketsDbPort = parsePortOrDefault(ticketsDbPortEnv);

// INSECURE PLACEHOLDER — production deployments MUST override this via the
// INGESTION_API_KEY environment variable. Kept only so the component starts
// with no required environment variables, per the component contract.
final string ingestionApiKey = ingestionApiKeyEnv != "" ? ingestionApiKeyEnv : "changeme-insecure-ingestion-key";

final string triageAgentBaseUrl = trimTrailingSlash(triageAgentUrlEnv != "" ? triageAgentUrlEnv : "http://localhost:9090");

function parsePortOrDefault(string value) returns int {
    if value == "" {
        return 5432;
    }
    int|error parsed = int:fromString(value);
    if parsed is int {
        return parsed;
    }
    return 5432;
}

function trimTrailingSlash(string url) returns string {
    if url.endsWith("/") {
        return url.substring(0, url.length() - 1);
    }
    return url;
}
