# stub: spec-gap-settled-and-session-call

A gap analysis agent returning two findings: one `settled` call the
specification's own record determines — two stated rules whose
consequence follows with no alternative — and one staged `settled` as
a call the record does not state: first principles over the capture
rules settle what the customer gets, the alternative that also fits
named beside it. An
Observations line sits below them. Write the tracking file to
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

### 2. An Order Whose Payment Is Never Confirmed

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
Capture is confirmed by gateway webhook, never by polling, and a
payment is unconfirmed once the re-deliveries are exhausted —
unconfirmed, not failed: the gateway has stopped telling us, it has not
told us the payment failed. Cancelling the order and showing the
payment-failed error would tell a customer who may well have paid that
they have not. So the order stands as awaiting confirmation and the
customer is told the payment is still confirming; the checkout cancels
nothing on its own initiative. Cancelling at the ceiling with the
payment-failed error Payment Intent defines for a rejection also fits
the record. I would state it in Capture Webhooks.

**Proposed Text**:
- When the re-deliveries are exhausted the order stands as awaiting
  confirmation and the customer is told the payment is still
  confirming; the checkout cancels nothing on its own initiative.

**Resolution**: Pending
**Notes**:

---

## Observations

- Capture Webhooks reads long now that the delivery schedule sits in
  it; sub-headings would carry it better.
```

The status block:

```
STATUS: findings
FINDINGS_COUNT: 2
SUMMARY: How long an order waits for capture confirmation is unstated, and so is what becomes of the order when that wait runs out.
```
