# stub: analysis-standards-finds-an-unguarded-webhook

A standards analysis agent returning two findings about the capture
webhook: the handler marks unknown intents paid, and a capture the
handler cannot match has no surface anywhere. Write the findings file
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
SUMMARY: The capture webhook trusts every intent id it is handed, and an unmatched capture has no surface anywhere.
```

The status block:

```
STATUS: findings
FINDINGS_COUNT: 2
SUMMARY: The webhook marks unknown intents paid, and unmatched captures surface nowhere.
```
