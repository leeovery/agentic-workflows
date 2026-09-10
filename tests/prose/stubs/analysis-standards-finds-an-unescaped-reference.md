# stub: analysis-standards-finds-an-unescaped-reference

A standards analysis agent returning two findings: the handler marks
unknown intents paid, and checkout hands the gateway an order reference
its SDK cannot take literally. Write the findings file to the path the
dispatch names
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
- FINDING: A `~`-prefixed order reference reaches the gateway unescaped
  SEVERITY: medium
  FAILURE: A shopper whose order reference begins with `~` cannot pay — checkout surfaces the gateway's `unknown lookup` error as a checkout failure that names nothing the shopper did; noticed as an abandoned checkout.
  FILES: src/checkout/payment-intent.js:5, src/checkout/payment-intent.js:6
  DESCRIPTION: `createPaymentIntent` refuses an empty or over-long reference with checkout's own message before the SDK is called, then hands every other `order.id` to `gateway.intents.create` unchanged. The SDK's reference grammar reads a leading `~` as a lookup expression rather than a literal, so an order whose reference begins with `~` never gets checkout's refusal — it gets the gateway's `unknown lookup` error, surfaced as the checkout error. Neither the specification nor the discussion addresses reference grammar; the plan's pay-1-1 decides only the empty and over-long refusals.
  RECOMMENDATION: Settle what checkout does with a `~`-prefixed reference before the SDK sees it. Two shapes are viable: escape it for the SDK's grammar (`=~foo` addresses literally) so it pays, or refuse it beside the existing refusals.
SUMMARY: The capture webhook trusts every intent id it is handed, and a `~`-prefixed order reference reaches the gateway unescaped.
```

The status block:

```
STATUS: findings
FINDINGS_COUNT: 2
SUMMARY: The webhook marks unknown intents paid, and a `~`-prefixed order reference reaches the gateway unescaped.
```
