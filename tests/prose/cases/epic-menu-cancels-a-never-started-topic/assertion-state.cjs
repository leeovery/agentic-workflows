'use strict';

// The fixture plus the two things the walk should have done: the
// never-started topic cancelled — its map row marked, its order
// stashed — and reactivated, which clears the marker and returns the
// order. The round trip lands the fixture's world again; nothing else
// moves.

const fixture = require('./fixture-state.cjs');
const e = require('../../mainlines/epic.cjs');

module.exports = {
  build(h) {
    fixture.build(h);
    h.engine('topic', 'cancel', e.WU, 'discovery', 'relevance-measurement');
    h.engine('topic', 'reactivate', e.WU, 'discovery', 'relevance-measurement');
  },
};
