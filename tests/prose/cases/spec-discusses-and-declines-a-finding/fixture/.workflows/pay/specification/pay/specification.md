# Specification: Pay

## Specification

### Gateway Integration

- Checkout creates payment intents against the existing gateway
  account; card payments only.
- Capture is confirmed by gateway webhook, never by polling.

### Refunds

- Refunds are issued against the original payment intent.

---

## Working Notes
