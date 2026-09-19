# stub: spec-gap-settled-and-confirmation-fork

A gap analysis agent returning two `settled` findings and nothing
else: one the specification's own record determines — two stated rules
whose consequence follows with no alternative — and one staged on an
analogy to a neighbouring rule over what the checkout tells a customer
while a capture is still confirming, a fork more than one answer fits
and each answer costs the customer something real. Write the tracking
file to
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

### 2. What The Checkout Tells A Customer While A Capture Is Confirming

**Source**: Specification analysis
**Category**: Gap/Ambiguity
**Move**: settled
**Priority**: Critical
**Affects**: Payment Intent

**Problem**:
Confirmation arrives by webhook after the customer has left the
gateway, and the specification never says what the checkout puts in
front of them in the meantime. So one build sends them to an order
confirmation and another to a payment-pending holding page. Either the
customer walks away believing they have bought something they may not
have, and hears otherwise by email hours later, or they walk away
unsure whether the money left their account and phone support to ask.

**Proposal**:
Payment Intent decides that a gateway rejection at creation surfaces as
a user-visible checkout error — the customer is told the state of
their payment rather than left to infer it. The same rule read forward
covers the wait: the checkout tells them the payment is still
confirming and the order is not yet paid. I would state it in Payment
Intent.

**Proposed Text**:
- Until the capture webhook lands, the checkout tells the customer the
  payment is still confirming and the order is not yet paid.

**Resolution**: Pending
**Notes**:

---
```

The status block:

```
STATUS: findings
FINDINGS_COUNT: 2
SUMMARY: How long an order waits for capture confirmation is unstated, and so is what the checkout tells a customer while the capture is still confirming.
```
