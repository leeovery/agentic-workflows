# Specification — pay

## Requirements

- Checkout creates a payment intent against the existing gateway account.
- Card payments only; wallet flows are out of scope for v1.
- Capture is confirmed by gateway webhook, never by polling.

## Out of scope

- Wallet support (deferred by discussion).

## Client call bounds

The feature makes two synchronous external calls — the checkout's
intent creation against the gateway, and the webhook consumer's
order write against the orders store. Both run under explicit
client timeouts, configured once on the shared clients rather than
at the call sites: a hung dependency must never stall its caller.

- Intent creation: bounded at 4 seconds — twice the gateway's
  documented p99 of 2 seconds for intent creation, so a healthy
  slow call never trips the bound while a hung gateway cannot hold
  the checkout open.
- Order write: the platform documents the orders store's p99 at
  250 milliseconds for single-order writes. The webhook path is
  background work — the shopper is never waiting on it.
