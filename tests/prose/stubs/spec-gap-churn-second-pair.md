# stub: spec-gap-churn-second-pair

A gap analysis agent's second cycle over the card-payments
specification: two more `settled` calls the document's own record
determines, both in Refunds — a section the first cycle's findings
never touched, and neither title shares ground with them. Write the
tracking file to
`.workflows/{work_unit}/specification/{topic}/review-gap-analysis-tracking-c2.md`
via the `.txt`-then-rename mechanism, with the content below, then
return the status block. Nothing else: no git activity, no other files.

---

The tracking file:

```markdown
# Review Tracking: Pay - Gap Analysis

## Findings

### 1. Which Refund Deadline The Checkout Enforces

**Source**: Specification analysis
**Category**: Gap/Ambiguity
**Move**: settled
**Priority**: Critical
**Affects**: Refunds

**Problem**:
Two deadlines sit in the same section — the product's 30 days from
capture and the gateway's 180 — and nothing says which one the checkout
enforces. A build wired to the gateway's allowance refunds a customer
on day 60 that another build refuses, and support has no way to tell a
customer which answer they will get.

**Proposal**:
The record fixes it: the specification's own rule is that refunds are
issued within 30 days of capture, and the gateway's 180 days is the
outer bound that rule sits inside — there is no reading in which the
checkout allows a refund its own rule forbids. I would state that the
30-day rule is the one enforced, and that the gateway's window is
merely wider.

**Proposed Text**:
- The checkout enforces its own 30-day window; the gateway's longer
  allowance never widens it.

**Resolution**: Pending
**Notes**:

---

### 2. Refunding An Order Before The Money Is Taken

**Source**: Specification analysis
**Category**: Gap/Ambiguity
**Move**: settled
**Priority**: Important
**Affects**: Refunds

**Problem**:
Support can reach an order before its capture is confirmed, and nothing
says what a refund does there. One build passes it to the gateway and
errors in front of whoever clicked it; another records a refund against
money that was never taken, so a customer is told their money is coming
back when nothing ever left.

**Proposal**:
The record fixes it: a refund runs against the original payment intent
and capture is confirmed only by the gateway's webhook, so an
unconfirmed payment has taken nothing to give back. The refund is
refused until capture is confirmed, and there is no other reading. I
would state it in Refunds.

**Proposed Text**:
- A refund is only available once capture is confirmed; until then
  there is nothing to refund and the order shows as awaiting
  confirmation.

**Resolution**: Pending
**Notes**:
```

The status block:

```
STATUS: findings
FINDINGS_COUNT: 2
SUMMARY: Which of the two refund deadlines the checkout enforces is unstated, and so is what a refund does on an order whose money has not been taken.
```
