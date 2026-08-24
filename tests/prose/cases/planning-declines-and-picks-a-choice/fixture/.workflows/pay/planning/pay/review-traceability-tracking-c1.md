# Review Tracking: Pay - Traceability

## Findings

### 1. Failure Telemetry Duplicated Per Task

**Type**: Incomplete coverage
**Spec Reference**: Requirements — every checkout module emits payment telemetry at its boundary
**Plan Reference**: Phase 2 / Handle Capture Webhooks
**Move**: settled
**Change Type**: add-to-task

**Problem**:
A failed capture would land in the logs without the order id attached, so support cannot trace a customer complaint back to the failing order.

**Proposal**:
The telemetry decision already covers failures — I would add the order-id attribute to the capture task's telemetry line.

**Current**:
Consume gateway capture webhooks and mark the order paid.

**Proposed Text**:
Consume gateway capture webhooks and mark the order paid; emit capture telemetry carrying the order id.

**Resolution**: Pending
**Notes**:

---

### 2. Intent Retry Ownership Unassigned

**Type**: Incomplete coverage
**Spec Reference**: Requirements — checkout creates a payment intent against the existing gateway account
**Plan Reference**: Phase 1 / Attach Intent To Order
**Move**: choice
**Change Type**: update-task

**Problem**:
A retried checkout either reuses the stored intent or mints a fresh one, and the plan does not say which — two builders would ship two different checkouts.

**Options**:
- Reuse the stored intent id on retry — one intent per order, and an abandoned retry cannot strand a duplicate (recommended)
- Mint a fresh intent per attempt and void the prior — simpler retry code, and the gateway dashboard shows one intent per click

**Resolution**: Pending
**Notes**:
