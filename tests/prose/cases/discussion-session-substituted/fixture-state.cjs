'use strict';

// A feature routed to discussion with nothing started — the discussion
// file does not exist, so initialisation runs for real.

const m = require('../../mainlines/feature.cjs');

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
  },
};
