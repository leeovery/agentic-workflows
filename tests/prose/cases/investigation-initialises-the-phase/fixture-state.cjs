'use strict';

// The same starting world as the entry case: the bug is captured and the
// investigation has not begun. This case is what happens next — the walk
// carries on past the handoff the entry case stops at.

const m = require('../../mainlines/bugfix.cjs');

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
  },
};
