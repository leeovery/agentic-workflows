'use strict';

// The feature's discussion is complete; the specification has not
// begun. The walk concludes the specification and crosses the
// pipeline continuation into the bridge's plan-mode handoff.

const m = require('../../mainlines/feature.cjs');

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
    m.discuss(h);
  },
};
