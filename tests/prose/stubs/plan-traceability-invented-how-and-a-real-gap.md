# stub: plan-traceability-invented-how-and-a-real-gap

A traceability review agent returning two findings on the graphed pay
plan: one `Hallucinated content` — the capture task's **Do** prescribes
a retry schedule, a delivery key and an eviction window the
specification never decided, and the fix is removal with the decided
behaviour restated as criteria, never another mechanism in its place —
and one real gap, a rule the specification decides that the attach task
never carries. Write the tracking file to
`.workflows/{work_unit}/planning/{topic}/review-traceability-tracking-c1.md`
via the `.txt`-then-rename mechanism, with the content below, then
return the status block. Nothing else: no git activity, no other files.

---

The tracking file:

```markdown
# Review Tracking: Pay - Traceability

## Findings

### 1. The Capture Task Prescribes A Retry Schedule Nobody Decided

**Type**: Hallucinated content
**Spec Reference**: N/A — Capture Webhooks decides the behaviour, nothing about retries, keys or eviction
**Plan Reference**: Phase 2 / Handle Capture Webhooks
**Move**: settled
**Change Type**: update-task

**Problem**:
The capture task tells the implementer to retry the order write three
times at fixed delays and to remember deliveries by gateway event id
for a day. The specification decides none of it: it says a capture is
confirmed by webhook, that repeat deliveries are idempotent, and that a
capture naming an intent no order carries is logged and ignored. A
builder who follows the task ships a 24-hour window as if it were a
product rule — a capture redelivered on day two marks the order paid a
second time, and nobody chose that.

**Proposal**:
Take the mechanism out. The specification decides what the consumer
must achieve, so the task carries that and nothing else — the criteria
below are its Capture Webhooks section in plan form. How the write is
retried, what the consumer keys a repeat on, and how long it keeps it
are the implementer's, with the code in front of them; the plan states
no replacement.

**Current**:
Consume gateway capture webhooks and mark the order paid; no polling path.
**Do**: Mark the order paid through the shared retry helper — three attempts at 200 ms, 400 ms and 800 ms before giving up — and key the consumer's seen-delivery set on the gateway event id, evicting entries older than 24 hours.

**Proposed Text**:
Consume gateway capture webhooks and mark the order paid; no polling path.
**Acceptance Criteria**:
- [ ] A capture webhook for an order arrives and the order reads paid
- [ ] The same capture is delivered again and the order still reads paid once, with nothing else changed
- [ ] A capture naming an intent no order carries is logged and the delivery is ignored

**Resolution**: Pending
**Notes**:

---

### 2. A Retried Checkout Has No Rule In The Attach Task

**Type**: Missing from plan
**Spec Reference**: Payment Intent — "A duplicate checkout start reuses the existing intent."
**Plan Reference**: Phase 1 / Attach Intent To Order
**Move**: settled
**Change Type**: add-to-task

**Problem**:
The attach task says to persist the intent id and stops there. A
shopper who starts checkout twice either lands back on the intent their
order already carries or gets a fresh one over the top of it, and the
task decides neither — so the second builder strands an open intent per
attempt and the gateway dashboard fills with payments nobody made.

**Proposal**:
The specification's Payment Intent section already decides it — a
duplicate checkout start reuses the existing intent. Carrying its
decision into the task is not a new decision. I would write it in as
the task's acceptance criteria.

**Current**:
Persist the intent id on the order for later capture confirmation.

**Proposed Text**:
Persist the intent id on the order for later capture confirmation.
**Acceptance Criteria**:
- [ ] Checkout starts on an order carrying no intent id and the order takes the id of the intent just created
- [ ] Checkout is started again on an order that already carries an intent id and the same intent is used, with no second intent created

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
