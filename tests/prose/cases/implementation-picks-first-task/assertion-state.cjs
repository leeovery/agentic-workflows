'use strict';

// The fixture state plus what the walk should have done: resume
// detection initialised tracking and committed the start of
// implementation, the environment answer was recorded so it is never
// asked again, and the first task was started. No task work — the walk
// stops where the prose hands over to building.

const fixture = require('./fixture-state.cjs');
const m = require('../../mainlines/feature.cjs');

module.exports = {
  build(h) {
    fixture.build(h);

    h.engine('task', 'init', m.WU, m.WU);
    h.engine('commit', m.WU, '-m', `impl(${m.WU}): start implementation`);
    h.write('.workflows/.state/environment-setup.md', 'No special setup required.\n');
    h.engine('commit', '--workflows', '-m', `impl(${m.WU}): record environment setup`);
    h.engine('task', 'start', m.WU, m.WU, `${m.WU}-1-1`);
  },
};
