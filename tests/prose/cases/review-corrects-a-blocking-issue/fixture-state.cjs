'use strict';

// The feature is fully implemented; review has never run. Two real defects
// ride in the delivered source files — the material the review's findings
// name: payment-intent.js passes the order's own methods to the gateway, so
// card-only is not enforced; capture.js claims a capture for an unknown
// intent is ignored while the paid write runs for every delivery.

const m = require('../../mainlines/feature.cjs');

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
    m.discuss(h);
    m.specify(h);
    m.plan(h);
    m.implement(h);
    // Overwrite the delivered files with defect-bearing content. History
    // layering commits the snapshot's final bytes per declared group, so
    // these land inside the impl commits like any real defect would.
    h.write('src/checkout/payment-intent.js', [
      '// Create a gateway payment intent when checkout begins. Card-only',
      '// is enforced at creation; gateway rejection surfaces as a checkout',
      '// error and a duplicate start reuses the existing intent.',
      'export function createPaymentIntent(order) {',
      '  return gateway.intents.create({ order: order.id, methods: order.methods });',
      '}',
      '',
    ].join('\n'));
    h.write('src/webhooks/capture.js', [
      '// Consume gateway capture webhooks and mark the order paid. A capture',
      '// naming an intent no order carries is logged and ignored — the write',
      '// never runs for it.',
      'export function handleCaptureWebhook(event) {',
      '  return orders.markPaid(event.intentId);',
      '}',
      '',
    ].join('\n'));
    h.write('tests/webhooks/capture.test.js', [
      '// Webhook marks the order paid; duplicates are idempotent; an',
      '// unknown intent is logged and ignored.',
      "test('marks the order paid on capture webhook', () => {",
      "  handleCaptureWebhook({ intentId: 'pi-1' });",
      "  expect(orders.isPaid('pi-1')).toBe(true);",
      '});',
      '',
    ].join('\n'));
  },
};
