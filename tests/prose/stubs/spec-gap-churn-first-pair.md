# stub: spec-gap-churn-first-pair

A gap analysis agent's first cycle over the card-payments
specification: two `settled` calls the document's own record
determines, one in Gateway Integration and one in Checkout Session.
Write the tracking file to
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
**Affects**: Gateway Integration

**Problem**:
The specification says when the gateway's re-deliveries land and it
says a payment is unconfirmed once they are exhausted, but it never
says how long the order waits. A builder picking their own timeout —
five minutes is the obvious guess — closes the order while the
gateway's last re-delivery is still to come, so a customer whose bank
was slow has the money taken and no order to show for it.

**Proposal**:
The record fixes it with no room left over: the last re-delivery lands
25 minutes after the first attempt, and the payment is unconfirmed once
the re-deliveries are exhausted — so the wait is 25 minutes from the
first attempt, and no other window is consistent with both rules. I
would state it in Gateway Integration.

**Proposed Text**:
- An order waits for capture confirmation until the gateway's
  re-deliveries are exhausted — 25 minutes from the first delivery
  attempt.

**Resolution**: Pending
**Notes**:

---

### 2. How Long A Quoted Total Stands

**Source**: Specification analysis
**Category**: Gap/Ambiguity
**Move**: settled
**Priority**: Important
**Affects**: Checkout Session

**Problem**:
The payment step quotes the total when it opens and captures exactly
that amount, and the specification never says when that figure stops
standing. A build that holds the quote past the session it came from
charges a customer a total computed against shipping and tax rates that
have since moved, from a page they returned to hours later.

**Proposal**:
The record fixes it: the quote is taken inside a checkout session, the
session expires 30 minutes after it opens, and an expired session
returns the customer to their cart — so a quote cannot outlive the
session that produced it, and there is no other reading. I would state
it in Checkout Session.

**Proposed Text**:
- A quoted total stands for the life of the checkout session that
  produced it; when the session expires the quote goes with it, and the
  next session quotes again.

**Resolution**: Pending
**Notes**:
```

The status block:

```
STATUS: findings
FINDINGS_COUNT: 2
SUMMARY: How long an order waits for capture confirmation is unstated, and so is how long a quoted total stands.
```
