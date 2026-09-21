A feature whose plan is constructed and graphed: two approved phases,
three tasks in local-markdown with dependencies and priorities applied,
the spec baseline recorded — but no review has run and the plan is not
concluded. Every gate mode reads `gated`.

The specification decides the payment intent (card-only, a gateway
rejection surfacing as a user-visible checkout error, a duplicate
checkout start reusing the existing intent) and capture by webhook
(never polling, duplicate deliveries idempotent, a capture naming an
intent no order carries logged and ignored). The plan's three tasks
carry a one-line description each and no acceptance criteria at all, so
several of those decisions have no home in the plan.

The context was cleared mid-phase — this session opens cold at the
entry skill with nothing but the two arguments and what is on disk.
