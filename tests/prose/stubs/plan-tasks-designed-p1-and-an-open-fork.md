# stub: plan-tasks-designed-p1-and-an-open-fork

A task-designer agent's return for Phase 1 of the pay plan: the same
short overview and two-task table `plan-tasks-designed-p1` carries,
closed by a `## Spec Defects` section reporting one omission the record
does not settle — what the shopper is shown between submitting checkout
and the capture webhook arriving. The Ground names the search and comes
up empty. The content below is what the agent returns.

---

Phase 1 breaks into two tasks: creating the payment intent when
checkout begins, and attaching it to the order so later capture can
find it.

| Task | Summary | Edge cases |
|------|---------|------------|
| Create Payment Intent | Create a gateway payment intent when checkout begins, card-only enforced. | Gateway rejects the intent; duplicate checkout start |
| Attach Intent To Order | Persist the intent id on the order for later capture confirmation. | Order abandoned before payment; intent id missing on retry |

## Spec Defects

### S1: What the shopper is shown while capture is unconfirmed is never decided
- **Omission**: Payment Intent decides that checkout creates an intent and that a gateway rejection at creation surfaces as a user-visible checkout error; Capture Webhooks decides that capture is confirmed out of band and never polled. Between the two, the specification never says what the shopper is shown once checkout submits and before the capture webhook arrives.
- **Consequence**: The implementer picks one. Show an order-confirmed page and a shopper whose capture later fails has already been told their order stands; show a payment-pending page and a shopper whose capture confirms in under a second is parked on a screen that resolves behind them. Either way a shopper meets a state nobody chose.
- **Ground**: none found — searched: Payment Intent, Capture Webhooks, the checkout-error rule, the discussion's Gateway Integration decision and its Summary. The record decides that confirmation is asynchronous and never polled; it decides nothing about what the shopper meets in the window that creates.
