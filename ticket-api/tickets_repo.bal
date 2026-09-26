import ballerina/sql;
import ballerina/uuid;
import ballerinax/postgresql;

function newTicketId() returns string {
    return uuid:createRandomUuid();
}

function insertTicket(string id, string? sourceSystem, string subject, string body) returns error? {
    postgresql:Client db = check requireDb();
    _ = check db->execute(`
        INSERT INTO tickets (id, source_system, subject, body, status)
        VALUES (${id}, ${sourceSystem}, ${subject}, ${body}, 'new')
    `);
}

function insertTicketEvent(string ticketId, string eventType, string? detail) returns error? {
    postgresql:Client db = check requireDb();
    _ = check db->execute(`
        INSERT INTO ticket_events (ticket_id, type, detail)
        VALUES (${ticketId}, ${eventType}, ${detail})
    `);
}

function classifyTicketRow(string id, string urgency, string draftReply, string conversationId) returns error? {
    postgresql:Client db = check requireDb();
    _ = check db->execute(`
        UPDATE tickets
        SET urgency = ${urgency}, draft_reply = ${draftReply}, status = 'triaged',
            triage_conversation_id = ${conversationId}, updated_at = now()
        WHERE id = ${id}
    `);
}

// Deletes a ticket and its events. Used to clean up when triage-agent
// classification fails on submission, so a broken/unclassified ticket is
// never left sitting in the queue.
function deleteTicketCascade(string id) returns error? {
    postgresql:Client db = check requireDb();
    _ = check db->execute(`DELETE FROM ticket_events WHERE ticket_id = ${id}`);
    _ = check db->execute(`DELETE FROM tickets WHERE id = ${id}`);
}

function updateUrgencyOverride(string id, string urgency) returns error? {
    postgresql:Client db = check requireDb();
    _ = check db->execute(`
        UPDATE tickets SET urgency = ${urgency}, urgency_overridden = TRUE, updated_at = now()
        WHERE id = ${id}
    `);
}

function updateDraftReply(string id, string draftReply) returns error? {
    postgresql:Client db = check requireDb();
    _ = check db->execute(`
        UPDATE tickets SET draft_reply = ${draftReply}, updated_at = now()
        WHERE id = ${id}
    `);
}

function markApproved(string id) returns error? {
    postgresql:Client db = check requireDb();
    _ = check db->execute(`
        UPDATE tickets SET status = 'approved', updated_at = now() WHERE id = ${id}
    `);
}

// Applies a redraft after a rejection: always overwrites the draft reply,
// updates urgency only when triage-agent returned one, and returns the
// ticket to `triaged` (see domain-model.md; the status-transition note in
// the PR description flags a conflicting acceptance scenario).
function applyRedraft(string id, string? urgency, string draftReply) returns error? {
    postgresql:Client db = check requireDb();
    if urgency is string {
        _ = check db->execute(`
            UPDATE tickets SET urgency = ${urgency}, draft_reply = ${draftReply}, status = 'triaged', updated_at = now()
            WHERE id = ${id}
        `);
    } else {
        _ = check db->execute(`
            UPDATE tickets SET draft_reply = ${draftReply}, status = 'triaged', updated_at = now()
            WHERE id = ${id}
        `);
    }
}

function fetchTicketRow(string id) returns TicketRow?|error {
    postgresql:Client db = check requireDb();
    TicketRow|error result = db->queryRow(`SELECT * FROM tickets WHERE id = ${id}`);
    if result is sql:NoRowsError {
        return ();
    }
    if result is error {
        return result;
    }
    return result;
}

function listTicketRows(string? urgency, string? status, int 'limit, int offset) returns TicketPage|error {
    postgresql:Client db = check requireDb();

    sql:ParameterizedQuery whereClause = ``;
    boolean hasFilter = false;
    if urgency is string {
        whereClause = sql:queryConcat(whereClause, ` WHERE urgency = ${urgency}`);
        hasFilter = true;
    }
    if status is string {
        if hasFilter {
            whereClause = sql:queryConcat(whereClause, ` AND status = ${status}`);
        } else {
            whereClause = sql:queryConcat(whereClause, ` WHERE status = ${status}`);
        }
    }

    sql:ParameterizedQuery countQuery = sql:queryConcat(`SELECT COUNT(*) AS total FROM tickets`, whereClause);
    CountRow countRow = check db->queryRow(countQuery);

    sql:ParameterizedQuery dataQuery = sql:queryConcat(`SELECT * FROM tickets`, whereClause,
        ` ORDER BY created_at DESC LIMIT ${'limit} OFFSET ${offset}`);
    stream<TicketRow, sql:Error?> rowStream = db->query(dataQuery);
    TicketRow[]|error collected = from TicketRow row in rowStream
        select row;
    check rowStream.close();
    if collected is error {
        return collected;
    }
    return {count: countRow.total, rows: collected};
}

function listTicketEventRows(string ticketId) returns TicketEventRow[]|error {
    postgresql:Client db = check requireDb();
    stream<TicketEventRow, sql:Error?> rowStream = db->query(`
        SELECT * FROM ticket_events WHERE ticket_id = ${ticketId} ORDER BY created_at ASC, id ASC
    `);
    TicketEventRow[]|error collected = from TicketEventRow row in rowStream
        select row;
    check rowStream.close();
    return collected;
}
