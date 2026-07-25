# Root Cause Validation

The tax context is built before the payment intent and reads the shipping
address unconditionally. Traced fresh: an address-less order fails at that
read, which matches the documented root cause.

STATUS: validated
CONFIDENCE: high
GAPS_COUNT: 0
SUMMARY: Root cause confirmed by an independent trace.
