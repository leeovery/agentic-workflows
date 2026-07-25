'use strict';

// Expected end state for the implementation-pickup walk: the environment
// question answered "none" (which the prose records so it is never asked
// again), implementation tracking initialised by `task init`, and the
// first task started. No task work done — the walk stops at the point the
// prose directs implementation to begin.

const m = require('../_shared/feature-mainline.cjs');

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
    m.discuss(h);
    m.specify(h);
    m.plan(h);

    // Prose order: resume detection (task init) and its commit first, then
    // environment setup records the answer so it is never asked again.
    h.engine('task', 'init', m.WU, m.WU);
    h.engine('commit', m.WU, '-m', `impl(${m.WU}): start implementation`);
    h.write('.workflows/.state/environment-setup.md', 'No special setup required.\n');
    h.engine('commit', '--workflows', '-m', `impl(${m.WU}): record environment setup`);
    h.engine('task', 'start', m.WU, m.WU, `${m.WU}-1-1`);
  },
};
