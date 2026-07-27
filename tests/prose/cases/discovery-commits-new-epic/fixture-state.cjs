'use strict';

// An empty project, exactly as the feature case starts. What the walk
// makes of it is the whole difference.

const m = require('../../mainlines/feature.cjs');

module.exports = {
  build(h) {
    m.init(h);
  },
};
