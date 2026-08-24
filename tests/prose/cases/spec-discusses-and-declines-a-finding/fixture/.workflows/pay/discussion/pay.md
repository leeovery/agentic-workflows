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

## Refunds

### Context
What the support team can undo after a capture, and for how long.

### Decision
Refunds run against the original payment intent, for 30 days from
capture. Partial refunds are supported, down to a single line item —
support should never have to refund an entire order to correct one
line.

---

## Summary

### Key Insights
1. Per-line-item refunds keep support corrections proportionate to
   the mistake.

### Open Threads
- (none)

### Current State
- Gateway integration and refunds are both resolved.
