'use strict';

// The harvested roadmap with everything waiting — the state the pull
// commits from.

const m = require('../../mainlines/roadmap.cjs');

module.exports = {
  build(h) {
    m.init(h);
    m.map(h);
  },
};
