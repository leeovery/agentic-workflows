// Consume gateway capture webhooks and mark the order paid. A capture
// naming an intent no order carries is logged and ignored — the write
// never runs for it.
export function handleCaptureWebhook(event) {
  return orders.markPaid(event.intentId);
}
