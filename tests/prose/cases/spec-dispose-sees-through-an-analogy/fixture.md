A feature whose specification stands at the review boundary.
Construction concluded in an earlier sitting: the card-payments
discussion is completed, its content extracted, the source row
incorporated, review not yet begun.

The specification says a gateway rejection at creation surfaces as a
user-visible checkout error, that capture is confirmed by webhook and
never by polling, that the gateway re-delivers a failed capture webhook
at 1, 5 and 25 minutes after the first attempt, and that a payment is
unconfirmed once those re-deliveries are exhausted. It never says what
becomes of an order whose payment is left unconfirmed. The discussion
decides the gateway account, the webhook-only confirmation path and its
delivery schedule, and the 30-day refund window; it says nothing about
an order the gateway never confirms.

The context was cleared between sittings — this session opens cold at
the specification skill with the spec in progress and what is on disk.
