# stub: change-set-capture-clean

A change-set verifier's file for the capture section with nothing wrong and
nothing to measure: its requirements read against the change-set and found
sound, nothing run because the project documents no test command, and no
unsettled criteria — the task verifiers settled every criterion by reading,
and the dispatch said so. Write the content below to
`change-set-c1-{slug}.md` in the review directory for the dispatched
section — the SECTION line filled from that section's name — via the agent
contract's own mechanism: write the `.txt` path with the Write tool, then
`mv` it to `.md` (the harness refuses report-shaped `.md` writes directly).
Return to the caller: `STATUS: complete`, `FINDINGS_COUNT: 0`,
`NOT_MEASURED: 0`, and a one-line summary.

---

SECTION: {the dispatched section's name}

SCOPE: the range from the parent of `impl(pay): Tpay-1-1 — create payment intent` to HEAD, filtered to src/webhooks/capture.js, read in full against the section; the project has no CLAUDE.md, no project skills, no declared linters and no documented test command, so nothing of the project's was run — the file was read and searched

MEASURED:
- None

NOT MEASURED:
- None

FINDINGS:
- None

COVERAGE:
- capture is confirmed by the webhook consumer alone — src/webhooks/capture.js — read: `handleCaptureWebhook` is the module's only export, and `orders.markPaid(event.intentId)` the only write it makes
- a duplicate delivery lands on the same order — src/webhooks/capture.js:4 — read: the write is keyed by `event.intentId`, the same key on every delivery of one capture
- no polling path anywhere in the delivered code — src — measured: `grep -rn "setInterval\|setTimeout" src` → no matches
