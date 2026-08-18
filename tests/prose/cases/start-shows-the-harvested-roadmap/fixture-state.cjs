'use strict';

// The harvested roadmap with zero work units — the state the empty
// screen must never claim is empty.

const m = require('../../mainlines/roadmap.cjs');

module.exports = {
  build(h) {
    m.init(h);
    m.map(h);
  },
};
