Feature: Queue review and approval

  @story-8
  Rule: A Support Agent may filter and sort the ticket queue by urgency and status

    Scenario: Filtering the queue to Critical tickets
      Given a ticket titled "Payment gateway is down" is in the queue with urgency "Critical"
      And a ticket titled "Typo in confirmation email" is in the queue with urgency "Low"
      When Priya filters the queue to urgency "Critical"
      Then only the "Payment gateway is down" ticket is shown

  @story-7
  Rule: A Support Agent may override a ticket's urgency classification

    Scenario: Overriding urgency from Medium to High
      Given a ticket titled "Recurring sync failures" is in the queue with urgency "Medium"
      When Priya overrides its urgency to "High"
      Then the ticket is shown with urgency "High"

  @story-4
  Rule: A Support Agent may edit a drafted reply before approving it

    Scenario: Editing the draft reply text
      Given a ticket titled "Refund request" is in the queue with a drafted reply
      When Priya edits the drafted reply to "Your refund has been processed and will appear in 3-5 business days."
      Then the ticket's drafted reply reads "Your refund has been processed and will appear in 3-5 business days."

  @story-5
  Rule: A Support Agent may approve a drafted reply

    Scenario: Approving a reply marks it ready to send
      Given a ticket titled "Cannot reset password" is in the queue with a drafted reply
      When Priya approves the drafted reply
      Then the ticket's status is "approved"

  @story-6
  Rule: A Support Agent may reject a drafted reply and get a new one

    @negative
    Scenario: Rejecting a reply produces a new draft rather than sending the old one
      Given a ticket titled "Wrong invoice amount" is in the queue with a drafted reply of "Thanks for reaching out!"
      When Priya rejects the drafted reply
      Then the ticket's status is "rejected"
      And the ticket's drafted reply no longer reads "Thanks for reaching out!"

  @story-9
  Rule: A Support Agent can see a ticket's full history

    Scenario: Viewing the history of an approved ticket
      Given a ticket titled "Duplicate charge" was submitted, classified, drafted, and approved by Priya
      When Priya opens that ticket's history
      Then the history shows the submission, the classification, the draft, and the approval in order
