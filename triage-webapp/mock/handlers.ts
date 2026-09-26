import { http, HttpResponse } from "msw";
import type { components } from "../src/generated/ticket-api";

type Ticket = components["schemas"]["Ticket"];
type TicketEvent = components["schemas"]["TicketEvent"];
type Urgency = components["schemas"]["Urgency"];

// Module-scope state: a full page load re-runs this module and puts the seed
// data back (react-webapp's mock-mode.md); only in-app navigation carries a
// change forward. Seeded across every urgency and status the queue and
// wireframe draw, plus one already-approved and one already-rejected ticket
// so the detail screen's history and state machine are all reachable.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const now = Date.now();
const iso = (msAgo: number) => new Date(now - msAgo).toISOString();

let nextEventId = 1;
function event(ticketId: string, type: string, detail: string, createdAtMs: number): TicketEvent {
  const id = String(nextEventId++);
  return { id, ticketId, type, detail, createdAt: iso(createdAtMs) };
}

interface Seed {
  id: string;
  subject: string;
  body: string;
  sourceSystem: string;
  urgency: Urgency;
  urgencyOverridden?: boolean;
  draftReply?: string;
  status: Ticket["status"];
  createdAgoMs: number;
  updatedAgoMs: number;
  events: TicketEvent[];
}

const seeds: Seed[] = [
  {
    id: "1",
    subject: "Cannot log in to account",
    body: "I've tried resetting my password twice and still can't get in. It says my account is locked but I never got an email about it.",
    sourceSystem: "acme-helpdesk",
    urgency: "Critical",
    draftReply:
      "Hi there — sorry for the trouble signing in. I've lifted the lock on your account and sent a fresh password reset link to your inbox; it should arrive within a couple of minutes. Let us know if you're still stuck.",
    status: "new",
    createdAgoMs: 2 * MINUTE,
    updatedAgoMs: 2 * MINUTE,
    events: [],
  },
  {
    id: "2",
    subject: "Question about billing cycle",
    body: "Can you tell me when my next billing date is? I want to make sure I upgrade my plan before I'm charged again.",
    sourceSystem: "acme-helpdesk",
    urgency: "Low",
    draftReply:
      "Thanks for reaching out! Your next billing date is the 1st of next month. You're welcome to upgrade any time before then and the new plan will take effect on your next cycle.",
    status: "triaged",
    createdAgoMs: HOUR,
    updatedAgoMs: HOUR,
    events: [],
  },
  {
    id: "3",
    subject: "Export feature is broken",
    body: "Every time I try to export my report to CSV, the page just spins and nothing downloads. I've tried on two different browsers.",
    sourceSystem: "acme-helpdesk",
    urgency: "High",
    draftReply:
      "Sorry about that — we're aware exports can hang on larger reports and a fix is in progress. As a workaround, exporting a narrower date range should complete normally. I'll follow up once the fix ships.",
    status: "triaged",
    createdAgoMs: 3 * HOUR,
    updatedAgoMs: 3 * HOUR,
    events: [],
  },
  {
    id: "4",
    subject: "Payment gateway timing out",
    body: "Customers are reporting checkout fails at the payment step about half the time. This is costing us real sales today.",
    sourceSystem: "acme-helpdesk",
    urgency: "Medium",
    urgencyOverridden: true,
    draftReply:
      "Thanks for flagging this — we've confirmed a timeout on our payment gateway integration and applied a fix. Please ask affected customers to retry checkout; let us know if it recurs.",
    status: "approved",
    createdAgoMs: DAY,
    updatedAgoMs: DAY - 2 * HOUR,
    events: [],
  },
  {
    id: "5",
    subject: "Login page shows a blank screen",
    body: "The login page just shows white for me since this morning. I'm on the latest Chrome. Nothing in the console.",
    sourceSystem: "acme-helpdesk",
    urgency: "High",
    draftReply:
      "Thanks for the report — we've rolled out a fix for a blank login page caused by a caching issue. Please do a hard refresh (Ctrl/Cmd+Shift+R) and let us know if the page still doesn't load.",
    status: "rejected",
    createdAgoMs: 6 * HOUR,
    updatedAgoMs: HOUR,
    events: [],
  },
];

