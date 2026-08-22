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

**Checkpoint depth:** check-ins

- **H1: The payment form drops the address before submitting.** [ruled-out]
  The submitted payload carries every field the form holds; the
  order simply has no shipping address to carry.
- **H2: Tax calculation is the first consumer of the missing address.** [tracing]
  The payment step builds a tax context before creating the
  payment intent — reading that construction next.

### Code Trace

(in progress)

### Root Cause

(pending)

### Contributing Factors

(pending)

### Why It Wasn't Caught

(pending)

### Blast Radius

(pending)

## Fix Direction

### Chosen Approach

(pending)

### Options Explored

(none yet)

### Discussion

(none yet)

### Testing Recommendations

(pending)

### Risk Assessment

(pending)

## Notes

(none)
