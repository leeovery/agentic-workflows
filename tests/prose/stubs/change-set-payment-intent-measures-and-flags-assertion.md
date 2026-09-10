# stub: change-set-payment-intent-measures-and-flags-assertion

The change-set verifier's file for the `1. Payment Intent` section: the
gateway-rejection criterion measured by the project's own documented test
command and holding, the duplicate-start criterion beyond what the project
lets the pass run, and one finding — the intent test asserts back the value
it set itself, so it holds whatever the builder does. Write the content
below to `change-set-c1-1-payment-intent.md` in the review directory — via
the agent contract's own mechanism: write the `.txt` path with the Write
tool, then `mv` it to `.md` (the harness refuses report-shaped `.md` writes
directly). Return to the caller: `STATUS: complete`, `FINDINGS_COUNT: 1`,
`NOT_MEASURED: 1`, and a one-line summary.

---

SECTION: 1. Payment Intent

SCOPE: the range from the parent of `impl(pay): Tpay-1-1 — create payment intent` to HEAD, filtered to src/checkout/payment-intent.js and tests/checkout/payment-intent.test.js, read in full against the section; the project's CLAUDE.md documents `npx jest <file>` as the way to confirm a single behaviour, no linters are declared and no build is named, so the one run was the intent test file by that command, to settle the rejection criterion

MEASURED:
- "gateway rejection surfaces as a user-visible checkout error" [1-1] — run: `npx jest tests/checkout/payment-intent.test.js` with `gateway.intents.create` stubbed to reject; the rejection propagated out of `createPaymentIntent` to the checkout error — holds

NOT MEASURED:
- "a duplicate start reuses the existing intent" [1-1] — needs two checkout starts against one gateway session; the project's conventions give no way to stand up a gateway sandbox, and nothing in the change-set records the first intent to compare the second against

FINDINGS:
- [in-scope] [contained] tests/checkout/payment-intent.test.js:5-6 — the test builds `intent` locally and asserts its own literal back; build it through `createPaymentIntent(order)` and assert the gateway payload instead — FAILS: the test stays green whatever the intent builder sends

COVERAGE:
- an intent is created against the existing gateway account on checkout start — src/checkout/payment-intent.js:4-5 — read: `gateway.intents.create` is the only creation call in the change-set and takes the order id
- card-only enforcement — src/checkout/payment-intent.js:5 — read: `methods: ['card']` is fixed at creation and no caller widens it
- wallet flows absent — src/checkout — measured: `grep -rli "wallet\|applepay\|googlepay" src` → no files
- gateway rejection surfaces as a checkout error — src/checkout/payment-intent.js:4-5 — run: `npx jest tests/checkout/payment-intent.test.js` with a rejecting gateway stub; the rejection reached the checkout error
