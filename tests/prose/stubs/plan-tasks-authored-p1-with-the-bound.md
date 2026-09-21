# stub: plan-tasks-authored-p1-with-the-bound

The task-author agent's re-run for Phase 1 of the pay plan, against the
corrected specification: it rewrites the task detail file at
`.workflows/pay/planning/pay/phase-1-tasks.md` with the first block's
exact bytes — the attach task now carrying the 500 millisecond bound
the corrigendum landed, in a **Do** the record now supports — and
returns the second block, which reports no defects.

---

The task detail file:

```markdown
# Phase 1: Payment Intent Core — 2 tasks

## pay-1-1

### Task 1: Create Payment Intent

**Problem**: Checkout has no way to open a payment against the gateway.

**Solution**: Create a gateway payment intent when checkout begins, card-only enforced at creation.

**Outcome**: Every checkout start yields exactly one intent, card-only.

**Acceptance Criteria**: Intent created on checkout start; card-only enforced; gateway rejection surfaces as a user-visible checkout error; the call runs under the shared gateway client's 4 second timeout.

**Do**: Open the intent against the existing gateway account, through the shared gateway client the specification configures with a 4 second timeout.

**Context**: The existing gateway account is used — no new provider onboarding.

**Spec Reference**: Checkout creates a payment intent against the existing gateway account; card payments only. Client Call Bounds: intent creation bounded at 4 seconds.

## pay-1-2

### Task 2: Attach Intent To Order

**Problem**: Later capture confirmation cannot find the payment without a link from the order.

**Solution**: Persist the intent id on the order at creation time, under the orders client's stated bound.

**Outcome**: Every order carries the intent id that capture confirmation will match on, and a hung orders store cannot hold the checkout open.

**Acceptance Criteria**: Order carries the intent id; a second checkout start reuses the intent the order already carries, with no second intent created; the write runs under the shared orders client's 500 millisecond timeout.

**Do**: Write the intent id to the order through the shared orders client the specification configures with a 500 millisecond timeout.

**Context**: Webhook capture (Phase 2) matches on this id. The bound is the specification's — twice the store's documented 250 millisecond p99.

**Spec Reference**: Capture is confirmed by gateway webhook, never by polling. Client Call Bounds: attaching the intent to the order bounded at 500 milliseconds.
```

The agent's return to its caller:

```markdown
Re-authored 2 tasks for Phase 1: Payment Intent Core into the task detail file, against the corrected Client Call Bounds section. No specification defects remain.
```
