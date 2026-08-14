# stub: review-task-1-2-flags-claim

The verifier's report for the capture-webhook task: implemented and tested,
nothing blocking, one finding — the file's comment claims a polling recovery
path the code does not have and the spec forbids. Write the content below to
`report-1-2.md` in the review directory — via the agent contract's own
mechanism: write the `.txt` path with the Write tool, then `mv` it to `.md`
(the harness refuses report-shaped `.md` writes directly). The STATUS block
is also what the agent returns to its caller.

---

TASK: Handle capture webhooks

ACCEPTANCE CRITERIA: met in full — each criterion verified against the implementation.

STATUS: complete

SPEC CONTEXT: Card payments at checkout on the existing gateway account; card-only v1; capture confirmed by webhook, never polling.

IMPLEMENTATION:
- Status: Implemented
- Location: src/webhooks/capture.js
- Notes: the header comment is false — see FINDINGS

TESTS:
- Status: Adequate
- Coverage: capture marking and idempotency exercised
- Notes: none

CODE QUALITY:
- Project conventions: Followed
- SOLID principles: Good
- Complexity: Low
- Modern idioms: Yes
- Readability: Good
- Issues: one comment claim the code falsifies

BLOCKING ISSUES:
- none

FINDINGS:
- [in-scope] [contained] src/webhooks/capture.js:2-3 — the comment claims a missing delivery is recovered "by polling the gateway on a timer"; no polling path exists and the spec pins capture as webhook-only — delete the recovery clause, leaving the webhook sentence — FAILS: a reader trusts the comment and hunts for a polling fallback that does not exist
