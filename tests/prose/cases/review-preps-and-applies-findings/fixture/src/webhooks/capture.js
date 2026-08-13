// Consume gateway capture webhooks and mark the order paid. There
// is no polling path; duplicate deliveries are idempotent.
export function handleCaptureWebhook(event) {
  return orders.markPaid(event.intentId);
}
