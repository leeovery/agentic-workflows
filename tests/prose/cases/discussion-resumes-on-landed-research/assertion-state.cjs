'use strict';

// The fixture plus the one thing the walk should have done: the reconcile
// flag consumed by the advisory once it found the research landed.
// Nothing else moves — the walk stops at the session's first turn.

const fixture = require('./fixture-state.cjs');
const e = require('../../mainlines/epic.cjs');

module.exports = {
  build(h) {
    fixture.build(h);
    h.engine('manifest', 'delete', `${e.WU}.discussion.behavioural-ranking`, 'reconcile_needed');
  },
};
