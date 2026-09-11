# stub: change-set-section-defers-criteria

A change-set verifier's file for a section with nothing wrong whose
unsettled criteria are another section's: its requirements read against
the change-set and found sound, nothing run because no defect in its remit
was suspected, and the two unsettled criteria recorded as the
payment-intent section's to measure. Write the content below to
`change-set-c1-{slug}.md` in the review directory for the dispatched
section — the SECTION line filled from that section's name — via the agent
contract's own mechanism: write the `.txt` path with the Write tool, then
`mv` it to `.md` (the harness refuses report-shaped `.md` writes directly).
Return to the caller: `STATUS: complete`, `FINDINGS_COUNT: 0`,
`NOT_MEASURED: 2`, and a one-line summary.

---

SECTION: {the dispatched section's name}

SCOPE: the range from the parent of `impl(pay): Tpay-1-1 — create payment intent` to HEAD, filtered to src/checkout/payment-intent.js, src/webhooks/capture.js, tests/checkout/payment-intent.test.js and tests/webhooks/capture.test.js, each read in full against the section; the project's CLAUDE.md documents `npx jest <file>` as its test command, no linters are declared and no build is named, and with no defect in this section's remit suspected nothing was run — the files were read and searched

MEASURED:
- None

NOT MEASURED:
- "gateway rejection surfaces as a user-visible checkout error" [1-1] — the payment-intent section's, not this one's
- "a duplicate start reuses the existing intent" [1-1] — the payment-intent section's, not this one's

FINDINGS:
- None

COVERAGE:
- capture is confirmed by the webhook consumer alone — src/webhooks/capture.js:3-4 — read: `handleCaptureWebhook` is the module's only export, and `orders.markPaid(event.intentId)` the only write it makes
- a duplicate delivery lands on the same order — src/webhooks/capture.js:4 — read: the write is keyed by `event.intentId`, the same key on every delivery of one capture
- no polling path anywhere in the delivered code — src/checkout/payment-intent.js, src/webhooks/capture.js — measured: `grep -rn "setInterval\|setTimeout" src` → no matches
- the capture task's named test exists under its name — tests/webhooks/capture.test.js:3 — read: `marks the order paid on capture webhook` is the case the plan's task names
- the intent task's named test exists under its name — tests/checkout/payment-intent.test.js:3 — read: `creates a card-only intent on checkout start` is the case the plan's task names
