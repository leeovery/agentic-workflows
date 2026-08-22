'use strict';

// The bugfix mainline stopped mid-analysis: the plan is agreed and the
// ledger is live, which is the state the resumed board renders from.

const m = require('../../mainlines/bugfix.cjs');

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
    m.investigateMidTrace(h);
  },
};
