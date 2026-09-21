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

### 3. Abandoned Checkout

- A checkout the shopper never comes back to is abandoned, and the
  payment intent it opened is released: no card is left holding an
  order nobody placed.
- The checkout page is abandoned after 15 minutes, and the intent it
  opened is released at 30 minutes — twice the abandonment window —
  so a shopper who returns to a still-open checkout inside the window
  always finds their payment where they left it rather than an error.
- A capture naming an intent that has already been released names an
  intent no order carries: it is logged and ignored.
- The saved-card checkout reaches the same gateway by the same path
  and is abandoned after 20 minutes.

---

## Working Notes
