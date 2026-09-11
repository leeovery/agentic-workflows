'use strict';

// The feature is fully implemented; review has never run. One real defect
// rides in the delivered test file — the material the pass's finding names:
// the intent test asserts back the value it set itself. The project
// documents one test command, which is what lets the pass measure by the
// project's own way rather than an invented run.

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
