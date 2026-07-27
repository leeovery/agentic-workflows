'use strict';

// Feature mainline stop point — see _shared/feature-mainline.cjs.

const m = require('../_shared/feature-mainline.cjs');

module.exports = {
  build(h) {
    m.init(h); m.create(h); m.discuss(h); m.specify(h); m.plan(h);
  },
};
