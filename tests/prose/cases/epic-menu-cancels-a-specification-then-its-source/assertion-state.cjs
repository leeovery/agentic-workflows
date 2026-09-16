'use strict';

// The fixture plus the two cancels the walk should have run, in order:
// the specification unit first — the specification and its plan
// stashed and cancelled, the build-order number stashed, both source
// discussions untouched — then the freed synonym-handling topic, whose
// discussion stashes and cancels and whose map row takes the marker.
// behavioural-ranking moves nowhere.

const fixture = require('./fixture-state.cjs');
const e = require('../../mainlines/epic.cjs');

module.exports = {
  build(h) {
    fixture.build(h);
    h.engine('topic', 'cancel', e.WU, 'specification', 'expansion');
    h.engine('topic', 'cancel', e.WU, 'discovery', 'synonym-handling');
  },
};
