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
Polling looked simplest until rate limits came up. The webhook is
guaranteed by the provider — every event carries a signed payload
and a provider event id — which settled it.

### Decision
Capture is confirmed by the gateway webhooks; the checkout never
polls.

---

## Currency Handling

### Context
What currencies a checkout may quote and capture in.

### Decision
Amounts are minor units, integer only, never floats. The gateway
is called with the store currency, and each capture records the
currency it was taken in.

---

## Summary

### Current State
- Capture confirmation decided — webhooks, never polling.
- Currency handling decided — integer minor units.
- Failed-payment retries still open.

## Triage

(none)
