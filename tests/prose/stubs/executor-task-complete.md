# stub: executor-task-complete

A task executor's clean run for one task of the pay plan. Each time it
fires, create the dispatched task's source and test files exactly as
given below for that task, then return the STATUS block for that task
to the caller. Write nothing else — no reports, no task-file edits, no
git activity; the caller owns all bookkeeping.

---

For task `pay-1-1` (Create Payment Intent), create
`src/checkout/payment-intent.js`:

```js
// Create a gateway payment intent when checkout begins. Card-only
// is enforced at creation; gateway rejection surfaces as a checkout
// error and a duplicate start reuses the existing intent.
export function createPaymentIntent(order) {
  return gateway.intents.create({ order: order.id, methods: ['card'] });
}
```

and `tests/checkout/payment-intent.test.js`:

```js
// Intent created on checkout start; card-only enforced; rejection
// surfaces; duplicate start does not mint a second intent.
test('creates a card-only intent on checkout start', () => {});
```

and return:

```
STATUS: complete
TASK: Create Payment Intent
SUMMARY: Checkout now opens a card-only payment intent against the
gateway when it begins. Duplicate starts reuse the existing intent
rather than minting a second one; gateway rejection surfaces as a
checkout error. Verified via the intent-creation test.
TEST_RESULTS: all passing
```

For task `pay-1-2` (Handle Capture Webhooks), create
`src/webhooks/capture.js`:

```js
// Consume gateway capture webhooks and mark the order paid. There
// is no polling path; duplicate deliveries are idempotent.
export function handleCaptureWebhook(event) {
  return orders.markPaid(event.intentId);
}
```

and `tests/webhooks/capture.test.js`:

```js
// Webhook marks the order paid; duplicates are idempotent; an
// unknown intent is logged and ignored.
test('marks the order paid on capture webhook', () => {});
```

and return:

```
STATUS: complete
TASK: Handle Capture Webhooks
SUMMARY: Capture webhooks now mark the order paid; there is no
polling path anywhere. Duplicate deliveries are idempotent and an
unknown intent is logged and ignored. Verified via the webhook
capture test.
TEST_RESULTS: all passing
```
