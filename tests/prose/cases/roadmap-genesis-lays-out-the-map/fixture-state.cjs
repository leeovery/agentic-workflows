'use strict';

// An empty project — what the walk makes of a staged product idea is the
// whole case.

const m = require('../../mainlines/roadmap.cjs');

module.exports = {
  build(h) {
    m.init(h);
  },
};
