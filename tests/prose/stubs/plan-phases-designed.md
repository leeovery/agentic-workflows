# stub: plan-phases-designed

A phase-designer agent's return for the pay specification: two phases,
goals, acceptance criteria, ordering rationale — no task lists. The
content below is what the agent returns; the prose writes it into the
planning file.

---

## Phase 1: Payment Intent Core

**Goal**: Checkout creates a gateway payment intent and attaches it to the order.

**Acceptance criteria**: An intent is created when checkout begins; the order carries the intent id; card-only is enforced at intent creation.

**Ordering rationale**: The intent is the substrate every later behaviour confirms against.

## Phase 2: Webhook Capture

**Goal**: Capture is confirmed exclusively by gateway webhooks.

**Acceptance criteria**: The webhook consumer marks orders paid; no polling path exists anywhere.

**Ordering rationale**: Capture confirmation depends on intents existing.
