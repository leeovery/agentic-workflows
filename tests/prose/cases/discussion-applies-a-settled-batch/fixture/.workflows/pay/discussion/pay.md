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
guaranteed by the provider, which settled it. An earlier draft
argued for a polling fallback on top of the webhook; that was
dropped once delivery guarantees were confirmed.

### Decision
Capture is confirmed by the gateway webhooks; the checkout never
polls. A polling fallback remains available if delivery proves
unreliable.

---

## Currency Handling

### Context
What currencies a checkout may quote and capture in.

### Decision
Amounts are minor units, integer only, never floats. The gateway
is called with the store currency.

---

## Summary

### Current State
- Capture confirmation decided — webhooks, never polling.
- Currency handling decided — integer minor units.
- Failed-payment retries still open.

## Triage

(none)
