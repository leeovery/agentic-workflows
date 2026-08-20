# Discussion: Pay

## Context

Accept card payments at checkout using the existing gateway
account. Card-only for v1 — wallet support was deferred when the
work was shaped.

---

## Capture Confirmation

### Context
How the checkout learns that a card payment was actually captured.

### Journey
Polling looked simplest until rate limits came up. The webhook is
guaranteed by the provider, which settled it.

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
What happens after a card payment fails — how many attempts, at
what spacing, and when the counter resets.

### Options Considered

**Single attempt**
- Pros: never hammers a declining card
- Cons: punishes transient gateway blips

**Bounded retries with backoff**
- Pros: covers the transient case; bounded exposure
- Cons: the bound and the backoff need pinning

### Journey
Leaning toward a small bounded number of attempts with backoff;
the exact bound and reset condition are still open.

---

## Summary

### Current State
- Capture confirmation decided — webhooks, never polling.
- Card data decided — hosted fields, nothing touches our servers.
- Failed-payment retries still exploring — bound and reset open.

## Triage

(none)
