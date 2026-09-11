'use strict';

// A completed plan whose specification moved beneath it: the feature ran
// through planning, then the spec was reopened — the engine's staleness
// hop flags the plan `reconcile_needed: specification` — revised, and
// re-completed. The flag is live; the plan still reads completed.

const m = require('../../mainlines/feature.cjs');

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
    m.discuss(h);
    m.specify(h);
    m.plan(h);

    h.engine('topic', 'reopen', m.WU, 'specification', m.WU);
    h.write(`.workflows/${m.WU}/specification/${m.WU}/specification.md`, m.specification([
      ...m.SPEC_SECTIONS,
      { title: '3. Refunds', lines: ['- Refunds are issued through the gateway within 30 days of capture.'] },
    ]));
    h.engine('commit', m.WU, '-m', `spec(${m.WU}): add refund window after reopen`);
    h.engine('topic', 'complete', m.WU, 'specification', m.WU);
  },
};
