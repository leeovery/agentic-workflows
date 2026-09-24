'use strict';

// The fixture, plus the answer the walk records when the offer is taken —
// one confined write and commit, whatever the walk does after it.

const fixture = require('./fixture-state.cjs');

module.exports = {
  build(h) {
    fixture.build(h);
    h.engine('walkthrough', 'record', 'walked');
  },
};
