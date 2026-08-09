# Review Tracking: Pay - Traceability

## Findings

### 1. Polling Path Not Excluded

**Type**: Incomplete coverage
**Spec Reference**: Requirements — capture is confirmed by gateway webhook, never by polling
**Plan Reference**: Phase 2 / Handle Capture Webhooks
**Change Type**: update-task

**Details**:
The task consumed capture webhooks but never stated that no polling path may exist, leaving the spec's never-poll constraint untraceable.

**Current**:
Consume gateway capture webhooks and mark the order paid.

**Proposed**:
Consume gateway capture webhooks and mark the order paid; no polling path.

**Resolution**: Fixed
**Notes**: Applied to pay-2-1.

---

### 2. Intent Reuse On Retry Unstated

**Type**: Incomplete coverage
**Spec Reference**: Requirements — checkout creates a payment intent against the existing gateway account
**Plan Reference**: Phase 1 / Attach Intent To Order
**Change Type**: update-task

**Details**:
The task persists the intent id but never says a retried checkout must reuse it — the duplicate-start edge the spec's intent model requires.

**Current**:
Persist the intent id on the order for later capture confirmation.

**Proposed**:
Persist the intent id on the order for later capture confirmation; a retried checkout reuses the stored intent id.

**Resolution**: Pending
**Notes**:
