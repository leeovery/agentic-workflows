A feature whose plan is constructed and graphed: two approved phases,
three tasks in local-markdown with dependencies and priorities applied,
the spec baseline recorded — but no review has run and the plan is not
concluded. Every gate mode reads `gated`.

The specification decides the payment intent (card-only, a gateway
rejection surfacing as a user-visible checkout error, a duplicate
checkout start reusing the existing intent) and capture by webhook
(never polling, duplicate deliveries idempotent, a capture naming an
intent no order carries logged and ignored). It says nothing about how
the consumer retries a failed write, what it keys a repeat delivery on,
or how long it remembers one.

The capture task carries a **Do** that says all three anyway — a
three-attempt retry at fixed delays, a key on the gateway event id, and
a 24-hour eviction window. The attach task carries a one-line
description and no acceptance criteria.

The context was cleared mid-phase — this session opens cold at the
entry skill with nothing but the two arguments and what is on disk.
