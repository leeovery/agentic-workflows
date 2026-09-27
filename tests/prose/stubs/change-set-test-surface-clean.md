# stub: change-set-test-surface-clean

A change-set verifier's file for the test surface with nothing wrong and
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

SCOPE: the range from the parent of `impl(pay): Tpay-1-1 — create payment intent` to HEAD, filtered to tests/checkout/payment-intent.test.js and tests/webhooks/capture.test.js, each, read in full against the section; the project has no CLAUDE.md, no project skills, no declared linters and no documented test command, so nothing of the project's was run — the files were read and searched

MEASURED:
- None

NOT MEASURED:
- None

FINDINGS:
- None

COVERAGE:
- the intent task's named test exists under its name — tests/checkout/payment-intent.test.js:3 — read: `creates a card-only intent on checkout start` is the case the plan's task names
- the capture task's named test exists under its name — tests/webhooks/capture.test.js:3 — read: `marks the order paid on capture webhook` is the case the plan's task names
