# Specification: Pay

## Specification

### Gateway Integration

- Checkout creates payment intents against the existing gateway
  account; card payments only.
- Capture is confirmed by gateway webhook, never by polling.

### Intent Creation Resilience

- Intent creation is attempted at most twice: one retry on a
  transient network error, fired immediately — no backoff.
- The whole attempt sequence resolves inside the checkout's
  6-second interstitial budget.
- Each gateway attempt is capped at 2 seconds.

---

## Working Notes
