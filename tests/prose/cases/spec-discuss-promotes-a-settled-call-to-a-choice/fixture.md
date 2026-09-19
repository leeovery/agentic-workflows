A feature whose specification stands at the review boundary.
Construction concluded in an earlier sitting: the card-payments
discussion is completed, its content extracted, the source row
incorporated, review not yet begun.

The specification says the gateway re-delivers a failed capture
webhook at 1, 5 and 25 minutes after the first attempt, and that a
payment is unconfirmed once those re-deliveries are exhausted. It
never says how long an order waits. It says a gateway rejection at
creation surfaces as a user-visible checkout error, and it says
capture is confirmed by webhook and never by polling — but it never
says what the checkout puts in front of the customer between the two,
while the capture is still confirming. The discussion decides the
gateway account, the webhook-only confirmation path and its delivery
schedule, and the 30-day refund window; it says nothing about what a
customer sees while a payment is in flight.

The context was cleared between sittings — this session opens cold at
the entry skill with the spec in progress and what is on disk.
