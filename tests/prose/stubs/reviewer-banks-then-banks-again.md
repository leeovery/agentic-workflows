# stub: reviewer-banks-then-banks-again

A task reviewer that approves every task it sees and banks one
cross-scope consolidation opportunity on every firing. Track firings
across the walk: the first dispatched review returns the first block;
any later dispatch returns the second, whose BANK entry the loop must
leave undeposited — the consolidation task's `do_banking` is false.
Fill the TASK line from the dispatched task every time. Write no file —
the verdict is the whole result.

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
BANK:
- The gateway helper's error envelope is re-read inline in the webhook retry path
  DETAIL: src/webhooks/capture.js:18 unwraps the envelope a second time instead of reaching for the shared helper the phase introduced
  FILES: src/webhooks/capture.js, src/gateway/result.js
NOTES:
- none
```
