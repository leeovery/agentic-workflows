'use strict';

// An empty project: the store is up and migrations have run, and nothing
// has ever been started. The walk itself creates the first work unit,
// which is the point of the case.

const m = require('../../mainlines/feature.cjs');

module.exports = {
  build(h) {
    m.init(h);
  },
};