const tickets = new Map<string, Ticket>();
const events = new Map<string, TicketEvent[]>();

for (const seed of seeds) {
  tickets.set(seed.id, {
    id: seed.id,
    sourceSystem: seed.sourceSystem,
    subject: seed.subject,
    body: seed.body,
    urgency: seed.urgency,
    urgencyOverridden: seed.urgencyOverridden ?? false,
    draftReply: seed.draftReply,
    status: seed.status,
    createdAt: iso(seed.createdAgoMs),
    updatedAt: iso(seed.updatedAgoMs),
  });

  const history: TicketEvent[] = [
    event(seed.id, "submitted", `Submitted by ${seed.sourceSystem}`, seed.createdAgoMs),
    event(seed.id, "classified", `Classified: ${seed.urgency}`, seed.createdAgoMs - 30_000),
    event(seed.id, "drafted", "Drafted reply", seed.createdAgoMs - 60_000),
  ];
  if (seed.urgencyOverridden) {
    history.push(event(seed.id, "urgency-overridden", `Overridden to ${seed.urgency}`, seed.updatedAgoMs + HOUR));
  }
  if (seed.status === "approved") {
    history.push(event(seed.id, "approved", "Approved", seed.updatedAgoMs));
  }
  if (seed.status === "rejected") {
    history.push(event(seed.id, "rejected", "Rejected, new draft requested", seed.updatedAgoMs + 30 * MINUTE));
    history.push(event(seed.id, "drafted", "Drafted reply", seed.updatedAgoMs));
  }
  events.set(seed.id, history);
}

function errorBody(code: number, message: string) {
  return { code, message };
}

const APPROVABLE: Ticket["status"][] = ["new", "triaged"];

