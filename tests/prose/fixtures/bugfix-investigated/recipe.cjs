'use strict';

// Bugfix mainline stop point — see _shared/bugfix-mainline.cjs.

const m = require('../_shared/bugfix-mainline.cjs');

module.exports = {
  build(h) {
   m.init(h); m.create(h); m.investigateToRootCause(h); m.concludeInvestigation(h);
  },
};
