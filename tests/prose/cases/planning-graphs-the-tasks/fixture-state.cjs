'use strict';

// The plan is authored through construction; graph, review, and
// conclusion have not run.

const m = require('../../mainlines/feature.cjs');

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
    m.discuss(h);
    m.specify(h);
    m.planAuthored(h);
  },
};
