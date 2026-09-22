'use strict';

// The fixture plus the one thing the walk should have done: the
// postponed topic pulled back into the epic that let it go. One verb
// again — the marker cleared, the discussion item's stash returned, its
// chunks re-indexed, the map order back in its old place, and the
// roadmap item joined to the epic with `postponed_from` dropped.

const fixture = require('./fixture-state.cjs');
const e = require('../../mainlines/epic.cjs');

module.exports = {
  build(h) {
    fixture.build(h);
    h.engine('roadmap', 'pull-forward', 'synonym-handling', '--into', e.WU);
  },
};
