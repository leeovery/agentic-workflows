'use strict';

// The bugfix mainline stopped with the root cause documented and the Fix
// Direction section still pending — the state the process reaches just
// before its validation steps.

const m = require('../../mainlines/bugfix.cjs');

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
    m.investigateToRootCause(h);
  },
};
