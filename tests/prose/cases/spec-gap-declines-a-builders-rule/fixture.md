A feature whose specification stands at the review boundary.
Construction concluded in an earlier sitting: the card-payments
discussion is completed, its content extracted, the source row
incorporated, review not yet begun.

The specification says the gateway re-delivers a failed capture webhook
at 1, 5 and 25 minutes after the first attempt, and that a payment is
unconfirmed once those re-deliveries are exhausted; it never says how
long an order waits. It says every capture and refund appends a line to
the payments audit log carrying the intent id and the amount, without
saying which is written first, and separately that an unmatched
delivery is logged with its intent id first. It decides refunds run
against the original payment intent within 30 days of capture, and says
nothing about whether a refund can be for part of an order. The
discussion decides the gateway account, the webhook-only confirmation
path and its delivery schedule, and the refund window; the size of a
refund never comes up there either.

The context was cleared between sittings — this session opens cold at
the entry skill with the spec in progress and what is on disk.
