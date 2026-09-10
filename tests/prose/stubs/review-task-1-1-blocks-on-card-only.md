# stub: review-task-1-1-blocks-on-card-only

The verifier's report for the payment-intent task: the intent is created on
checkout start, but card-only is not enforced — the intent takes whatever
methods the order carries — so one acceptance criterion is unmet in
substance and the task is incomplete. The blocking entry points at the
finding beneath it that prescribes the remedy: a one-line literal. Write the
content below to `report-1-1.md` in the review directory — via the agent
contract's own mechanism: write the `.txt` path with the Write tool, then
`mv` it to `.md` (the harness refuses report-shaped `.md` writes directly).
The STATUS block is also what the agent returns to its caller.

---

TASK: Create payment intent

ACCEPTANCE CRITERIA: intent created on checkout start; card-only enforced; gateway rejection surfaces as a user-visible checkout error; a duplicate start reuses the existing intent.

STATUS: incomplete

SPEC CONTEXT: Card payments at checkout on the existing gateway account; card-only v1, wallet flows out of scope; capture confirmed by webhook, never polling.

IMPLEMENTATION:
- Status: Partial
- Location: src/checkout/payment-intent.js
- Notes: the intent is created on checkout start, but card-only is not enforced — see BLOCKING ISSUES

TESTS:
- Status: Adequate
- Coverage: creation exercised
- Notes: none

CODE QUALITY:
- Project conventions: Followed
- SOLID principles: Good
- Complexity: Low
- Modern idioms: Yes
- Readability: Good
- Issues: none

BLOCKING ISSUES:
- "card-only enforced" is unmet: src/checkout/payment-intent.js:5 passes the order's own methods to the gateway, so nothing restricts the intent to cards — remedy in the finding below

FINDINGS:
- [in-scope] [contained] src/checkout/payment-intent.js:5 — the intent takes `methods: order.methods` from the order; fix the literal to `methods: ['card']` — FAILS: a checkout carrying a wallet method opens a wallet intent the product forbids

UNSETTLED:
- None
