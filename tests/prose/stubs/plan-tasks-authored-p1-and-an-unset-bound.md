# stub: plan-tasks-authored-p1-and-an-unset-bound

The task-author agent's first run for Phase 1 of the pay plan: it
writes the task detail file to the path the prose names
(`.workflows/pay/planning/pay/phase-1-tasks.md`) with the first block's
exact bytes — carrying no client timeout on the attach task, because
the specification states none — and returns the second block, whose
`## Spec Defects` section reports that omission. The defects section is
the agent's return only: it never reaches the detail file.

---

The task detail file:

```markdown
# Phase 1: Payment Intent Core — 2 tasks

## pay-1-1

### Task 1: Create Payment Intent

**Problem**: Checkout has no way to open a payment against the gateway.

**Solution**: Create a gateway payment intent when checkout begins, card-only enforced at creation.

**Outcome**: Every checkout start yields exactly one intent, card-only.

**Do**: Call the gateway's intent-creation API from the checkout-start handler under the shared client's 4 second timeout; enforce card-only in the request; surface gateway rejection as a checkout error.

**Acceptance Criteria**: Intent created on checkout start; card-only enforced; gateway rejection surfaces as a user-visible checkout error; the call runs under the shared gateway client's 4 second timeout.

**Tests**: Intent created on start; rejection path shows the error; duplicate start does not create a second intent; a gateway that never answers trips the 4 second bound.

**Edge Cases**: Gateway rejects the intent; duplicate checkout start.

**Context**: The existing gateway account is used — no new provider onboarding.

**Spec Reference**: Checkout creates a payment intent against the existing gateway account; card payments only. Client Call Bounds: intent creation bounded at 4 seconds.

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
```

The agent's return to its caller:

```markdown
Authored 2 tasks for Phase 1: Payment Intent Core into the task detail file.

## Spec Defects

### S1: The attach task's client timeout is never stated
- **Omission**: Client Call Bounds requires both of the checkout path's synchronous external calls to run under an explicit client timeout and bounds intent creation at 4 seconds, but states no bound at all for the write that attaches the intent to the order. I wrote the intent task's bound in because the specification states it; the attach task has nothing to carry.
- **Consequence**: The implementer picks a number for the second call. Set it too low and a healthy slow write fails a checkout whose intent is already open against the gateway; set it too high and a hung orders store holds the checkout open with an intent nothing points at, which is the case the section says the bounds exist to prevent.
- **Ground**: The same section records the rule the intent-creation bound was set by — twice the dependency's documented p99, so a healthy slow call never trips the bound — and records the orders store's documented p99 at 250 milliseconds for single-order writes.
```
