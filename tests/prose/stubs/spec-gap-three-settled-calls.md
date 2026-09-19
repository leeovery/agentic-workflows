# stub: spec-gap-three-settled-calls

A gap analysis agent returning three `settled` findings and nothing
else: two the specification's own record determines — rules whose
consequence follows with no alternative — and one staged on an analogy
to a neighbouring rule over a fork in what the customer gets, which
more than one answer fits. Write the tracking file to
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

### 2. Refunding An Order Before The Money Is Taken

**Source**: Specification analysis
**Category**: Enhancement to existing topic
**Move**: settled
**Priority**: Important
**Affects**: Refunds

**Problem**:
Refunds are scoped by the intent and the 30-day window and by nothing
else, so a support agent can start a refund on an order whose capture
has never been confirmed. Either the gateway rejects it and the agent
is left guessing why, or the checkout books a credit against money it
never took.

**Proposal**:
The record fixes it: a refund runs against the original payment intent
and capture is confirmed only by the gateway's webhook, so an
unconfirmed payment has taken nothing to give back. The refund is
unavailable until capture is confirmed, and there is no other reading.
I would state it alongside the window in Refunds.

**Current**:
- Refunds are issued against the original payment intent, within 30
  days of capture.

**Proposed Text**:
- Refunds are issued against the original payment intent, within 30
  days of capture, and only once capture is confirmed — until then
  nothing has been taken to give back.

**Resolution**: Pending
**Notes**:

---

### 3. An Order Whose Payment Is Never Confirmed

**Source**: Specification analysis
**Category**: Gap/Ambiguity
**Move**: settled
**Priority**: Critical
**Affects**: Capture Webhooks

**Problem**:
When the wait runs out with no confirmation, the specification stops.
The customer is left with an order on the site and a pending line on
their card statement, and nothing says which of the two survives — so
one build cancels the order and another leaves it standing, and a
customer who may well have paid cannot tell from either whether their
goods are coming.

**Proposal**:
Payment Intent decides that a gateway rejection at creation surfaces as
a user-visible checkout error. An exhausted delivery is that same
failure arriving later, so by the same rule the order is cancelled and
the customer shown the checkout's payment-failed error. I would state
it in Capture Webhooks.

**Proposed Text**:
- When the re-deliveries are exhausted the order is cancelled and the
  customer is shown the checkout's payment-failed error.

**Resolution**: Pending
**Notes**:

---
```

The status block:

```
STATUS: findings
FINDINGS_COUNT: 3
SUMMARY: How long an order waits for capture confirmation is unstated, whether a refund can run before capture is confirmed is unstated, and so is what becomes of the order when the wait runs out.
```
