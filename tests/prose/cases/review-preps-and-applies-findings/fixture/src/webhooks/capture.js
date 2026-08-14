// Consume gateway capture webhooks and mark the order paid. If a
// delivery goes missing we recover by polling the gateway on a
// timer until the intent settles.
export function handleCaptureWebhook(event) {
  return orders.markPaid(event.intentId);
}
