# stub: analysis-standards-finds-a-stale-spec-path

A standards analysis agent returning two findings: a specification path
the tree does not have, and module headers asserting behaviour the code
never implements. Write the findings file to the path the dispatch names
(`.workflows/{work_unit}/implementation/{topic}/analysis-standards-c{N}.md`)
via the `.txt`-then-rename mechanism, with the content below, then
return the status block. Nothing else: no code writes, no git activity,
no other files.

---

The findings file:

```
AGENT: standards
FINDINGS:
- FINDING: The specification names a checkout path the tree does not have
  SEVERITY: low
  FILES: .workflows/pay/specification/pay/specification.md (Design notes), src/checkout/payment-intent.js:4
  DESCRIPTION: The specification's Design notes say intent creation lives in `src/checkout/intent.js`. `ls src/checkout` lists `payment-intent.js` and nothing else, and `createPaymentIntent` is defined at src/checkout/payment-intent.js:4. The code sits where the specification's requirements expect it; only the path in the note is wrong.
  RECOMMENDATION: The specification is the side that is stale — the path it names should read `src/checkout/payment-intent.js`.
- FINDING: Module headers assert behaviour neither module implements
  SEVERITY: medium
  FILES: src/checkout/payment-intent.js:1, src/webhooks/capture.js:1
  DESCRIPTION: The checkout header states that gateway rejection surfaces as a checkout error and that a duplicate start reuses the existing intent; the webhook header states that duplicate deliveries are idempotent. Each function body is a single unguarded call — none of the three guarantees exists in code, and both of the phase's named tests are empty stubs.
  RECOMMENDATION: Implement the three stated guarantees behind the existing entry points, each with a test that exercises it.
SUMMARY: One stale path in the specification, and three behavioural guarantees asserted in comments that the code does not carry.
```

The status block:

```
STATUS: findings
FINDINGS_COUNT: 2
SUMMARY: A stale specification path and a set of comment-only guarantees.
```
