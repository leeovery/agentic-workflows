# stub: analysis-standards-finds-an-unguarded-webhook

A standards analysis agent returning three findings: the handler marks
unknown intents paid, a capture the handler cannot match has no surface
anywhere, and the identifier linking the two entry points is named two
ways. Write the findings file
to the path the dispatch names
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
  FILES: src/webhooks/capture.js:4
  DESCRIPTION: `handleCaptureWebhook` calls `orders.markPaid(event.intentId)` without looking the intent up — a capture naming an intent the order store does not know is treated exactly like a match. Nothing in the module looks up, logs, or otherwise distinguishes a capture that matches no order.
  RECOMMENDATION: Guard the lookup — resolve the intent against the order store before marking paid; on a miss, log the capture and acknowledge the delivery without changing any order.
- FINDING: A capture that matches no order is invisible
  SEVERITY: medium
  FILES: src/webhooks/capture.js:4
  DESCRIPTION: Money can move at the gateway for an intent the order store cannot match — a capture delivered before its intent record lands, or for a record that failed to persist. Once the handler stops marking such captures paid, nothing anywhere shows they happened. The specification decides webhook-confirmed capture and the plan decides duplicate idempotency; neither says what, if anything, surfaces an unmatched capture — searched both, and the discussion besides.
  RECOMMENDATION: Settle where an unmatched capture surfaces. Two shapes are viable with mirrored costs: record it for operator follow-up, or refuse the delivery so the gateway redelivers until the intent record lands.
- FINDING: The gateway's identifier is named two ways across the phase
  SEVERITY: low
  FILES: src/checkout/payment-intent.js:5, src/webhooks/capture.js:4
  DESCRIPTION: The checkout module keys the payment as `order` while the webhook module reads it back as `event.intentId` — one concept, two names, and each test's comments follow its own site's spelling. Behaviour is unaffected; the split is naming only.
  RECOMMENDATION: Settle on one spelling across both entry points and their tests. Two are viable and the code prefers neither: `intentId`, the gateway's own name as the webhook payload carries it, or `intent`, the vocabulary the specification uses. Whichever is chosen, the other site and its tests rename to match.
SUMMARY: The capture webhook trusts every intent id it is handed, an unmatched capture has no surface anywhere, and one concept is named two ways.
```

The status block:

```
STATUS: findings
FINDINGS_COUNT: 3
SUMMARY: The webhook marks unknown intents paid, unmatched captures surface nowhere, and the gateway identifier is spelled two ways.
```
