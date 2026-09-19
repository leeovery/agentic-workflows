# Plan: Pay

## Phase 1: Payment Intent Core

**Goal**: Checkout creates a gateway payment intent and attaches it to the order.

**Acceptance criteria**: An intent is created when checkout begins; the order carries the intent id; card-only is enforced at intent creation.

**Ordering rationale**: The intent is the substrate every later behaviour confirms against.

## Phase 2: Webhook Capture

**Goal**: Capture is confirmed exclusively by gateway webhooks.

**Acceptance criteria**: The webhook consumer marks orders paid; no polling path exists anywhere.

**Ordering rationale**: Capture confirmation depends on intents existing.
