# stub: analysis-standards-finds-a-naming-split

A standards analysis agent returning one finding: the identifier
linking the two entry points is named two ways. Write the findings file
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
- FINDING: The gateway's identifier is named two ways across the phase
  SEVERITY: low
  FILES: src/checkout/payment-intent.js:5, src/webhooks/capture.js:4
  DESCRIPTION: The checkout module keys the payment as `order` while the webhook module reads it back as `event.intentId` — one concept, two names, and each test's comments follow its own site's spelling. Behaviour is unaffected; the split is naming only.
  RECOMMENDATION: Settle on one spelling across both entry points and their tests. Two are viable and the code prefers neither: `intentId`, the gateway's own name as the webhook payload carries it, or `intent`, the vocabulary the specification uses. Whichever is chosen, the other site and its tests rename to match.
SUMMARY: One concept named two ways across the phase's two modules.
```

The status block:

```
STATUS: findings
FINDINGS_COUNT: 1
SUMMARY: The gateway identifier is spelled differently at the two entry points.
```
