# Investigation: Checkout Crash On Missing Shipping Address

## Symptoms

### Problem Description

Checkout returns a 500 at the payment step when the order has no
shipping address. No error is surfaced to the user.

### Manifestation

Server error on POST to the payment step; the page fails blank.

### Reproduction Steps

1. Add a digital-only product to the basket.
2. Proceed to checkout without entering a shipping address.
3. Continue to the payment step — the request 500s.

### Environment

Reproduced on staging; reported twice in production this week.

### Impact

Digital-only orders cannot complete checkout.

### References

(none)

## Analysis

### Hypotheses

- The payment step assumes a shipping address is always present.
- Tax calculation may be the first consumer of the missing address.

### Code Trace

The payment step builds a tax context from the order before creating
the payment intent. The tax context reads the shipping address
unconditionally; for a digital-only order the address is absent, so
the read fails and the request aborts before any handler catches it.

### Root Cause

The tax context treats the shipping address as mandatory. Digital-only
orders legitimately have none, so the assumption is wrong rather than
the data being wrong.

### Contributing Factors

Digital-only baskets were introduced after the tax context was written.

### Why It Wasn't Caught

No test covers a basket with no shippable line items.

### Blast Radius

Any flow building a tax context from an address-less order.

## Fix Direction

### Chosen Approach

Make the tax context treat the shipping address as optional: when
an order has no shippable items, build the context from the billing
address instead.

### Options Explored

(none yet)

### Discussion

(none yet)

### Testing Recommendations

Cover a digital-only basket end to end through the payment step.

### Risk Assessment

Low — the change is confined to tax-context construction.

## Notes

(none)
