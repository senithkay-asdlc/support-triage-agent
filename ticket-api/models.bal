import ballerina/sql;
import ballerina/time;

// Internal DB row shapes. `triageConversationId` is internal-only — it is
// never part of any API response, since it has no field in the `Ticket`
// schema (specs/design/components/ticket-api/openapi.yaml).
type TicketRow record {|
    string id;
    @sql:Column {name: "source_system"}
    string? sourceSystem;
    string subject;
    string body;
    string? urgency;
    @sql:Column {name: "urgency_overridden"}
    boolean urgencyOverridden;
    @sql:Column {name: "draft_reply"}
    string? draftReply;
    string status;
    @sql:Column {name: "triage_conversation_id"}
    string? triageConversationId;
    @sql:Column {name: "created_at"}
    time:Utc createdAt;
    @sql:Column {name: "updated_at"}
    time:Utc updatedAt;
|};

type TicketEventRow record {|
    int id;
    @sql:Column {name: "ticket_id"}
    string ticketId;
    string 'type;
    string? detail;
    @sql:Column {name: "created_at"}
    time:Utc createdAt;
|};

type CountRow record {|
    int total;
|};

type TicketPage record {|
    int count;
    TicketRow[] rows;
|};

function toApiTicket(TicketRow row) returns Ticket|error {
    string? urgencyValue = row.urgency;
    if urgencyValue is () {
        return error("ticket has not been classified yet", ticketId = row.id);
    }
    Urgency urgency = check urgencyValue.ensureType(Urgency);
    TicketStatus status = check row.status.ensureType(TicketStatus);
    Ticket ticket = {
        id: row.id,
        subject: row.subject,
        body: row.body,
        urgency: urgency,
        urgencyOverridden: row.urgencyOverridden,
        status: status,
        createdAt: time:utcToString(row.createdAt),
        updatedAt: time:utcToString(row.updatedAt)
    };
    string? sourceSystem = row.sourceSystem;
    if sourceSystem is string {
        ticket.sourceSystem = sourceSystem;
    }
    string? draftReply = row.draftReply;
    if draftReply is string {
        ticket.draftReply = draftReply;
    }
    return ticket;
}

function toApiTicketEvent(TicketEventRow row) returns TicketEvent {
    TicketEvent event = {
        id: row.id.toString(),
        ticketId: row.ticketId,
        'type: row.'type,
        createdAt: time:utcToString(row.createdAt)
    };
    string? detail = row.detail;
    if detail is string {
        event.detail = detail;
    }
    return event;
}
