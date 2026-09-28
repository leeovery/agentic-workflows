# Discussion: Pay

## Context

Accept card payments at checkout using the existing gateway account.

---

## Gateway Integration

### Context
Which account the checkout uses, and how a capture is confirmed.

### Journey
The existing account carries the rates we already have, so a new
provider was never seriously on the table. Confirmation was the
real question: polling the gateway would let the checkout answer
the customer on the spot, but it answers with a guess whenever the
gateway is slow. We settled on webhooks — the gateway tells us,
and it tells us again if the first attempt fails. Its own
re-delivery schedule is three further attempts, at 1, 5 and 25
minutes, and we take that as it stands rather than configuring one
of our own.

### Decision
Use the existing gateway account — no new provider onboarding.
Capture is confirmed by gateway webhook; the checkout never polls.
The gateway's own re-delivery schedule stands: three further
attempts, at 1, 5 and 25 minutes after the first.

---

## Refunds

### Context
What the support team can undo after a capture, and for how long.

### Decision
Refunds run against the original payment intent, for 30 days from
capture.

---

## Summary

### Key Insights
1. Confirmation is asynchronous by design: the checkout hands the
   customer to the gateway and hears back afterwards, and nothing
   in the flow waits on a poll.

### Open Threads
- (none)

### Current State
- Gateway integration and refunds are both resolved.
