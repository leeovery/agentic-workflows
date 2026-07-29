'use strict';

// The feature is fully implemented; review has never run. The walk
// carries the review to approval and across the pipeline continuation
// into the bridge, whose terminal arm completes the work unit.

const m = require('../../mainlines/feature.cjs');

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
    m.discuss(h);
    m.specify(h);
    m.plan(h);
    m.implement(h);
  },
};
