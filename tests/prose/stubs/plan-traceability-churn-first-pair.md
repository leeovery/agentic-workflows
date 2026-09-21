# stub: plan-traceability-churn-first-pair

A traceability review agent's first cycle over the graphed pay plan:
two `settled` calls the specification decides and the plan never
carries, one in each of Phase 1's two tasks, plus one point below the
floor recorded under `## Observations` — never a finding, never
counted. Write the tracking file to
`.workflows/{work_unit}/planning/{topic}/review-traceability-tracking-c1.md`
via the `.txt`-then-rename mechanism, with the content below, then
return the status block. Nothing else: no git activity, no other files.

---

The tracking file:

```markdown
# Review Tracking: Pay - Traceability

## Findings

### 1. A Declined Card Leaves The Shopper Nothing To Read

**Type**: Missing from plan
**Spec Reference**: Payment Intent — "A gateway rejection surfaces as a user-visible checkout error."
**Plan Reference**: Phase 1 / Create Payment Intent
**Move**: settled
**Change Type**: add-to-task

**Problem**:
The intent task names no criteria at all, and the one the shopper meets
is the missing one: when the gateway refuses the intent, the checkout
has nothing to show. An implementer reading only the task either
swallows the refusal and leaves the shopper on a page that never
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

---

### 2. A Returning Shopper Can End Up Behind Two Payments

**Type**: Missing from plan
**Spec Reference**: Payment Intent — "A duplicate checkout start reuses the existing intent."
**Plan Reference**: Phase 1 / Attach Intent To Order
**Move**: settled
**Change Type**: add-to-task

**Problem**:
The attach task names "intent id missing on retry" as an edge case and
decides nothing about it. A shopper who comes back to a checkout they
left either lands on the payment they already opened or opens a second
one behind it, and the plan leaves the implementer to pick. The second
build leaves one order carrying two live payments, and support cannot
say which one the shopper's money went to.

**Proposal**:
The specification's Payment Intent section decides it — a duplicate
checkout start reuses the existing intent — so an order that already
carries an intent id keeps it and no second intent is created.
Carrying that decision into the task is not a new decision. I would
write it in as the task's acceptance criteria.

**Current**:
Persist the intent id on the order for later capture confirmation.

**Proposed Text**:
Persist the intent id on the order for later capture confirmation.
**Acceptance Criteria**:
- [ ] The order carries its intent id from the moment the intent is created
- [ ] A second checkout start on an order that already carries an intent id reuses it, and no second intent is created

**Resolution**: Pending
**Notes**:

## Observations

- The phase table's summary for the intent task and the phase-1 detail file's Solution line say the same thing in slightly different words; either reading builds the same task.
```

The status block:

```
STATUS: findings
CYCLE: 1
TRACKING_FILE: .workflows/pay/planning/pay/review-traceability-tracking-c1.md
FINDINGS_COUNT: 2
```
