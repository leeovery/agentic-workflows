# Phase 1: Payment Intent Core — 2 tasks

## pay-1-1

### Task 1: Create Payment Intent

**Problem**: Checkout has no way to open a payment against the gateway.
**Solution**: Create a gateway payment intent when checkout begins, card-only enforced.
**Outcome**: Every checkout start yields exactly one intent.

## pay-1-2

### Task 2: Attach Intent To Order

**Problem**: Capture confirmation cannot find the payment without a link from the order.
**Solution**: Persist the intent id on the order at creation time.
**Outcome**: Every order carries its intent id.
