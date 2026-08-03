'use strict';

// The fixture state plus what the walk should have done: the completed
// plan reopened for the session, and the reconcile flag consumed by the
// advisory. Nothing else moves — the walk stops at the handoff.

const fixture = require('./fixture-state.cjs');
const m = require('../../mainlines/feature.cjs');

module.exports = {
  build(h) {
    fixture.build(h);

    h.engine('topic', 'reopen', m.WU, 'planning', m.WU);
    h.engine('manifest', 'delete', `${m.WU}.planning.${m.WU}`, 'reconcile_needed');
  },
};
