'use strict';

// The specification is complete; planning has not begun.

const m = require('../../mainlines/feature.cjs');

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
    m.discuss(h);
    m.specify(h);
  },
};
