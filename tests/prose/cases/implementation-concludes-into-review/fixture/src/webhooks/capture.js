// Consume gateway capture webhooks and mark the order paid.
export function handleCaptureWebhook(event) {
  return orders.markPaid(event.intentId);
}
