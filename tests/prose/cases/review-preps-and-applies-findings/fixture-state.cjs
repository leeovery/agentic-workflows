'use strict';

// The feature is fully implemented; review has never run. Two real defects
// ride in the delivered files — the material the review's findings name:
// capture.js claims a polling recovery path that exists nowhere, and the
// intent test asserts back the value it set itself.

const m = require('../../mainlines/feature.cjs');

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
    m.discuss(h);
    m.specify(h);
    m.plan(h);
    m.implement(h);
    // Overwrite two delivered files with defect-bearing content. History
    // layering commits the snapshot's final bytes per declared group, so
    // these land inside the impl commits like any real defect would.
    h.write('src/webhooks/capture.js', [
      '// Consume gateway capture webhooks and mark the order paid. If a',
      '// delivery goes missing we recover by polling the gateway on a',
      '// timer until the intent settles.',
      'export function handleCaptureWebhook(event) {',
      '  return orders.markPaid(event.intentId);',
      '}',
      '',
    ].join('\n'));
    h.write('tests/checkout/payment-intent.test.js', [
      '// Intent created on checkout start; card-only enforced; rejection',
      '// surfaces; duplicate start does not mint a second intent.',
      "test('creates a card-only intent on checkout start', () => {",
      "  const order = { id: 'ord-1' };",
      "  const intent = { order: order.id, methods: ['card'] };",
      "  expect(intent.methods).toEqual(['card']);",
      '});',
      '',
    ].join('\n'));
  },
};
