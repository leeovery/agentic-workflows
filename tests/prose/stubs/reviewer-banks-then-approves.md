# stub: reviewer-banks-then-approves

A task reviewer that approves every task it sees, and on its first
firing also banks one cross-scope consolidation opportunity. Track
firings across the walk: the first dispatched review returns the
approved-with-BANK block; any later dispatch returns the plain
approved block. Fill the TASK line from the dispatched task both
times. Write no file — the verdict is the whole result.

---

First firing of the walk:

```
TASK: {the dispatched task's title}
VERDICT: approved
SPEC_CONFORMANCE: conformant
ACCEPTANCE_CRITERIA: all met
TEST_COVERAGE: adequate
CONVENTIONS: followed
ARCHITECTURE: sound
BANK:
- Gateway result handling is hand-rolled in both checkout entry points
  DETAIL: src/checkout/payment-intent.js:5 and src/webhooks/capture.js:5 each unwrap the gateway result inline — a shared helper reaches across both tasks
  FILES: src/checkout/payment-intent.js, src/webhooks/capture.js
NOTES:
- none
```

Any later firing:

```
TASK: {the dispatched task's title}
VERDICT: approved
SPEC_CONFORMANCE: conformant
ACCEPTANCE_CRITERIA: all met
TEST_COVERAGE: adequate
CONVENTIONS: followed
ARCHITECTURE: sound
NOTES:
- none
```
