'use strict';

// The investigation is open with its root cause documented, and no agent has run.

const m = require('../../mainlines/bugfix.cjs');

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
    m.investigateToRootCause(h);
  },
};
