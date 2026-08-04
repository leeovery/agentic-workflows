# Discussion: Pay

## Context

Accept card payments at checkout using the existing gateway
account. Card-only for v1 — wallet support was deferred when the
work was shaped.

---

## Capture Confirmation

### Context
How the checkout learns that a card payment was actually captured.

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

## Failed-Payment Retries

### Context
How many times a declined payment is retried before it is given up on.

### Journey
Picking our own number invited an argument nobody could settle, and
the provider already enforces a ceiling of its own. Deferring to it
ended the discussion.

### Decision
Retries stop at the gateway's own ceiling; the checkout does not
impose a lower one.

---

## Summary

### Current State
- Capture confirmation decided — webhooks, never polling.
- Currency handling decided — integer minor units.
- Retries decided — the gateway's ceiling governs.

## Triage

(none)
