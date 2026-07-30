'use strict';

// The cross-cutting concern's discussion is complete; the
// specification — its terminal phase — has not begun.

const cc = require('../../mainlines/crosscutting.cjs');

module.exports = {
  build(h) {
    cc.init(h);
    cc.create(h);
    cc.discuss(h);
  },
};
