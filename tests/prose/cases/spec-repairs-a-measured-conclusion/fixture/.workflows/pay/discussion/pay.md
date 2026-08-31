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

## Event Backfill

### Context
Whether recovering missed capture webhooks needs a queued job.

### Journey
We started assuming a queued backfill worker, then costed what a
worst day actually takes: the gateway client pages capture events
at 500 per request (`grep 'const PAGE_SIZE' src/gateway/client.js`
→ `const PAGE_SIZE = 500;`), and the gateway dashboard puts a heavy
day at roughly 2,000 capture events. That is 4 requests against the
gateway's documented 60-requests-per-minute allowance — nowhere
near enough to justify a worker.

### Decision
No queued backfill job for v1 — recovery from missed capture
webhooks is a single synchronous pass. At 500 events per page a
full-day backfill of ~2,000 events is 4 requests, far inside the
gateway's 60-requests-per-minute limit. Revisit only if a backfill
ever trips the rate limit.

---

## Summary

### Key Insights
1. The gateway client's 500-per-page batching keeps a full-day
   backfill at 4 requests — the reason recovery needs no queue.

### Open Threads
- (none)

### Current State
- Gateway integration and event backfill are both resolved.
