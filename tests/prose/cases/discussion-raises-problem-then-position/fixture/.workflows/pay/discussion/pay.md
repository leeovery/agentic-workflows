# Discussion: Pay

## Context

Accept card payments at checkout using the existing gateway
account. Card-only for v1 — wallet support was deferred when the
work was shaped.

---

## Capture Confirmation

### Context
How the checkout learns that a card payment was actually captured.

### Decision

Gateway webhooks confirm capture; the checkout never polls. The
webhook consumer marks the order paid, and duplicate deliveries
are idempotent.

---

## Currency Handling

### Context
Which currencies checkout accepts and how amounts are carried.

### Decision

GBP only for v1. Amounts are integer minor units end to end;
no conversion anywhere in the flow.

---

## Failed-Payment Retries

### Context
What happens after a card is declined — whether and how the
shopper can try again within the same checkout.

### Options Considered

**Inline retry** — the shopper corrects the card details and
resubmits without leaving the payment step.

**Restart checkout** — a decline ends the attempt; the shopper
starts over from the basket.

---

## Summary

### Current State
- Capture confirmation decided — webhooks, never polling.
- Currency handling decided — GBP only, integer minor units.
- Failed-payment retries exploring — two options on the table.
- Card-data handling identified but untouched.

## Triage

(none)
