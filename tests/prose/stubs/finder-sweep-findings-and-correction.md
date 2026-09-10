# stub: finder-sweep-findings-and-correction

A consolidation finder whose sweep confirms the banked opportunity as
one finding and records one comment correction: the webhook header's
claim that no polling path exists anywhere — a claim about the rest of
the system that code-quality.md's comment discipline forbids. Write the
findings file to the path the dispatch names
(`.workflows/{work_unit}/implementation/{topic}/consolidation-findings-p{N}.md`)
via the `.txt`-then-rename mechanism, with the content below — the
finding's Bank line names the entry it confirms — then return the
status block. Nothing else: no code reads beyond what the dispatch
provides, no code writes, no git activity, no other files.

---

The findings file:

```markdown
# Consolidation Findings: Pay (Phase 1)

## Findings

### F1: Gateway result handling is hand-rolled twice
- **Class**: near-miss
- **Failure**: Two hand-rolled readers of the gateway's result shape drift silently — a renamed status field or a new error envelope is handled at one site and missed at the other, so checkout and capture disagree on whether a payment succeeded: an order paid at the gateway and never marked paid, noticed by the shopper, since neither reader is pinned by a test
- **Evidence**: src/checkout/payment-intent.js:5 and src/webhooks/capture.js:5 — each unwraps the gateway result inline
- **Proposed shape**: extract a shared `src/gateway/result.js` helper and call it from both sites
- **Bank**: Gateway result handling is hand-rolled in both checkout entry points

## Comment Corrections

- src/webhooks/capture.js:1 — the header asserts that no polling path exists anywhere: a claim about the rest of the system, true today and falsified by any later addition far from this file, which code-quality.md's comment discipline forbids
  OLD: // Consume gateway capture webhooks and mark the order paid. There
       // is no polling path; duplicate deliveries are idempotent.
  NEW: // Consume gateway capture webhooks and mark the order paid.
       // Duplicate deliveries are idempotent.
```

The status block:

```
STATUS: findings
FINDINGS_COUNT: 1
BANK: confirmed 1
SUMMARY: Both tasks hand-roll gateway result handling — one extraction consolidates them — and the webhook header carries one claim to correct.
```
