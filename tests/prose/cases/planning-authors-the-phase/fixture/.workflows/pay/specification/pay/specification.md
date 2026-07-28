# Specification — pay

## Requirements

- Checkout creates a payment intent against the existing gateway account.
- Card payments only; wallet flows are out of scope for v1.
- Capture is confirmed by gateway webhook, never by polling.

## Out of scope

- Wallet support (deferred by discussion).
