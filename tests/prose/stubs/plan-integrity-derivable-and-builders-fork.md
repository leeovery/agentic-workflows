# stub: plan-integrity-derivable-and-builders-fork

An integrity review agent returning three findings on the graphed pay
plan: one `settled` call the specification determines; one staged as a
`choice` that the specification in fact settles — its duplicate-start
rule decides a retried checkout, the derivation sits in the agent's own
recommended option, and no search is named; and one staged as a
`choice` whose whole substance is a mechanism — what the capture
consumer derives its duplicate key from and where it keeps it, which
the specification never decided and either side of which leaves the
shopper the same order. Write the tracking file to
`.workflows/{work_unit}/planning/{topic}/review-integrity-tracking-c1.md`
via the `.txt`-then-rename mechanism, with the content below, then
return the status block. Nothing else: no git activity, no other files.

---

The tracking file:

```markdown
# Review Tracking: Pay - Integrity

## Findings

### 1. Intent Task Carries No Acceptance Criteria

**Severity**: Important
**Plan Reference**: Phase 1 / Create Payment Intent
**Category**: Acceptance Criteria Quality
**Move**: settled
**Change Type**: update-task

**Problem**:
An implementer picking up the intent task has nothing pass/fail to
build against: "create an intent, card-only" is met by a checkout that
mints a second intent on a double-click and swallows a gateway
rejection. Two builders ship two checkouts.

**Proposal**:
The specification's Payment Intent section already decides the
criteria — card-only, a gateway rejection surfacing as a user-visible
checkout error, a duplicate checkout start reusing the existing
intent — and Phase 1's own acceptance criteria repeat card-only.
Carrying them into the task is not a new decision. I would write them
in as its acceptance criteria.

**Current**:
Create a gateway payment intent when checkout begins, card-only enforced.

**Proposed Text**:
Create a gateway payment intent when checkout begins, card-only enforced.
**Acceptance Criteria**:
- [ ] Card is the only payment method the intent accepts
- [ ] A gateway rejection surfaces as a user-visible checkout error
- [ ] A duplicate checkout start reuses the existing intent

**Resolution**: Pending
**Notes**:

---

### 2. Retried Checkout: Reuse The Intent Or Mint Another

**Severity**: Important
**Plan Reference**: Phase 1 / Attach Intent To Order
**Category**: Task Self-Containment
**Move**: choice
**Change Type**: add-to-task

**Problem**:
The attach task names "intent id missing on retry" as an edge case and
stops there. A customer who retries checkout either lands on the
intent already attached to their order or gets a fresh one every
attempt, and the task leaves the implementer to pick — two builders
ship two checkouts, and one of them strands an open intent per click.

**Options**:
- Reuse the intent already attached to the order on every retry, and create one only when the order carries none — one intent per order, nothing stranded (recommended)
- Mint a fresh intent per attempt and void the one before it — simpler retry code, and one intent per click in the gateway dashboard

**Resolution**: Pending
**Notes**:

---

### 3. What The Capture Consumer Keys A Repeat Delivery On

**Severity**: Important
**Plan Reference**: Phase 2 / Handle Capture Webhooks
**Category**: Task Self-Containment
**Move**: choice
**Change Type**: add-to-task

**Problem**:
The capture task must treat duplicate deliveries as idempotent and
never says what the consumer derives that key from or where it keeps
it. One implementer stores every gateway event id it has seen in a
side table and matches the next delivery against it; another derives
the key from the intent id and the order's own capture status and
stores nothing extra. Either satisfies the specification's rule — the
order is marked paid once and once only, whatever arrives twice — but
they are different code, different stored state, and different tests.
Searched the specification's Capture Webhooks section
(webhook-confirmed, idempotent deliveries, an unknown intent logged and
ignored — the last says how a delivery finds its order, not what makes
two deliveries the same one), the discussion (webhooks confirm capture;
the checkout never polls), the plan's phases and task tables, and the
tree: no key is named, no other
consumer sets a precedent, and no gateway client exists to measure.

**Options**:
- Keep the gateway event ids the consumer has seen in a side table and match each delivery against it (recommended)
- Derive the key from the intent id and the order's capture status, so the order's own state records what has been applied and nothing extra is kept

**Resolution**: Pending
**Notes**:

---
```

The status block:

```
STATUS: findings
CYCLE: 1
TRACKING_FILE: .workflows/pay/planning/pay/review-integrity-tracking-c1.md
FINDINGS_COUNT: 3
```
