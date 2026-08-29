# stub: finder-sweep-decision-and-defect

A consolidation finder whose sweep returns two findings — one whose
shape is settled, one whose direction the code does not settle — plus
one specification defect the tree measures. Write the findings file to
the path the dispatch names
(`.workflows/{work_unit}/implementation/{topic}/consolidation-findings-p{N}.md`)
via the `.txt`-then-rename mechanism, with the content below, then
return the status block. Nothing else: no code writes, no git activity,
no other files.

---

The findings file:

```markdown
# Consolidation Findings: Pay (Phase 1)

## Findings

### F1: Gateway result handling is hand-rolled twice
- **Class**: near-miss
- **Evidence**: src/checkout/payment-intent.js:5 and src/webhooks/capture.js:4 — each unwraps the gateway's response inline
- **Proposed shape**: extract a shared `src/gateway/result.js` helper and call it from both sites

### F2: The gateway's identifier is named two ways across the phase
- **Class**: drift
- **Evidence**: src/checkout/payment-intent.js:5 passes the intent as `order`, while src/webhooks/capture.js:4 reads it back as `event.intentId` — one concept, two names, and their tests follow each site's spelling
- **Proposed shape**: settle on one name across both entry points and their tests. Two spellings are viable and the phase's code prefers neither: `intentId`, the gateway's own name as the webhook payload carries it, or `intent`, the name the checkout side and the specification use. Whichever is chosen, the other site and its test rename to match

## Spec Defects

### S1: The specification names a checkout path the tree does not have
- **Claim**: "Intent creation lives in `src/checkout/intent.js`." (§ Design notes)
- **Observed**: `ls src/checkout` lists `payment-intent.js` and nothing else; `createPaymentIntent` is defined at src/checkout/payment-intent.js:4
- **Read**: spec stale — a path the tree settles by direct measurement, not a design question

## Observations

- none
```

The status block:

```
STATUS: findings
FINDINGS_COUNT: 2
BANK: no entries
SUMMARY: One extraction and one naming split to settle, plus a stale path in the specification.
```
