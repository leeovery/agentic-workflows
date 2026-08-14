# stub: review-task-flags-notes

A task verifier's report for one task: implemented and tested, nothing
blocking, but carrying findings — things actually wrong, each naming its
failure, scope and blast radius. The ordinary case, and the one the prep
stage exists to work on. Write the content below to the
report file for the dispatched task's suffix
(`report-{phase_id}-{task_id}.md` in the review directory), with the
TASK line filled from that task — via the agent contract's own mechanism:
write the `.txt` path with the Write tool, then `mv` it to `.md` (the
harness refuses report-shaped `.md` writes directly). The STATUS block is
also what the agent returns to its caller.

---

TASK: {the dispatched task's name}

ACCEPTANCE CRITERIA: met in full — each criterion verified against the implementation.

STATUS: complete

SPEC CONTEXT: Card payments at checkout on the existing gateway account; card-only v1; capture confirmed by webhook, never polling.

IMPLEMENTATION:
- Status: Implemented
- Location: the task's declared files
- Notes: none

TESTS:
- Status: Adequate
- Coverage: the task's acceptance criteria are each exercised
- Notes: none

CODE QUALITY:
- Project conventions: Followed
- SOLID principles: Good
- Complexity: Low
- Modern idioms: Yes
- Readability: Good
- Issues: one false comment, one assertion that cannot fail

BLOCKING ISSUES:
- none

FINDINGS:
- [in-scope] [contained] src/checkout/payment-intent.js:12 — the comment names a polling fallback the capture path no longer has; delete the claim — FAILS: a reader trusts the comment and looks for a fallback that does not exist
- [in-scope] [contained] tests/checkout/payment-intent.test.js:30 — the assertion reads back the value the test itself set; assert against the gateway payload instead — FAILS: the test stays green whatever the intent builder sends
