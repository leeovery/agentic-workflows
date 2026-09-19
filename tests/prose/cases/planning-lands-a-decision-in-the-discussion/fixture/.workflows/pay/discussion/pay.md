# Discussion: Pay

## Context

Accept card payments at checkout using the existing gateway account.

---

## Gateway Integration

### Context
Which account the checkout uses, and how a capture is confirmed.

### Options Considered

**Poll the gateway from the checkout**
- Pros: the checkout can answer the shopper on the spot.
- Cons: it answers with a guess whenever the gateway is slow.

**Wait for the gateway to tell us**
- Pros: the answer is the gateway's own, and it is repeated if the
  first attempt fails.
- Cons: it arrives after the checkout has handed the shopper on.

### Journey
The existing account carries the rates we already have, so a new
provider was never seriously on the table. Confirmation was the real
question. Polling looked attractive until we followed a slow gateway
through it: the checkout would have to answer the shopper with a
guess, and a wrong guess about money is worse than a slower answer.
We settled on webhooks — the gateway tells us, and it tells us again
if the first attempt fails.

### Decision
Use the existing gateway account — no new provider onboarding.
Capture is confirmed by gateway webhook; the checkout never polls.

---

## Summary

### Key Insights
1. Confirmation is asynchronous by design: the checkout hands the
   shopper to the gateway and hears back afterwards, and nothing in
   the flow waits on a poll.

### Open Threads
- (none)

### Current State
- Gateway integration is resolved.
