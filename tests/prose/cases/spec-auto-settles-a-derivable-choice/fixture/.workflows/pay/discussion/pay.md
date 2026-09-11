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

## Quoted Total

### Context
What total the customer is charged, and when it can change under
them.

### Journey
Shipping rates and tax are live lookups, so a total computed at the
cart can differ from one computed at the payment step. We settled
on quoting once, when the payment step opens, and charging exactly
that — a customer must never be charged a number they did not see.
The one thing that legitimately changes the total is the customer
changing the order: the moment the customer edits the cart by hand
from the payment step, the total re-quotes and is shown again
before capture.

### Decision
The payment step quotes the total when it opens — items, shipping,
tax — and captures exactly that amount. The moment the customer
edits the cart by hand from the payment step, the total re-quotes
and the new figure is shown before capture.

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
1. The customer is charged the figure they confirmed, and only their
   own edit to the order can move it.

### Open Threads
- (none)

### Current State
- Gateway integration, the quoted total, and refunds are all
  resolved.
