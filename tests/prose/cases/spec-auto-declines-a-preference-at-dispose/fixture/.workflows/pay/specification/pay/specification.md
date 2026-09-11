# Specification: Pay

## Specification

### Gateway Integration

- Checkout creates payment intents against the existing gateway
  account; card payments only.
- Capture is confirmed by gateway webhook, never by polling.

### Quoted Total

- The payment step quotes the total — items, shipping, tax — when
  it opens, and capture is for exactly that amount.
- An edit to the cart made from the payment step re-quotes the
  total, shown again before capture.

### Refunds

- Refunds are issued against the original payment intent.

---

## Working Notes
