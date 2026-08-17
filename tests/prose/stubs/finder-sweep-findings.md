# stub: finder-sweep-findings

A consolidation finder whose sweep confirms the banked opportunity as
one finding. Write the findings file to the path the dispatch names
(`.workflows/{work_unit}/implementation/{topic}/consolidation-findings-p{N}.md`)
via the `.txt`-then-rename mechanism, with the content below — quoting
the banked entry's JSON verbatim as received in the dispatch — then
return the status block. Nothing else: no code reads beyond what the
dispatch provides, no git activity, no other files.

---

The findings file:

```markdown
# Consolidation Findings: Pay (Phase 1)

## Findings

### F1: Gateway result handling is hand-rolled twice
- **Class**: near-miss
- **Evidence**: src/checkout/payment-intent.js:5 and src/webhooks/capture.js:5 — each unwraps the gateway result inline
- **Proposed shape**: extract a shared `src/gateway/result.js` helper and call it from both sites
- **Bank**: Gateway result handling is hand-rolled in both checkout entry points

## Bank Verdicts

- Gateway result handling is hand-rolled in both checkout entry points — confirmed → F1
  {the banked entry's JSON, verbatim as received in the dispatch}

## Observations

- none
```

The status block:

```
STATUS: findings
FINDINGS_COUNT: 1
BANK: confirmed 1, mooted 0, residue 0
SUMMARY: Both tasks hand-roll gateway result handling — one extraction consolidates them.
```
