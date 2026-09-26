import ballerina/http;
import ballerina/log;

// triage-agent has no published openapi.yaml (it is an ai-agent component,
// contract-shaped instead by agent.afm.md's `webchat` interface). Its shape
// is fixed by the integration contract in issue #7: POST /chat with
// { conversationId?, message }, responding { conversationId, text, toolCalls }
// where `text` is itself a JSON string { urgency?, draftReply }.
final http:Client triageAgentClient = check new (triageAgentBaseUrl);

type ChatRequest record {|
    string conversationId?;
    string message;
|};

type ChatResponse record {|
    string conversationId;
    string text;
    json[] toolCalls;
|};

type TriageDraft record {|
    string urgency?;
    string draftReply;
|};

type TriageResult record {|
    string conversationId;
    string? urgency;
    string draftReply;
|};

// On submission: no conversationId yet, so a fresh conversation is started
// and both urgency and draftReply are required in the parsed response.
function classifyTicket(string ticketId, string subject, string body) returns TriageResult|error {
    string message = string `New ticket submitted. Classify its urgency and draft a reply.
Subject: ${subject}
Body: ${body}`;
    ChatRequest request = {message};
    TriageResult result = check callTriageAgent(ticketId, request);
    if result.urgency is () {
        return error("triage-agent did not return an urgency classification");
    }
    return result;
}

// On rejection: reuses the STORED conversationId so the agent's server-held
// memory (x-aep.memory: server, identity mode: on-behalf-of) sees the same
// per-ticket identity as the original classify call. Urgency is optional in
// the parsed response here per issue #7 — only overwritten when present.
function redraftTicket(string ticketId, string conversationId) returns TriageResult|error {
    string message = "The Support Agent rejected the previous draft. Write a new, " +
        "materially different draft reply, and a new urgency classification if it should change.";
    ChatRequest request = {conversationId, message};
    return callTriageAgent(ticketId, request);
}

function callTriageAgent(string ticketId, ChatRequest request) returns TriageResult|error {
    string userId = string `ticket-${ticketId}`;
    map<string> headers = {"X-User-Id": userId};
    ChatResponse|error response = triageAgentClient->post("/chat", request, headers = headers);
    if response is error {
        log:printError("triage-agent call failed", 'error = response, ticketId = ticketId);
        return error("triage-agent call failed", cause = response);
    }
    TriageDraft|error draft = response.text.fromJsonStringWithType(TriageDraft);
    if draft is error {
        log:printError("triage-agent response did not parse as the expected shape",
            'error = draft, ticketId = ticketId);
        return error("triage-agent response did not contain the expected classification shape", cause = draft);
    }
    string? urgency = draft?.urgency;
    if urgency is string && !isValidUrgency(urgency) {
        return error("triage-agent returned an unrecognised urgency", urgency = urgency);
    }
    return {conversationId: response.conversationId, urgency, draftReply: draft.draftReply};
}

function isValidUrgency(string value) returns boolean {
    return value == "Low" || value == "Medium" || value == "High" || value == "Critical";
}
