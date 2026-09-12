# Review Tracking: Pay - Traceability

## Findings

### 1. Duplicate Delivery Idempotency Absent From Capture Task

**Type**: Incomplete coverage
**Spec Reference**: Capture Webhooks — duplicate deliveries are idempotent
**Plan Reference**: Phase 2 / Handle Capture Webhooks
**Move**: settled
**Change Type**: add-to-task

**Problem**:
A gateway that redelivers a capture would have the consumer act on it twice — the same order marked paid a second time, and anything hung off that transition run again — because the capture task never says a repeat delivery changes nothing.

**Proposal**:
The specification's Capture Webhooks section decides it: duplicate deliveries are idempotent. Carrying that into the capture task is not a new decision — I would state it in the task.

**Current**:
Consume gateway capture webhooks and mark the order paid; no polling path.

**Proposed Text**:
Consume gateway capture webhooks and mark the order paid; no polling path. A repeat delivery of a capture already applied changes nothing.

**Resolution**: Pending
**Notes**:

---

### 2. What The Customer Sees While Capture Is Pending

**Type**: Incomplete coverage
**Spec Reference**: Capture Webhooks — capture is confirmed by gateway webhook, never by polling
**Plan Reference**: Phase 2 / Handle Capture Webhooks
**Move**: choice
**Change Type**: add-to-task

**Problem**:
Because capture is confirmed only when the gateway's webhook lands, a customer who presses pay cannot be told the truth in that instant — and the plan never says what they are told. One builder shows the order as confirmed on the spot and takes it back if capture fails; another holds the customer on a pending page until the webhook arrives. Searched the specification end to end — its Payment Intent section (an intent on checkout start, card-only, a gateway rejection surfacing as a checkout error, a duplicate start reusing the intent) and its Capture Webhooks section (webhook-confirmed, idempotent deliveries, an unknown intent logged and ignored) — the discussion's three decisions and its deferred wallet support, and the plan's own phases: the rejection error is the one customer-facing moment the plan names, and it covers a rejected intent, not a pending capture; no measurement in this tree pins how long the gateway takes to deliver. The record ran out at the trade itself: a customer told they have paid who may later be told otherwise, against a customer left waiting with no confirmation.

**Options**:
- Confirm the order to the customer the moment they pay, and tell them afterwards if capture fails — the customer leaves with a confirmation in hand, and a customer whose capture fails learns that an order they were told was paid is not (recommended)
- Hold the customer on a payment-pending page until the capture webhook lands — no customer is ever told something later taken back, and a customer whose bank is slow waits with no confirmation and may abandon the order

**Resolution**: Pending
**Notes**:
