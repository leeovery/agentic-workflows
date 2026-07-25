'use strict';

// The bug is captured and nothing has been started.

const m = require('../../mainlines/bugfix.cjs');

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
  },
};
