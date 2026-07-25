'use strict';

// The investigation is concluded; the specification has not begun.

const m = require('../../mainlines/bugfix.cjs');

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
    m.investigateToRootCause(h);
    m.concludeInvestigation(h);
  },
};
