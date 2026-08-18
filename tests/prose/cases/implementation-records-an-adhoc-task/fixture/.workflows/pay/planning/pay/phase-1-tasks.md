---
total: 3
---

# Phase 1: Payment core — 2 tasks

## pay-1-1

### Task 1: Create Payment Intent

**Problem**: Checkout has no way to open a payment against the gateway.
**Solution**: Create a gateway payment intent when checkout begins, card-only enforced.
**Outcome**: Every checkout start yields exactly one intent.

## pay-1-2

### Task 2: Handle Capture Webhooks

**Problem**: Orders are never marked paid without a confirmation path.
**Solution**: Consume gateway capture webhooks and mark the order paid.
**Outcome**: Paid orders reflect capture with no polling anywhere.

## pay-1-3

### Task 3: Log Gateway Errors

**Problem**: Gateway failures vanish without a trace for support.
**Solution**: Log every gateway error response with the intent and order ids.
**Outcome**: Support can trace any failed payment from the log.
