# stub: analysis-standards-finds-an-unguarded-webhook

A standards analysis agent returning three findings: the handler marks
unknown intents paid, a capture the handler cannot match has no surface
anywhere, and both of the phase's tests pass while checking nothing.
Write the findings file to the path the dispatch names
(`.workflows/{work_unit}/implementation/{topic}/analysis-standards-c{N}.md`)
via the `.txt`-then-rename mechanism, with the content below, then
return the status block. Nothing else: no code writes, no git activity,
no other files.

---

The findings file:

```
AGENT: standards
FINDINGS:
- FINDING: The capture webhook marks unknown intents paid
  SEVERITY: medium
  FAILURE: A capture naming an intent the store does not know marks a phantom or wrong order paid — an operator ships or refunds against a payment that matched nothing; noticed at reconciliation, never at the webhook.
  FILES: src/webhooks/capture.js:4
  DESCRIPTION: `handleCaptureWebhook` calls `orders.markPaid(event.intentId)` without looking the intent up — a capture naming an intent the order store does not know is treated exactly like a match. Nothing in the module looks up, logs, or otherwise distinguishes a capture that matches no order.
  RECOMMENDATION: Guard the lookup — resolve the intent against the order store before marking paid; on a miss, log the capture and acknowledge the delivery without changing any order.
- FINDING: A capture that matches no order is invisible
  SEVERITY: medium
  FAILURE: Money moves at the gateway for an order the store never marks paid and nothing records that it happened — the shopper is charged and the order sits unpaid; noticed by the shopper's complaint, never by the system.
  FILES: src/webhooks/capture.js:4
  DESCRIPTION: Money can move at the gateway for an intent the order store cannot match — a capture delivered before its intent record lands, or for a record that failed to persist. Once the handler stops marking such captures paid, nothing anywhere shows they happened. The specification decides webhook-confirmed capture and the plan decides duplicate idempotency; neither says what, if anything, surfaces an unmatched capture — searched both, and the discussion besides.
  RECOMMENDATION: Settle where an unmatched capture surfaces. Two shapes are viable with mirrored costs: record it for operator follow-up, or refuse the delivery so the gateway redelivers until the intent record lands.
- FINDING: Both of the phase's tests pass while checking nothing
  SEVERITY: medium
  FAILURE: Card-only enforcement, the paid flip and idempotent redelivery can all break with the suite green — the shopper is charged twice or never marked paid; noticed in production, never in CI.
  FILES: tests/checkout/payment-intent.test.js:3, tests/webhooks/capture.test.js:3
  DESCRIPTION: Both test bodies are `() => {}`. Neither entry point can be driven as the tests stand — `createPaymentIntent` reaches `gateway` and `handleCaptureWebhook` reaches `orders` from ambient scope, so a test has to supply a double for the collaborator before it can assert anything. The specification decides card-only intents, webhook-confirmed capture and idempotent redelivery; nothing in the tree demonstrates any of them.
  RECOMMENDATION: Drive each entry point through a double for its collaborator and assert the guarantee each test names. Two doubles are viable and the tree prefers neither: a hand-written fake per test, or one shared recorded-fixture harness both suites read through.
SUMMARY: The capture webhook trusts every intent id it is handed, an unmatched capture has no surface anywhere, and the phase's tests pin none of the specification's guarantees.
```

The status block:

```
STATUS: findings
FINDINGS_COUNT: 3
SUMMARY: The webhook marks unknown intents paid, unmatched captures surface nowhere, and both tests pass while checking nothing.
```
