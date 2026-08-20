# Specification: Pay

## Specification

### Gateway Integration

- Checkout creates payment intents against the existing gateway
  account; card payments only.
- Capture is confirmed by gateway webhook, never by polling.

### Telemetry Coverage

- The checkout flow spans four modules
  (`ls src/checkout/*.js | wc -l` → 4); every checkout module
  emits payment telemetry at its boundary.

---

## Working Notes
