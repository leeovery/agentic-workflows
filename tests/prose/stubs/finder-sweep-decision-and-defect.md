# stub: finder-sweep-decision-and-defect

A consolidation finder whose sweep returns two findings — one whose
shape is settled, one an open product call the record does not settle —
plus one specification defect the tree measures. Write the findings file to
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

### F2: A capture of any amount marks the order fully paid
- **Class**: behaviour
- **Evidence**: src/webhooks/capture.js:4 — `orders.markPaid(event.intentId)` reads nothing but the intent id. A capture event carries an amount, so a capture short of the order total marks an underpaid order paid and fulfillable. The specification decides webhook-confirmed capture, the discussion decides card-only, and the plan's tasks decide idempotency — searched all three; none says anything about capture amounts
- **Proposed shape**: read the captured amount from the capture event and compare it against the order total — any handling needs that much. What a shortfall then does to the order is a product call the record leaves open, with real costs either way: hold the order unpaid and flag it for operator follow-up (an underpaid order never ships, at the cost of a follow-up queue v1 never planned), or mark it paid with the shortfall recorded on the order (checkout stays friction-free, and underpaid orders ship visibly short). No measurement settles which risk the product carries

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
SUMMARY: One extraction to settle and one short-capture call the record leaves open, plus a stale path in the specification.
```
