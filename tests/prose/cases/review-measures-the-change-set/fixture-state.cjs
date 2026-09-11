'use strict';

// The feature is fully implemented; review has never run. The specification
// carries the numbered sections the change-set verification splits on, and
// one real defect rides in the delivered test file — the material the pass's
// finding names: the intent test asserts back the value it set itself. The
// project documents one test command, which is what lets the pass measure
// by the project's own way rather than an invented run.

const m = require('../../mainlines/feature.cjs');

module.exports = {
  build(h) {
    m.init(h);
    // The project's own conventions: the one documented test command. The
    // change-set verification runs only what the project documents, so
    // this is what makes its measurement legitimate. Not in any history
    // group, so it lands in the baseline, before the task commits.
    h.write('CLAUDE.md', [
      '# CLAUDE.md',
      '',
      '## Tests',
      '',
      'Tests run with jest. `npx jest <file>` runs one file — one file at a',
      'time is the way to confirm a single behaviour; `npx jest` runs the',
      'whole suite.',
      '',
    ].join('\n'));
    m.create(h);
    m.discuss(h);
    m.specify(h);
    // The specification in its canonical shape — numbered sections beneath
    // the heading, which is what the change-set verification derives its
    // split from. Not in any history group, so it lands in the baseline.
    h.write('.workflows/pay/specification/pay/specification.md', [
      '# Specification: Pay',
      '',
      '## Specification',
      '',
      '### 1. Payment Intent',
      '',
      '- Checkout creates a payment intent against the existing gateway account.',
      '- Card payments only; wallet flows are out of scope for v1.',
      '- A gateway rejection surfaces as a user-visible checkout error.',
      '- A duplicate checkout start reuses the existing intent.',
      '',
      '### 2. Capture',
      '',
      '- Capture is confirmed by gateway webhook, never by polling.',
      '- Duplicate deliveries are idempotent.',
      '',
    ].join('\n'));
    m.plan(h);
    m.implement(h);
    // Overwrite the delivered test with defect-bearing content. History
    // layering commits the snapshot's final bytes per declared group, so
    // this lands inside the task's impl commit like any real defect would.
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
