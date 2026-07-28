'use strict';

// The epic exists with its shaping exploration on the log; the session
// that created it was never concluded, and no topics have been named.

const m = require('../../mainlines/epic.cjs');

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
  },
};
