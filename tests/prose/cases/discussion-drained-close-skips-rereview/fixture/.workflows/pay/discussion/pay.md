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
The conversation leaned on "a small bounded number of attempts"
without pinning it; the background review flagged the gap.

### Journey
Unbounded retries risk hammering a declining card; a single
attempt punishes transient gateway blips. Three attempts with
exponential backoff covers the transient case without re-running
a hard decline all day.

### Decision
Three attempts per payment, exponential backoff, counter resets
only on a new checkout.

---

## Webhook Reconciliation

### Context
Capture confirmation is webhook-only, and the background review
flagged that nothing covered a webhook that never arrives.

### Journey
A gateway outage or rejected delivery would strand the order
pending forever with the polling path ruled out. A targeted sweep
is not polling: it only queries orders already stuck past a
threshold.

### Decision
An hourly reconciliation sweep queries the gateway for orders
pending longer than 30 minutes and settles them from the
authoritative payment state.

---

## Summary

### Current State
- Capture confirmation decided — webhooks, never polling.
- Card data decided — hosted fields, nothing touches our servers.
- Failed-payment retries decided — three attempts, exponential backoff.
- Webhook reconciliation decided — hourly sweep for stuck orders.

## Triage

(none)
