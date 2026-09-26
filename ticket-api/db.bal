import ballerina/lang.runtime;
import ballerina/log;
import ballerinax/postgresql;
import ballerinax/postgresql.driver as _;

// Mutable module-level handle: nil until the first successful connection.
// A handler that needs the database calls requireDb(), which fails cleanly
// (as an error, mapped to 500) rather than the whole service crash-looping
// while tickets-db is not yet reachable.
postgresql:Client? dbClient = ();

function init() {
    _ = start connectDbWithRetry();
}

function connectDbWithRetry() {
    while true {
        postgresql:Client|error attempt = new (
            host = ticketsDbHostEnv,
            username = ticketsDbUserEnv,
            password = ticketsDbPasswordEnv,
            database = ticketsDbNameEnv,
            port = ticketsDbPort
        );
        if attempt is postgresql:Client {
            error? schemaResult = ensureSchema(attempt);
            if schemaResult is () {
                dbClient = attempt;
                log:printInfo("connected to tickets-db and ensured schema");
                return;
            }
            log:printWarn("tickets-db schema setup failed, retrying", 'error = schemaResult);
            error? closeResult = attempt.close();
            if closeResult is error {
                log:printWarn("failed to close tickets-db client after schema error", 'error = closeResult);
            }
        } else {
            log:printWarn("tickets-db not reachable yet, retrying", 'error = attempt);
        }
        runtime:sleep(5);
    }
}

function ensureSchema(postgresql:Client connectedClient) returns error? {
    _ = check connectedClient->execute(`
        CREATE TABLE IF NOT EXISTS tickets (
            id TEXT PRIMARY KEY,
            source_system TEXT,
            subject TEXT NOT NULL,
            body TEXT NOT NULL,
            urgency TEXT,
            urgency_overridden BOOLEAN NOT NULL DEFAULT FALSE,
            draft_reply TEXT,
            status TEXT NOT NULL,
            triage_conversation_id TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `);
    _ = check connectedClient->execute(`
        CREATE TABLE IF NOT EXISTS ticket_events (
            id BIGSERIAL PRIMARY KEY,
            ticket_id TEXT NOT NULL REFERENCES tickets(id),
            type TEXT NOT NULL,
            detail TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `);
}

function requireDb() returns postgresql:Client|error {
    postgresql:Client? current = dbClient;
    if current is postgresql:Client {
        return current;
    }
    return error("tickets-db is not reachable yet");
}
