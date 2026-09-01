# Discussion: Pay

## Context

Accept card payments at checkout using the existing gateway
account. Card-only for v1; capture is confirmed by gateway webhook.

---

## Retry Policy

### Context
A failed capture attempt needs a retry stance before the flow ships.

### Options Considered

**Retry on a backoff schedule**
- Pros: absorbs transient gateway blips without buyer involvement
- Cons: masks a genuinely declined card for minutes

**Fail fast, buyer retries**
- Pros: honest state, no hidden queue
- Cons: transient blips surface as failures

### Journey
Transient gateway errors and genuine declines need different
treatment, and the gateway distinguishes them in the error class.
Retrying only the transient class keeps both properties.

### Decision
Retry transient-class failures on a short backoff (three attempts);
surface decline-class failures to the buyer immediately.

---

## Webhook Timing

### Context
How long the checkout waits on the capture webhook before showing
the buyer a pending state. The vendor claims sub-second delivery;
the wait-window design leans on that claim, and nobody has measured
it against the real sandbox.

---

## Summary

### Key Insights
1. Transient and decline failures split cleanly on the gateway
   error class.

### Open Threads
- Webhook timing: the wait window rests on an unmeasured delivery
  claim.

### Current State
- Retry policy decided; webhook timing still open.

## Triage

(none)
