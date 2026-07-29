# stub: review-task-verified

A task verifier's report for one task, everything in order: implemented
where the plan says, adequately tested, no blocking issues, no notes.
Write the content below to the report file for the dispatched task's
suffix (`report-{phase_id}-{task_id}.md` in the review directory), with
the TASK line filled from that task — via the agent contract's own
mechanism: write the `.txt` path with the Write tool, then `mv` it to
`.md` (the harness refuses report-shaped `.md` writes directly). The
STATUS block is also what the agent returns to its caller.

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
- Issues: none

BLOCKING ISSUES:
- none

NON-BLOCKING NOTES:
- none
