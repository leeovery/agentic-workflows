'use strict';

// An empty project: the store is up and migrations have run, and nothing
// has ever been started — the state the start menu's new-work rows open on.

const m = require('../../mainlines/feature.cjs');

module.exports = {
  build(h) {
    m.init(h);
  },
};
