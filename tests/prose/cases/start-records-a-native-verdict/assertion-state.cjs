'use strict';

// The fixture, plus the verdict the walk records: the project grew up on
// the workflows — one confined write and commit.

const fixture = require('./fixture-state.cjs');

module.exports = {
  build(h) {
    fixture.build(h);
    h.engine('baseline', 'record', 'native');
  },
};
