'use strict';

// The feature exists and nothing has been started.

const m = require('../../mainlines/feature.cjs');

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
  },
};
