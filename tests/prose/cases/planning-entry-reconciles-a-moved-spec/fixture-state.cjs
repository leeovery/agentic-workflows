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
    h.write(`.workflows/${m.WU}/specification/${m.WU}/specification.md`, [
      `# Specification — ${m.WU}`,
      '',
      '## Requirements',
      '',
      '- Checkout creates a payment intent against the existing gateway account.',
      '- Card payments only; wallet flows are out of scope for v1.',
      '- Capture is confirmed by gateway webhook, never by polling.',
      '- Refunds are issued through the gateway within 30 days of capture.',
      '',
      '## Out of scope',
      '',
      '- Wallet support (deferred by discussion).',
      '',
    ].join('\n'));
    h.engine('commit', m.WU, '-m', `spec(${m.WU}): add refund window after reopen`);
    h.engine('topic', 'complete', m.WU, 'specification', m.WU);
  },
};
