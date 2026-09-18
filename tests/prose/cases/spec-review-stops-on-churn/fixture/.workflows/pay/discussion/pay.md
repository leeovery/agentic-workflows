# Discussion: Pay

## Context

Accept card payments at checkout using the existing gateway account.

---

## Gateway Integration

### Context
Which account the checkout uses, and how a capture is confirmed.

### Journey
Polling the gateway would let the checkout answer the customer on
the spot, but it answers with a guess whenever the gateway is slow.
We settled on webhooks — the gateway tells us, and it tells us
again if the first attempt fails. Its own re-delivery schedule is
three further attempts, at 1, 5 and 25 minutes, and we take that as
it stands rather than configuring one of our own.

### Decision
Use the existing gateway account — no new provider onboarding.
Capture is confirmed by gateway webhook; the checkout never polls.
The gateway's own re-delivery schedule stands: three further
attempts, at 1, 5 and 25 minutes after the first.

---

## Checkout Session

### Context
What the customer is charged, and how long a checkout stays open.

### Journey
Shipping rates and tax are live lookups, so a total computed at the
cart can differ from one computed at the payment step. We settled
on quoting once, when the payment step opens, and charging exactly
that — a customer must never be charged a number they did not see.
A checkout cannot stay open indefinitely on a quote either; half an
hour is long enough to find a card and short enough that rates have
not moved under it.

### Decision
The payment step quotes the total when it opens — items, shipping,
tax — and captures exactly that amount. A checkout session expires
30 minutes after it opens, and an expired session returns the
customer to their cart.

---

## Refunds

### Context
What the support team can undo after a capture, and for how long.

### Journey
The gateway will take a refund against an intent for 180 days, so
nothing technical forces a window on us. Support wanted a clean
cutoff they could say out loud, and a month is what they say to
customers today.

### Decision
Refunds run against the original payment intent, for 30 days from
capture.

---

## Summary

### Key Insights
1. The customer is charged the figure they confirmed, and the
   checkout never guesses at what the gateway has not told it.

### Open Threads
- (none)

### Current State
- Gateway integration, the checkout session, and refunds are all
  resolved.
