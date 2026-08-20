# Specification: Pay

## Specification

### Gateway Integration

- Checkout creates payment intents against the existing gateway
  account; card payments only.
- Capture is confirmed by gateway webhook, never by polling.

### Telemetry Coverage

- Every checkout module emits payment telemetry at its boundary.

### Webhook Verification

- Webhook signatures are verified as HMAC-SHA256 against the raw
  body, with a custom five-minute tolerance window for delayed
  deliveries.

---

## Working Notes
