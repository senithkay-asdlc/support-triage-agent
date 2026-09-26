# support-triage-agent — PRD

## Problem Statement

Support teams receive a steady stream of incoming tickets from whatever
systems customers or partners use to reach them. Today, a human has to read
every ticket, judge how urgent it is, and write a reply from scratch before
anything moves forward — a slow, repetitive process where the most urgent
issues can sit unnoticed behind routine ones, and reply quality depends on
whoever happens to pick the ticket up.

## Solution

A support triage agent that accepts incoming tickets from any external
system through a public submission endpoint, automatically classifies each
one by urgency, and drafts a candidate reply. A Support Agent reviews the
queue, sees the urgency and the draft side by side, and edits and approves
(or rejects) the draft before it goes anywhere else — the agent keeps final
say, the product removes the blank-page and triage-ordering work.

## Actors

- **Support Agent**: reviews the incoming ticket queue, sees each ticket's
AI-assigned urgency and AI-drafted reply, can override the urgency, can
edit the draft, and approves or rejects it. Signs in via SSO.

## User Stories

1. As a Support Agent, I want tickets submitted by external systems to
appear automatically in my queue, so that I don't have to enter them
manually.
2. As a Support Agent, I want each incoming ticket automatically classified
by urgency, so that I can prioritize the most critical issues first.
3. As a Support Agent, I want to see an AI-drafted reply for each ticket, so
that I can respond quickly without writing from scratch.
4. As a Support Agent, I want to edit a drafted reply before approving it,
so that I can correct or personalize the response.
5. As a Support Agent, I want to approve a drafted reply, so that it is
marked ready to send.
6. As a Support Agent, I want to reject a drafted reply and request a new
one, so that I'm never stuck sending a draft that isn't usable.
7. As a Support Agent, I want to override the urgency classification when
the agent got it wrong, so that the queue's prioritization stays
accurate.
8. As a Support Agent, I want to filter and sort the ticket queue by
urgency and status, so that I can find what to work on next.
9. As a Support Agent, I want to see a ticket's full history (submission,
classification, draft, edits, approval/rejection), so that I can
understand and audit how it was handled.

## Product Decisions

- **Sign-in**: Support Agents sign in via SSO through Thunder, the
platform IDP.
- **Ticket ingestion**: tickets enter only through a public API endpoint
that any external system can push a new ticket to — this product does
not read an inbox or integrate with a specific existing helpdesk
platform.
- **Ingestion credential**: each submitting external system authenticates
its pushes with a shared credential (e.g. an API key) issued per system,
rather than the endpoint being open to anonymous callers. *assumed*
- **Urgency levels**: tickets are classified into four levels — Low,
Medium, High, Critical. *assumed*
- **Terminal action**: approving (or rejecting) a draft is the last step
this product takes on a ticket; actually sending the reply to the
customer is handled by another system outside this product.
- **Notifications**: this version has no notification channel — Support
Agents monitor the queue directly rather than being alerted to new or
urgent tickets. *assumed*
- **Queue model**: all Support Agents share one queue; there is no
per-agent assignment of tickets. *assumed*

## Out of Scope

- Sending the approved reply to the customer — handled by another system.
- A separate Admin actor or any screen for managing classification rules,
urgency taxonomy, or categories.
- Ingesting tickets from a specific existing helpdesk platform or by
reading an email inbox directly.
- Reporting or analytics dashboards.

## Open Questions

1. Is there a maximum response-time SLA per urgency level that the product
should track or display against each ticket?

## Further Notes

None.