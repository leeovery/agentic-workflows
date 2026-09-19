# stub: spec-input-refund-window

An input review agent returning one `settled` finding the source
document determines: the discussion fixes the refund window and the
specification never states it. It carries a Current field and its
replacement wording. Write the tracking file to
`.workflows/{work_unit}/specification/{topic}/review-input-tracking-c1.md`
via the `.txt`-then-rename mechanism, with the content below, then
return the status block. Nothing else: no git activity, no other files.

---

The tracking file:

```markdown
# Review Tracking: Pay - Input Review

## Findings

### 1. Refund Window Missing

**Source**: discussion/pay.md · Refunds
**Category**: Enhancement to existing topic
**Move**: settled
**Affects**: Refunds

**Problem**:
The specification says refunds are supported but never says for how
long, so a customer refunded on day 40 and one refused on day 40 are
both defensible builds.

**Proposal**:
The discussion's Refunds decision fixes the window at 30 days from
capture. Carrying it across is not a new decision — I would state it in
the Refunds section.

**Current**:
- Refunds are issued against the original payment intent.

**Proposed Text**:
- Refunds are issued against the original payment intent, within 30
  days of capture.

**Resolution**: Pending
**Notes**:

---
```

The status block:

```
STATUS: findings
FINDINGS_COUNT: 1
SUMMARY: The 30-day refund window the discussion decides is missing from the spec.
```
