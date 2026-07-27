# stub: root-cause-validated

A root-cause validation agent's report: the hypothesis confirmed by an
independent trace, no gaps. The content below is written to the path the
dispatch response returned; the STATUS block is also what the agent
returns to its caller.

---

# Root Cause Validation

The tax context is built before the payment intent and reads the shipping
address unconditionally. Traced fresh: an address-less order fails at that
read, which matches the documented root cause.

STATUS: validated
CONFIDENCE: high
GAPS_COUNT: 0
SUMMARY: Root cause confirmed by an independent trace.
