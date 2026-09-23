'use strict';

// The fixture plus the one thing the walk should have done: the decided
// synonym-handling topic postponed to a roadmap that did not exist,
// under the horizon the user named. One verb does all of it — the map
// row marked and its order stashed, the discussion item stashed and
// postponed, its chunks removed, the roadmap and its horizon born, the
// item recording where it came from and pointing at the topic's files.

const fixture = require('./fixture-state.cjs');
const e = require('../../mainlines/epic.cjs');

module.exports = {
  build(h) {
    fixture.build(h);
    h.engine('topic', 'postpone', e.WU, 'synonym-handling', '--horizon', 'v2');
  },
};
