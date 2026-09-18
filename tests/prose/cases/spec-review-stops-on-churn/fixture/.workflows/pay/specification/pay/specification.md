# Specification: Pay

## Specification

### Gateway Integration

- Checkout creates payment intents against the existing gateway
  account; card payments only.
- Capture is confirmed by gateway webhook, never by polling.
- The gateway re-delivers a failed capture webhook three times — 1,
  5 and 25 minutes after the first attempt.
- A payment is treated as unconfirmed once the gateway's
  re-deliveries are exhausted.

### Checkout Session

- The payment step quotes the total when it opens — items,
  shipping, tax — and captures exactly that amount.
- A checkout session expires 30 minutes after it opens; an expired
  session returns the customer to their cart.

### Refunds

- Refunds are issued against the original payment intent, within 30
  days of capture.
- The gateway accepts a refund against an intent for 180 days after
  capture.

---

## Working Notes
