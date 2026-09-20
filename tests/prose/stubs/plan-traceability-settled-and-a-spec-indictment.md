# stub: plan-traceability-settled-and-a-spec-indictment

A traceability review agent returning two findings on the graphed pay
plan: one ordinary `settled` — a rule the specification decides and the
plan never carries — and one that indicts the specification itself, a
missing-from-plan finding whose ground the specification asserts
without the mechanism that makes it true, staged as a `choice` with the
search named and coming up empty. Write the tracking file to
`.workflows/{work_unit}/planning/{topic}/review-traceability-tracking-c1.md`
via the `.txt`-then-rename mechanism, with the content below, then
return the status block. Nothing else: no git activity, no other files.

---

The tracking file:

```markdown
# Review Tracking: Pay - Traceability

## Findings

### 1. An Unknown Intent Has Nowhere To Go In The Plan

**Type**: Missing from plan
**Spec Reference**: Capture Webhooks — "A capture naming an intent no order carries is logged and ignored."
**Plan Reference**: Phase 2 / Handle Capture Webhooks
**Move**: settled
**Change Type**: add-to-task

**Problem**:
The capture task names "webhook for an unknown intent" as an edge case
and decides nothing about it. An implementer reading only the task
either drops the delivery silently or raises on it; one of those loses
the only trace of a capture nobody can explain, and support has
nothing to look at when a shopper says they paid.

**Proposal**:
The specification already decides this in Capture Webhooks — a capture
naming an intent no order carries is logged and ignored. Carrying its
decision into the task is not a new decision. I would write it in as
the task's acceptance criteria.

**Current**:
Consume gateway capture webhooks and mark the order paid; no polling path.

**Proposed Text**:
Consume gateway capture webhooks and mark the order paid; no polling path.
**Acceptance Criteria**:
- [ ] A capture webhook marks its order paid
- [ ] A repeated delivery of the same capture changes nothing
- [ ] A capture naming an intent no order carries is logged and ignored

**Resolution**: Pending
**Notes**:

---

### 2. Card-Only At Checkout: What The Shopper Actually Meets

**Type**: Missing from plan
**Spec Reference**: Payment Intent — "Card payments only; wallet flows are out of scope for v1."
**Plan Reference**: Phase 1 / Create Payment Intent
**Move**: choice
**Change Type**: add-to-task

**Problem**:
The specification asserts card-only and never says what the shopper
who arrives at checkout with a saved wallet method is shown, so the
plan has no task that can build it. An implementer either hides every
non-card method and a shopper's usual way to pay silently disappears,
or leaves it on the page and the shopper is refused at submit after
choosing it. Both ship; nobody decided which. Searched the
specification's Payment Intent section (card-only, a gateway rejection
at creation surfacing as a user-visible checkout error), its Capture
Webhooks section, the discussion (the gateway account, webhook-only
confirmation), the plan's phases and task tables, and the tree: none
of them says what the shopper meets, and there is no existing checkout
surface to measure a precedent against. Ground: none found.

**Options**:
- Hide every non-card method at checkout, so a wallet is never offered and never refused (recommended)
- Leave the method on the page and refuse it at submit with the checkout error the rejection rule already defines

**Resolution**: Pending
**Notes**:

---
```

The status block:

```
STATUS: findings
CYCLE: 1
TRACKING_FILE: .workflows/pay/planning/pay/review-traceability-tracking-c1.md
FINDINGS_COUNT: 2
```
