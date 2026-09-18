# Specification: Pay

## Specification

### Payment Intent

- Checkout creates a payment intent against the existing gateway
  account; card payments only.
- A gateway rejection at creation surfaces as a user-visible
  checkout error.

### Capture Webhooks

- Capture is confirmed by gateway webhook, never by polling.
- The gateway re-delivers a failed capture webhook three times — 1,
  5 and 25 minutes after the first attempt.
- A payment is treated as unconfirmed once the gateway's
  re-deliveries are exhausted.
- Duplicate deliveries are idempotent.
- A delivery naming an intent no order carries is logged — the
  intent id, then the delivery time — and ignored.

### Refunds

- Refunds are issued against the original payment intent, within 30
  days of capture.
- Every capture and every refund appends a line to the payments
  audit log, carrying the payment intent id and the amount.

---

## Working Notes
