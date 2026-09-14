# Specification: Pay

## Specification

### 1. Capture Confirmation

- Capture is confirmed by gateway webhook, never by polling.
- An hourly reconciliation sweep settles orders pending longer than 30 minutes from the gateway's payment state.

### 2. Card Data Handling

- Card details are entered through the gateway's hosted fields; our servers only ever hold a token.

---

## Working Notes
