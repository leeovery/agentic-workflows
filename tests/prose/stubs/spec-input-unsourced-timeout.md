# stub: spec-input-unsourced-timeout

An input review agent whose reverse-fidelity pass finds one value the
specification pins and no source states. Write the tracking file to
`.workflows/{work_unit}/specification/{topic}/review-input-tracking-c1.md`
via the `.txt`-then-rename mechanism, with the content below, then
return the status block. Nothing else: no git activity, no other files.

---

The tracking file:

```markdown
# Review Tracking: Pay - Input Review

## Findings

### 1. Per-Attempt Timeout Value Is Unsourced

**Source**: No source decides this
**Category**: Unsourced decision
**Affects**: Intent Creation Resilience

**Details**:
The specification pins each gateway attempt's cap at 2 seconds ("Each
gateway attempt is capped at 2 seconds"). The discussion decides the
shape around the cap — one retry fired immediately with no backoff,
the whole attempt sequence inside the checkout's 6-second interstitial
budget, a cap that exists so a hung call never eats the retry's chance
and sits no tighter than the budget forces — but no source states the
cap's value. Checked the sole source (the pay discussion) end to end.
A concrete parameter the specification decided on its own.

**Proposed Change**:

**Resolution**: Pending
**Notes**:

---
```

The status block:

```
STATUS: findings
FINDINGS_COUNT: 1
SUMMARY: The spec pins the per-attempt gateway cap at a value no source states — routed, not applied.
```
