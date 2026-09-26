Feature: Ticket ingestion and triage

  @story-1
  Rule: A ticket submitted by an external system appears automatically in the queue

    Scenario: A newly submitted ticket appears without manual entry
      Given no Support Agent has entered any ticket by hand
      When the "acme-helpdesk" system submits a ticket titled "Cannot log in to account" for this run
      Then that ticket appears in the queue

  @story-2
  Rule: Every incoming ticket is automatically classified by urgency

    Scenario: A submitted ticket carries an urgency level
      When the "acme-helpdesk" system submits a ticket titled "Data export is broken" for this run
      Then that ticket is shown with one of the urgency levels Low, Medium, High or Critical

  @story-3
  Rule: Every incoming ticket gets a drafted reply

    Scenario: A submitted ticket carries a drafted reply
      When the "acme-helpdesk" system submits a ticket titled "How do I change my billing cycle" for this run
      Then that ticket is shown with a drafted reply ready to review

  @story-1 @negative
  Rule: A submission without a valid ingestion credential is refused

    Scenario: A ticket pushed without a credential is not queued
      When an unidentified system submits a ticket titled "Unauthenticated submission" for this run without an ingestion credential
      Then that ticket does not appear in the queue
