# stub: analysis-standards-finds-a-stale-spec-path

A standards analysis agent returning two findings — a specification path
the tree does not have, and module headers asserting behaviour the code
never implements — and one comment correction: the webhook header's
claim that no polling path exists anywhere, a claim about the rest of
the system that code-quality.md's comment discipline forbids. Write the
findings file to the path the dispatch names
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
  FAILURE: Whoever next follows the specification's note — a reviewer checking conformance, an engineer extending checkout — lands on a file that does not exist and has to rediscover where intent creation lives; noticed the first time the note is followed.
  FILES: .workflows/pay/specification/pay/specification.md (§3 Design Notes), src/checkout/payment-intent.js:4
  DESCRIPTION: The specification's Design Notes (§3) say intent creation lives in `src/checkout/intent.js`. `ls src/checkout` lists `payment-intent.js` and nothing else, and `createPaymentIntent` is defined at src/checkout/payment-intent.js:4. The code sits where the specification's requirements expect it; only the path in the note is wrong.
  RECOMMENDATION: The specification is the side that is stale — the path it names should read `src/checkout/payment-intent.js`.
- FINDING: Module headers assert behaviour neither module implements
  SEVERITY: medium
  FAILURE: A gateway rejection propagates raw instead of as a checkout error, a double-submitted checkout mints two intents, and a redelivered capture marks the order paid twice — the shopper is charged twice or told nothing; noticed in production, since both of the phase's tests are empty.
  FILES: src/checkout/payment-intent.js:1, src/webhooks/capture.js:1
  DESCRIPTION: The checkout header states that gateway rejection surfaces as a checkout error and that a duplicate start reuses the existing intent; the webhook header states that duplicate deliveries are idempotent. Each function body is a single unguarded call — none of the three guarantees exists in code, and both of the phase's named tests are empty stubs.
  RECOMMENDATION: Implement the three stated guarantees behind the existing entry points, each with a test that exercises it.
COMMENT_CORRECTIONS:
- src/webhooks/capture.js:1 — the header asserts that no polling path exists anywhere: a claim about the rest of the system, true today and falsified by any later addition far from this file, which code-quality.md's comment discipline forbids
  OLD: // Consume gateway capture webhooks and mark the order paid. There
       // is no polling path; duplicate deliveries are idempotent.
  NEW: // Consume gateway capture webhooks and mark the order paid.
       // Duplicate deliveries are idempotent.
SUMMARY: One stale path in the specification, three behavioural guarantees asserted in comments that the code does not carry, and one header claim about the rest of the system to remove.
```

The status block:

```
STATUS: findings
FINDINGS_COUNT: 2
SUMMARY: A stale specification path, a set of comment-only guarantees, and one header claim to correct.
```
