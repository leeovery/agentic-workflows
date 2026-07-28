# stub: plan-tasks-authored-p1

The task-author agent's product for Phase 1 of the pay plan: the task
detail file, written to the path the prose names
(`.workflows/pay/planning/pay/phase-1-tasks.md`). The content below is
the file's exact bytes; the agent returns after writing it.

---

# Phase 1: Payment Intent Core — 2 tasks

## pay-1-1

### Task 1: Create Payment Intent

**Problem**: Checkout has no way to open a payment against the gateway.

**Solution**: Create a gateway payment intent when checkout begins, card-only enforced at creation.

**Outcome**: Every checkout start yields exactly one intent, card-only.

**Do**: Call the gateway's intent-creation API from the checkout-start handler; enforce card-only in the request; surface gateway rejection as a checkout error.

**Acceptance Criteria**: Intent created on checkout start; card-only enforced; gateway rejection surfaces as a user-visible checkout error.

**Tests**: Intent created on start; rejection path shows the error; duplicate start does not create a second intent.

**Edge Cases**: Gateway rejects the intent; duplicate checkout start.

**Context**: The existing gateway account is used — no new provider onboarding.

**Spec Reference**: Checkout creates a payment intent against the existing gateway account; card payments only.

## pay-1-2

### Task 2: Attach Intent To Order

**Problem**: Later capture confirmation cannot find the payment without a link from the order.

**Solution**: Persist the intent id on the order at creation time.

**Outcome**: Every order carries the intent id that capture confirmation will match on.

**Do**: Store the gateway intent id on the order record when the intent is created; keep the existing id on retry rather than minting a new one.

**Acceptance Criteria**: Order carries the intent id; retry reuses the existing intent.

**Tests**: Order persists the id; retry path reuses it; abandoned order retains its id harmlessly.

**Edge Cases**: Order abandoned before payment; intent id missing on retry.

**Context**: Webhook capture (Phase 2) matches on this id.

**Spec Reference**: Capture is confirmed by gateway webhook, never by polling.
