'use strict';

// An empty project: the store is up and migrations have run, and nothing
// has ever been started. The walk creates the first work unit — of the
// type the user names at the shape gate, not the one it was started as.

const m = require('../../mainlines/feature.cjs');

module.exports = {
  build(h) {
    m.init(h);
  },
};
