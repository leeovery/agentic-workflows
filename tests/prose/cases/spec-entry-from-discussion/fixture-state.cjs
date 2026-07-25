'use strict';

// The discussion is complete; the specification has not begun.

const m = require('../../mainlines/feature.cjs');

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
    m.discuss(h);
  },
};
