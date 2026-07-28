# Discussion: Pay

## Context

Accept card payments at checkout using the existing gateway
account. Card-only for v1 — wallet support was deferred when the
work was shaped.

---

## Capture Confirmation

### Context
How the checkout learns that a card payment was actually captured.

### Options Considered

**Poll the gateway**
- Pros: simple, no inbound endpoint needed
- Cons: slow to confirm, hammers the gateway under load

**Gateway webhooks**
- Pros: guaranteed delivery, near-immediate confirmation
- Cons: needs a verified inbound endpoint

### Journey
Polling looked simplest until rate limits came up — confirming a
burst of checkouts by polling would either lag or hammer the
gateway. The webhook is guaranteed by the provider, which settled
it.

### Decision
Capture is confirmed by the gateway webhooks; the checkout never
polls.

---

## Summary

### Current State
- Capture confirmation decided — webhooks, never polling.
- Failed-payment retries and card-data handling still open.

## Triage

(none)
