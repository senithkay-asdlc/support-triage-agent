screen TicketQueue "The shared queue of incoming tickets, newest first"
  navbar "Support Triage"
  sidebar "Queue -> TicketQueue"
  row
    heading "Ticket Queue"
    right
    select "Filter by urgency"
    select "Filter by status"
    search "Search tickets"
  table "Subject | Urgency | Status | Submitted" -> TicketDetail
    row "Cannot log in to account | Critical | New | 2 minutes ago"
    row "Question about billing cycle | Low | Triaged | 1 hour ago"
    row "Export feature is broken | High | Triaged | 3 hours ago"

screen TicketDetail "A ticket's urgency, drafted reply, and history"
  navbar "Support Triage"
  sidebar "Queue -> TicketQueue"
  breadcrumb "Queue / Cannot log in to account"
  split 60/40
    left
      card "Cannot log in to account"
        text "From: acme-helpdesk | Submitted 2 minutes ago"
        text "I've tried resetting my password twice and still can't get in..."
      card "Drafted Reply"
        textarea "Edit the drafted reply"
        row
          right
          button "Reject" danger -> TicketQueue
          button "Approve" primary -> TicketQueue
    right
      card "Urgency"
        badge "Critical" danger
        select "Override urgency"
      card "History"
        list "Submitted | Classified: Critical | Drafted reply | Approved"

flow "Triage queue"
  role "Support Agent"
  description "A Support Agent works the shared queue: reviews urgency and the drafted reply, edits or overrides either, then approves or rejects"
  TicketQueue
  TicketDetail

