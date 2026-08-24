# Plan: Pay

## Phase 1: Payment Intent Core

**Goal**: Checkout creates a gateway payment intent and attaches it to the order.

**Acceptance criteria**: An intent is created when checkout begins; the order carries the intent id; card-only is enforced.

| Task | Summary | Edge cases |
|------|---------|------------|
| Create Payment Intent | Create a gateway payment intent when checkout begins, card-only enforced. | Gateway rejects the intent; duplicate checkout start |
| Attach Intent To Order | Persist the intent id on the order for later capture confirmation. | Order abandoned before payment; intent id missing on retry |

## Phase 2: Webhook Capture

**Goal**: Capture is confirmed exclusively by gateway webhooks.

**Acceptance criteria**: The webhook consumer marks orders paid; no polling path exists anywhere.

| Task | Summary | Edge cases |
|------|---------|------------|
| Handle Capture Webhooks | Consume gateway capture webhooks and mark the order paid. | Duplicate webhook delivery; webhook for an unknown intent |
