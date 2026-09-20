'use strict';

// The feature exists and nothing has been started. The walkthrough answer
// is the harness's own pinned `skipped` — a recorded answer never
// re-offers, which is what puts this walk straight onto the start menu.

const m = require('../../mainlines/feature.cjs');

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
  },
};
