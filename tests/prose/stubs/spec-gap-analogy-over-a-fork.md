# stub: spec-gap-analogy-over-a-fork

A gap analysis agent returning one finding and nothing else: a `settled`
call over what becomes of an order the gateway never confirms, whose
derivation is an analogy to the rejection rule in Payment Intent. Write
the tracking file to
`.workflows/{work_unit}/specification/{topic}/review-gap-analysis-tracking-c1.md`
via the `.txt`-then-rename mechanism, with the content below, then
return the status block. Nothing else: no git activity, no other files.

---

The tracking file:

```markdown
# Review Tracking: Pay - Gap Analysis

## Findings

### 1. An Order Whose Payment Is Never Confirmed

**Source**: Specification analysis
**Category**: Gap/Ambiguity
**Move**: settled
**Priority**: Critical
**Affects**: Capture Webhooks

**Problem**:
When the gateway's re-deliveries are exhausted with no confirmation,
the specification stops. The customer is left with an order on the
site and a pending line on their card statement, and nothing says
which of the two survives — so one build cancels the order and another
leaves it standing, and a customer who may well have paid cannot tell
from either whether their goods are coming.

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
FINDINGS_COUNT: 1
SUMMARY: Nothing says what becomes of an order whose payment the gateway never confirms.
```
