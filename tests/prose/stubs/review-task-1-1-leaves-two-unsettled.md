# stub: review-task-1-1-leaves-two-unsettled

The verifier's report for the payment-intent task: implemented and tested,
nothing blocking, nothing wrong to report — but two of its criteria hold
only under something run, so reading settles neither and both are recorded
as unsettled for the change-set verification. Write the content below to
`report-1-1.md` in the review directory — via the agent contract's own
mechanism: write the `.txt` path with the Write tool, then `mv` it to `.md`
(the harness refuses report-shaped `.md` writes directly). The STATUS block
is also what the agent returns to its caller.

---

TASK: Create payment intent

ACCEPTANCE CRITERIA: intent created on checkout start; card-only enforced; gateway rejection surfaces as a user-visible checkout error; a duplicate start reuses the existing intent.

STATUS: complete

SPEC CONTEXT: Card payments at checkout on the existing gateway account; card-only v1; a gateway rejection is a user-visible checkout error; a duplicate start reuses the intent.

IMPLEMENTATION:
- Status: Implemented
- Location: src/checkout/payment-intent.js
- Notes: creation and card-only enforcement verified by reading; the rejection and duplicate-start criteria hold only under something run — see UNSETTLED

TESTS:
- Status: Adequate
- Coverage: creation and card-only enforcement exercised
- Notes: none

CODE QUALITY:
- Project conventions: Followed
- SOLID principles: Good
- Complexity: Low
- Modern idioms: Yes
- Readability: Good
- Issues: none

BLOCKING ISSUES:
- None

FINDINGS:
- None

UNSETTLED:
- "gateway rejection surfaces as a user-visible checkout error" — a checkout start against a gateway that rejects the intent, observing what reaches the user
- "a duplicate start reuses the existing intent" — two checkout starts on one order, observing that the second mints no intent
