'use strict';

// The quick-fix is captured and its definition stage has not begun.

const m = require('../../mainlines/quickfix.cjs');

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
  },
};
