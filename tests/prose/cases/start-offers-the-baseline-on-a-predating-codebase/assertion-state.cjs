'use strict';

// The fixture, plus the decline the walk records — one confined write and
// commit, so the offer never repeats.

const fixture = require('./fixture-state.cjs');

module.exports = {
  build(h) {
    fixture.build(h);
    h.engine('baseline', 'record', 'skipped');
  },
};
