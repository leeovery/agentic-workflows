'use strict';

// A harvested epic and nothing else: the search-relevance map holds
// three topics with briefs, summaries, and descriptions, the session
// is closed (no active-session marker), and no per-phase work has
// begun. No topic carries an order — the first continue-epic visit is
// where sequencing genuinely happens.

const e = require('../../mainlines/epic.cjs');

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);
  },
};
