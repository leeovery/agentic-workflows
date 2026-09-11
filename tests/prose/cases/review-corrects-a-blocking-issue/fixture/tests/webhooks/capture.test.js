// Webhook marks the order paid; duplicates are idempotent; an
// unknown intent is logged and ignored.
test('marks the order paid on capture webhook', () => {
  handleCaptureWebhook({ intentId: 'pi-1' });
  expect(orders.isPaid('pi-1')).toBe(true);
});