export const handlers = [
  // GET /tickets — the shared queue, filterable by urgency/status (query-param
  // pagination per the contract). No separate "search" query param exists on
  // this operation, so the page filters the returned page client-side by
  // subject substring (src/pages/TicketQueue.tsx) rather than the mock
  // pretending to support one the contract does not declare.
  http.get("/api/tickets", ({ request }) => {
    const url = new URL(request.url);
    const urgency = url.searchParams.get("urgency");
    const status = url.searchParams.get("status");
    const limit = Number(url.searchParams.get("limit") ?? "20");
    const offset = Number(url.searchParams.get("offset") ?? "0");

    let all = [...tickets.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    if (urgency) all = all.filter((t) => t.urgency === urgency);
    if (status) all = all.filter((t) => t.status === status);

    const page = all.slice(offset, offset + limit);
    return HttpResponse.json({
      count: all.length,
      next: offset + limit < all.length ? `/tickets?offset=${offset + limit}&limit=${limit}` : null,
      previous: offset > 0 ? `/tickets?offset=${Math.max(0, offset - limit)}&limit=${limit}` : null,
      data: page,
    });
  }),

  http.get("/api/tickets/:ticketId", ({ params }) => {
    const ticket = tickets.get(String(params.ticketId));
    if (!ticket) {
      return HttpResponse.json(errorBody(404, "No such ticket"), { status: 404 });
    }
    return HttpResponse.json(ticket);
  }),

  http.get("/api/tickets/:ticketId/events", ({ params }) => {
    const id = String(params.ticketId);
    if (!tickets.has(id)) {
      return HttpResponse.json(errorBody(404, "No such ticket"), { status: 404 });
    }
    const rows = (events.get(id) ?? []).slice().sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    return HttpResponse.json({ count: rows.length, next: null, previous: null, data: rows });
  }),

  http.post("/api/tickets/:ticketId/urgency", async ({ params, request }) => {
    const id = String(params.ticketId);
    // Read the body BEFORE re-reading the map: awaiting request.json() yields
    // to the event loop, and another handler (e.g. approve) can commit a
    // change to this same ticket while this one is paused. Capturing `ticket`
    // before the await and spreading that stale snapshot after it would
    // silently clobber that concurrent write — read current map state only
    // once nothing async remains between the read and the merge.
    const body = (await request.json()) as { urgency?: Urgency };
    const ticket = tickets.get(id);
    if (!ticket) {
      return HttpResponse.json(errorBody(404, "No such ticket"), { status: 404 });
    }
    if (!body?.urgency) {
      return HttpResponse.json(errorBody(400, "urgency is required"), { status: 400 });
    }
    const updated: Ticket = {
      ...ticket,
      urgency: body.urgency,
      urgencyOverridden: true,
      updatedAt: new Date().toISOString(),
    };
    tickets.set(id, updated);
    events.get(id)?.push(event(id, "urgency-overridden", `Overridden to ${body.urgency}`, 0));
    return HttpResponse.json(updated);
  }),

  http.put("/api/tickets/:ticketId/draft-reply", async ({ params, request }) => {
    const id = String(params.ticketId);
    // Same ordering fix as the urgency handler above: re-read the map after
    // the await, not before, so a concurrent approve/reject isn't overwritten
    // by this handler's now-stale snapshot once it resumes.
    const body = (await request.json()) as { draftReply?: string };
    const ticket = tickets.get(id);
    if (!ticket) {
      return HttpResponse.json(errorBody(404, "No such ticket"), { status: 404 });
    }
    if (typeof body?.draftReply !== "string") {
      return HttpResponse.json(errorBody(400, "draftReply is required"), { status: 400 });
    }
    const updated: Ticket = { ...ticket, draftReply: body.draftReply, updatedAt: new Date().toISOString() };
    tickets.set(id, updated);
    events.get(id)?.push(event(id, "draft-edited", "Drafted reply edited", 0));
    return HttpResponse.json(updated);
  }),

  http.post("/api/tickets/:ticketId/approve", ({ params }) => {
    const id = String(params.ticketId);
    const ticket = tickets.get(id);
    if (!ticket) {
      return HttpResponse.json(errorBody(404, "No such ticket"), { status: 404 });
    }
    if (!APPROVABLE.includes(ticket.status)) {
      return HttpResponse.json(
        errorBody(400, "Ticket is not in a state that can be approved"),
        { status: 400 },
      );
    }
    const updated: Ticket = { ...ticket, status: "approved", updatedAt: new Date().toISOString() };
    tickets.set(id, updated);
    events.get(id)?.push(event(id, "approved", "Approved", 0));
    return HttpResponse.json(updated);
  }),

  http.post("/api/tickets/:ticketId/reject", ({ params }) => {
    const id = String(params.ticketId);
    const ticket = tickets.get(id);
    if (!ticket) {
      return HttpResponse.json(errorBody(404, "No such ticket"), { status: 404 });
    }
    if (!APPROVABLE.includes(ticket.status)) {
      return HttpResponse.json(
        errorBody(400, "Ticket is not in a state that can be rejected"),
        { status: 400 },
      );
    }
    // The real ticket-api asks triage-agent for a new draft synchronously
    // enough that the response already carries it (review-and-approval.md).
    const updated: Ticket = {
      ...ticket,
      status: "rejected",
      draftReply: `${ticket.draftReply ?? ""}\n\n[Revised after rejection] Thanks for your patience — here is an updated response taking the feedback into account.`.trim(),
      updatedAt: new Date().toISOString(),
    };
    tickets.set(id, updated);
    events.get(id)?.push(event(id, "rejected", "Rejected, new draft requested", 0));
    events.get(id)?.push(event(id, "drafted", "Drafted reply", 0));
    return HttpResponse.json(updated);
  }),
];
