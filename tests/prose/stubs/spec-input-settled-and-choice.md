# stub: spec-input-settled-and-choice

An input review agent returning three findings across the two moves the
gate presents: two `settled` calls the sources determine, and one
`choice` the sources leave genuinely open. Write the tracking file to
`.workflows/{work_unit}/specification/{topic}/review-input-tracking-c1.md`
via the `.txt`-then-rename mechanism, with the content below, then
return the status block. Nothing else: no git activity, no other files.

---

The tracking file:

```markdown
# Review Tracking: Pay - Input Review

## Findings

### 1. Refund Window Missing

**Source**: discussion/pay.md · Refunds
**Category**: Enhancement to existing topic
**Move**: settled
**Affects**: Refunds

**Problem**:
The specification says refunds are supported but never says for how
long, so a customer refunded on day 40 and one refused on day 40 are
both defensible builds.

**Proposal**:
The discussion's Refunds decision fixes the window at 30 days from
capture. Carrying it across is not a new decision — I would state it in
the Refunds section.

**Current**:
- Refunds are issued against the original payment intent.

**Proposed Text**:
- Refunds are issued against the original payment intent, within 30
  days of capture.

**Resolution**: Pending
**Notes**:

---

### 2. Partial Refunds Unstated

**Source**: discussion/pay.md · Refunds
**Category**: Enhancement to existing topic
**Move**: settled
**Affects**: Refunds

**Problem**:
Nothing says whether a refund can be for part of the amount, so a
builder would guess — and a full-only implementation would have to be
torn out when the first partial refund is asked for.

**Proposal**:
The discussion decides partial refunds are supported, down to a single
line item. I would state that alongside the window.

**Current**:
- Refunds are issued against the original payment intent, within 30
  days of capture.

**Proposed Text**:
- Refunds are issued against the original payment intent, within 30
  days of capture, in full or per line item.

**Resolution**: Pending
**Notes**:

---

### 3. Failed-Webhook Retry Ceiling Open

**Source**: discussion/pay.md · Gateway Integration
**Category**: Gap/Ambiguity
**Move**: choice
**Affects**: Gateway Integration

**Problem**:
When the gateway's webhook delivery fails, nothing says how long the
checkout keeps waiting before it treats the payment as unconfirmed. A
customer whose bank is slow either gets their order or gets told the
payment failed, and the record does not decide which.

**Options**:
Give up after three delivery attempts and mark the payment unconfirmed
— fastest feedback, and a slow bank loses the order (recommended)
Keep accepting delivery for 24 hours and reconcile late confirmations —
no lost orders, and the checkout holds unresolved state for a day

**Resolution**: Pending
**Notes**:

---
```

The status block:

```
STATUS: findings
FINDINGS_COUNT: 3
SUMMARY: Two refund details the discussion decides and the spec omits; one genuinely open call on how long a failed webhook keeps retrying.
```
