# stub: plan-traceability-churn-second-pair

A traceability review agent's second cycle over the pay plan: two more
`settled` calls the specification decides, both in Phase 2's capture
task — a task the first cycle's findings never touched, and neither
title shares ground with them. The second finding's Current is the task
as this agent read it, before the first finding of this cycle lands.
Write the tracking file to
`.workflows/{work_unit}/planning/{topic}/review-traceability-tracking-c2.md`
via the `.txt`-then-rename mechanism, with the content below, then
return the status block. Nothing else: no git activity, no other files.

---

The tracking file:

```markdown
# Review Tracking: Pay - Traceability

## Findings

### 1. A Repeat Delivery Charges The Same Order Twice Over

**Type**: Missing from plan
**Spec Reference**: Capture Webhooks — "Duplicate deliveries are idempotent."
**Plan Reference**: Phase 2 / Handle Capture Webhooks
**Move**: settled
**Change Type**: add-to-task

**Problem**:
The capture task names "duplicate webhook delivery" as an edge case in
the phase table and decides nothing about it. A gateway that redelivers
a capture has the consumer act on it a second time — the order marked
paid again and everything hung off that transition run again — so a
shopper gets two receipts for one payment and the finance export shows
a capture that never happened twice.

**Proposal**:
The specification's Capture Webhooks section decides it — duplicate
deliveries are idempotent. Carrying that decision into the task is not
a new decision. I would write it in as the task's acceptance criteria.

**Current**:
Consume gateway capture webhooks and mark the order paid; no polling path.

**Proposed Text**:
Consume gateway capture webhooks and mark the order paid; no polling path.
**Acceptance Criteria**:
- [ ] A capture webhook marks its order paid
- [ ] A repeat delivery of a capture already applied changes nothing

**Resolution**: Pending
**Notes**:

---

### 2. A Capture Nobody Can Trace Disappears

**Type**: Missing from plan
**Spec Reference**: Capture Webhooks — "A capture naming an intent no order carries is logged and ignored."
**Plan Reference**: Phase 2 / Handle Capture Webhooks
**Move**: settled
**Change Type**: add-to-task

**Problem**:
The capture task names "webhook for an unknown intent" as an edge case
and decides nothing about it. An implementer reading only the task
either drops the delivery without a word or raises on it and stops the
consumer; the silent drop loses the only trace of money the gateway
says it took, so when a shopper says they paid there is nothing for
support to look at.

**Proposal**:
The specification's Capture Webhooks section decides it — a capture
naming an intent no order carries is logged and ignored. Carrying that
decision into the task is not a new decision. I would add it to the
task's acceptance criteria.

**Current**:
Consume gateway capture webhooks and mark the order paid; no polling path.

**Proposed Text**:
Consume gateway capture webhooks and mark the order paid; no polling path.
**Acceptance Criteria**:
- [ ] A capture naming an intent no order carries is logged and ignored, and the consumer keeps running

**Resolution**: Pending
**Notes**:
```

The status block:

```
STATUS: findings
CYCLE: 2
TRACKING_FILE: .workflows/pay/planning/pay/review-traceability-tracking-c2.md
FINDINGS_COUNT: 2
```
