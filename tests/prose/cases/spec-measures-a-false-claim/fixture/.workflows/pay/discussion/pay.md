# Discussion: Pay

## Context

Accept card payments at checkout using the existing gateway account.

---

## Gateway Integration

### Context
Which account and confirmation path the checkout uses.

### Decision
Use the existing gateway account — no new provider onboarding.
Capture is confirmed by gateway webhooks; the checkout never polls.

---

## Failure Handling

### Context
Whether transient gateway failures need a reconciliation job.

### Journey
We started assuming a nightly reconciliation job was unavoidable,
then checked what the webhook layer already does: every webhook
handler wraps its work in withRetry (`grep -L withRetry
src/webhooks/*.js` → no output), so a transient failure replays
safely without a sweeper.

### Decision
No reconciliation job for v1 — every handler retries, so replayed
webhooks cover transient gateway failures. Revisit only if retry
exhaustion shows up in the logs.

---

## Summary

### Key Insights
1. The webhook layer's uniform retry wrapping is what makes a
   reconciliation job unnecessary.

### Open Threads
- (none)

### Current State
- Gateway integration and failure handling are both resolved.
