# stub: spec-claims-source-defect

A claims verification agent whose measurement pass finds one failing
claim that lives in the source record. Write the tracking file to
`.workflows/{work_unit}/specification/{topic}/review-claims-tracking-c1.md`
via the `.txt`-then-rename mechanism, with the content below, then
return the status block. Nothing else: no git activity, no other files.

---

The tracking file:

```markdown
# Review Tracking: Pay - Claims Verification

## Findings

### 1. Checkout Module Count Fails Measurement

**Source**: Tree measurement — `ls src/checkout/*.js | wc -l`
**Category**: Source defect
**Affects**: Telemetry Coverage

**Details**:
The specification asserts the checkout flow spans four modules
(`ls src/checkout/*.js | wc -l` → 4). Measured now, the command prints
5 — src/checkout/wallet-stub.js also exists. The same claim, with the
same recorded command, sits in the source discussion's Telemetry
Coverage ground; the specification carries it faithfully. The fix
belongs to the source record.

**Proposed Change**:

**Resolution**: Pending
**Notes**:

---
```

The status block:

```
STATUS: findings
FINDINGS_COUNT: 1
SUMMARY: One load-bearing count fails measurement, and the source record carries it — routed, not applied.
```
