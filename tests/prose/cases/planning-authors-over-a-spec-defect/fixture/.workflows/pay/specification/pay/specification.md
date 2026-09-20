# Specification: Pay

## Specification

### 1. Payment Intent

- Checkout creates a payment intent against the existing gateway account.
- Card payments only; wallet flows are out of scope for v1.
- A gateway rejection surfaces as a user-visible checkout error.
- A duplicate checkout start reuses the existing intent.

### 2. Capture Webhooks

- Capture is confirmed by gateway webhook, never by polling.
- Duplicate deliveries are idempotent.
- A capture naming an intent no order carries is logged and ignored.

### 3. Client Call Bounds

The checkout path makes two synchronous external calls — the intent
creation against the gateway, and the write that attaches the intent
to the order against the orders store. Both run under explicit client
timeouts, configured once on the shared clients rather than at the
call sites: a hung dependency must never stall the checkout.

- Intent creation: bounded at 4 seconds — twice the gateway's
  documented p99 of 2 seconds for intent creation, so a healthy slow
  call never trips the bound while a hung gateway cannot hold the
  checkout open.
- Attaching the intent to the order: the platform documents the orders
  store's p99 at 250 milliseconds for single-order writes.

---

## Working Notes
