# Specification: Pay

## Specification

### 1. Payment Intent

- Checkout creates a payment intent against the existing gateway account.
- Card payments only; wallet flows are out of scope for v1.
- A gateway rejection surfaces as a user-visible checkout error.
- A duplicate checkout start reuses the existing intent.

### 2. Capture Webhooks

- Capture is confirmed by gateway webhook, never by polling.
- Duplicate deliveries are idempotent.
- A capture naming an intent no order carries is logged and ignored.

---

## Working Notes
