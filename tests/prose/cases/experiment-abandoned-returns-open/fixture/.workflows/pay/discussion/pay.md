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
the buyer a pending state. The vendor claims sub-second delivery
and the wait-window design leans on that claim.

Handed to the laboratory 2026-01-01 — awaiting E1; the window
choice waits on measured sandbox delivery timing.

---

## Summary

### Key Insights
1. Transient and decline failures split cleanly on the gateway
   error class.

### Open Threads
- Webhook timing: awaiting E1 — the window rests on measured
  delivery timing.

### Current State
- Retry policy decided; webhook timing awaiting evidence.

## Triage

(none)
