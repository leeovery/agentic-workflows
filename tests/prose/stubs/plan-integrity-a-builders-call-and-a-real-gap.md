# stub: plan-integrity-a-builders-call-and-a-real-gap

An integrity review agent returning two findings on the graphed pay
plan: one whose whole substance is the builder's — how the capture
consumer finds the order a capture names, a mechanism the specification
leaves open and any implementer settles with the code in front of
them — and one real gap, a criterion the shopper meets that the
specification decides and the intent task never carries. One point
below the floor closes the file under `## Observations`. Write the
tracking file to
`.workflows/{work_unit}/planning/{topic}/review-integrity-tracking-c1.md`
via the `.txt`-then-rename mechanism, with the content below, then
return the status block. Nothing else: no git activity, no other files.

---

The tracking file:

```markdown
# Review Tracking: Pay - Integrity

## Findings

### 1. The Capture Consumer Should Resolve Its Order Through An Index

**Severity**: Important
**Plan Reference**: Phase 2 / Handle Capture Webhooks
**Category**: Task Self-Containment
**Move**: settled
**Change Type**: update-task

**Problem**:
The capture task says to mark the order paid and never says how the
consumer gets from the intent the capture names to the order that
carries it. One implementer scans the orders for a matching intent id,
another keeps an index keyed on it; the scan does the same work over a
growing table every time a webhook lands.

**Proposal**:
I would state the lookup in the task: the consumer resolves the order
through an index keyed on the intent id, so a capture costs one read
rather than a pass over the orders.

**Current**:
Consume gateway capture webhooks and mark the order paid; no polling path.

**Proposed Text**:
Consume gateway capture webhooks and mark the order paid; no polling path. The consumer resolves the order through an index keyed on the intent id.

**Resolution**: Pending
**Notes**:

---

### 2. A Declined Card Leaves The Shopper Nothing To Read

**Severity**: Critical
**Plan Reference**: Phase 1 / Create Payment Intent
**Category**: Acceptance Criteria Quality
**Move**: settled
**Change Type**: add-to-task

**Problem**:
The intent task carries no criteria at all, and the one the shopper
meets is the missing one: when the gateway refuses the intent, the
checkout has nothing to show. An implementer reading only the task
either swallows the refusal and leaves the shopper on a page that never
advances, or puts the gateway's own code in front of them. A shopper
whose card is declined is told nothing they can act on, and support
hears it as "the checkout is broken".

**Proposal**:
The specification's Payment Intent section already decides it — a
gateway rejection surfaces as a user-visible checkout error, and
card-only sits beside it. Carrying those decisions into the task is not
a new decision. I would write them in as the task's acceptance
criteria.

**Current**:
Create a gateway payment intent when checkout begins, card-only enforced.

**Proposed Text**:
Create a gateway payment intent when checkout begins, card-only enforced.
**Acceptance Criteria**:
- [ ] Card is the only payment method the intent accepts
- [ ] A gateway rejection surfaces as a user-visible checkout error

**Resolution**: Pending
**Notes**:

## Observations

- Phase 1's two tasks open with the same sentence shape and Phase 2's opens differently; nothing is built differently either way.
```

The status block:

```
STATUS: findings
CYCLE: 1
TRACKING_FILE: .workflows/pay/planning/pay/review-integrity-tracking-c1.md
FINDINGS_COUNT: 2
```
