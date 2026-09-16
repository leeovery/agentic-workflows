// Consume gateway capture webhooks and mark the order paid.
// Duplicate deliveries are idempotent.
export function handleCaptureWebhook(event) {
  return orders.markPaid(event.intentId);
}
