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
- Cons: slow to confirm under load

**Gateway webhooks**
- Pros: guaranteed delivery, near-immediate confirmation
- Cons: needs a verified inbound endpoint

---

## Summary

### Current State
- Capture confirmation exploring — two options on the table,
  nothing decided.
- Currency handling, failed-payment retries, card-data handling
  identified but untouched.

## Triage

(none)
