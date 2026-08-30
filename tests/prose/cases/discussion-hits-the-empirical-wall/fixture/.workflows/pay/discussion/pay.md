# Discussion: Pay

## Context

Accept card payments at checkout using the existing gateway
account. Card-only for v1 was softly agreed at shaping; this
discussion settles the capture flow.

---

## Retry Policy

### Context
A failed capture attempt has to retry without double-charging.

### Options Considered

**Gateway-side retries**
- Pros: no code to own
- Cons: opaque backoff, no visibility

**Our own retry with idempotency keys**
- Pros: observable, bounded, testable
- Cons: we own the schedule

### Journey
Gateway-side retries looked free until we asked what the support
story is when a capture stalls — nobody can see inside them. Owning
the schedule with idempotency keys keeps every attempt visible.

### Decision
Our own retry schedule with idempotency keys on every capture
attempt. Bounded at three attempts before surfacing to the operator.

---

## Summary

### Key Insights
1. Visibility beats convenience anywhere money moves twice.

### Open Threads
- Webhook timing — how long the checkout waits on the capture
  webhook before falling back to polling the payment status.

### Current State
- Retry policy resolved.
- Webhook timing still open.
