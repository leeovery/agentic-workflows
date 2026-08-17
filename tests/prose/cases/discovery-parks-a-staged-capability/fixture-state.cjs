'use strict';

// The epic exists with its shaping exploration on the log and its first
// session still open; no roadmap exists yet — the park births it.

const m = require('../../mainlines/epic.cjs');

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
  },
};
