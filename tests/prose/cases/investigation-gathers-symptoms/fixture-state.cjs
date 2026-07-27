'use strict';

// The bug is captured and the investigation has not begun — the same
// starting world the initialisation case uses. This one carries on
// through the interview that follows.

const m = require('../../mainlines/bugfix.cjs');

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
  },
};
