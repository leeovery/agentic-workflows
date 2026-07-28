'use strict';

// The fixture plus the one thing the walk should have done: surfaced
// F2 — the last remaining finding, so the row incorporates
// automatically. Nothing else changes: the raise itself is
// conversation, not state.

const fixture = require('./fixture-state.cjs');
const m = require('../../mainlines/feature.cjs');

module.exports = {
  build(h) {
    fixture.build(h);
    h.engine('agent', 'surface', m.WU, 'discussion', m.WU, 'review-001', 'F2');
  },
};
