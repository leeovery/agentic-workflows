# stub: spec-gap-builders-detail-and-open-choice

A gap analysis agent returning three findings: one `settled` call the
specification's own record determines; one staged `settled` whose whole
substance is the order two fields are written in inside an internal log
line, derived by analogy to a neighbouring rule; and one `choice` the
record leaves genuinely open, its search named and each side's cost to
the customer stated. An Observations line sits below them. Write the
tracking file to
`.workflows/{work_unit}/specification/{topic}/review-gap-analysis-tracking-c1.md`
via the `.txt`-then-rename mechanism, with the content below, then
return the status block. Nothing else: no git activity, no other files.

---

The tracking file:

```markdown
# Review Tracking: Pay - Gap Analysis

## Findings

### 1. Nothing Says How Long An Order Waits For Confirmation

**Source**: Specification analysis
**Category**: Gap/Ambiguity
**Move**: settled
**Priority**: Critical
**Affects**: Capture Webhooks

**Problem**:
The specification says when the gateway's re-deliveries land and it
says a payment is unconfirmed once they are exhausted, but it never
says how long the order waits. A builder picking their own timeout —
five minutes is the obvious guess — closes the order while the
gateway's last re-delivery is still to come, so a customer whose bank
was slow has the money taken and no order to show for it, and finds
out when the confirmation never arrives.

**Proposal**:
The record fixes it with no room left over: the last re-delivery lands
25 minutes after the first attempt, and the payment is unconfirmed once
the re-deliveries are exhausted — so the wait is 25 minutes from the
first attempt, and no other window is consistent with both rules. I
would state it in Capture Webhooks.

**Proposed Text**:
- An order waits for capture confirmation until the gateway's
  re-deliveries are exhausted — 25 minutes from the first delivery
  attempt.

**Resolution**: Pending
**Notes**:

---

### 2. Audit Line Field Order Unstated

**Source**: Specification analysis
**Category**: Enhancement to existing topic
**Move**: settled
**Priority**: Important
**Affects**: Refunds

**Problem**:
The audit line carries the payment intent id and the amount, and the
specification does not say which is written first. Two builds produce
two shapes of the same line, and anything reading the log back has to
cope with both.

**Proposal**:
The unmatched-delivery line in Capture Webhooks writes the intent id
first; the audit line should read the same way. I would state the order
in Refunds.

**Current**:
- Every capture and every refund appends a line to the payments audit
  log, carrying the payment intent id and the amount.

**Proposed Text**:
- Every capture and every refund appends a line to the payments audit
  log, writing the payment intent id first and the amount second.

**Resolution**: Pending
**Notes**:

---

### 3. Whether A Refund Can Be For Part Of An Order

**Source**: Specification analysis
**Category**: Gap/Ambiguity
**Move**: choice
**Priority**: Critical
**Affects**: Refunds

**Problem**:
A refund runs against the original payment intent for 30 days, and
nothing says whether it can be for part of the order. A customer
returning one item of three either gets that item's money back or has
to send the whole order back to get anything, and the specification
does not say which. Searched the specification end to end — Payment
Intent scopes what is created, Capture Webhooks scopes confirmation,
and Refunds decides the window and the intent and never the size; no
other rule in the document leans either way, and the premise that a
customer is charged the figure they confirmed governs what goes out,
not what comes back. The record ran out at the trade itself, which is
appetite: a customer left holding what they wanted to return, against a
refunded order whose total no longer reads off the one figure they were
charged.

**Options**:
- Refund the whole order or nothing — the refund always matches the figure the customer was charged, and a customer returning one item of three gets nothing back until the whole order goes back (recommended)
- Refund down to a single line item — the customer gets back exactly what they returned, and no refunded order reconciles against the captured figure any more, so a customer chasing one has to check it line by line

**Resolution**: Pending
**Notes**:

---

## Observations

- Refunds and Capture Webhooks both describe log lines; a reader
  meeting them in either order would not mind, but they could sit
  together.
```

The status block:

```
STATUS: findings
FINDINGS_COUNT: 3
SUMMARY: How long an order waits for capture confirmation is unstated; the audit line's field order is unstated; whether a refund can be for part of an order is genuinely open.
```
