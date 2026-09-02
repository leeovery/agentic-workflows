'use strict';

// The fixture, plus the verdict the walk records: the project grew up on
// the workflows, written once and committed.

const fixture = require('./fixture-state.cjs');

module.exports = {
  build(h) {
    fixture.build(h);
    h.engine('manifest', 'set', 'project.baseline.status', 'native');
    h.engine('commit', '--workflows', '-m', 'baseline: the project grew up on the workflows');
  },
};
