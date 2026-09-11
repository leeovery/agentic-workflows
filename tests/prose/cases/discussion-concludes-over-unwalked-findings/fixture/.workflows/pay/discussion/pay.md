# Discussion: Pay

## Context

Accept card payments at checkout using the existing gateway
account. Card-only for v1 — wallet support was deferred when the
work was shaped.

---

## Capture Confirmation

### Context
How the checkout learns that a card payment was actually captured.

### Options Considered

**Poll the gateway**
- Pros: simple, no inbound endpoint needed
- Cons: slow to confirm, hammers the gateway under load

**Gateway webhooks**
- Pros: guaranteed delivery, near-immediate confirmation
- Cons: needs a verified inbound endpoint

### Journey
Polling looked simplest until rate limits came up — confirming a
burst of checkouts by polling would either lag or hammer the
gateway. The webhook is guaranteed by the provider, which settled
it.

### Decision
Capture is confirmed by the gateway webhooks; the checkout never
polls.

---

## Card Data Handling

### Context
Whether card details ever touch our own servers.

### Journey
PCI scope drove this: the gateway's hosted fields keep the pan
and cvc on the gateway's side entirely, so our servers only ever
see a token.

### Decision
The gateway's hosted fields — card details never touch our
servers.

---

## Failed Payment Retries

### Context
How many capture attempts a failing card gets before the order is
left for the customer to retry.

### Journey
Unbounded retries risk hammering a declining card; a single
attempt punishes transient gateway blips. Three attempts with
exponential backoff covers the transient case without re-running
a hard decline all day.

### Decision
Three attempts per payment, exponential backoff, counter resets
only on a new checkout.

---

## Summary

### Current State
- Capture confirmation decided — webhooks, never polling.
- Card data decided — hosted fields, nothing touches our servers.
- Failed-payment retries decided — three attempts, exponential backoff.

## Triage

(none)
