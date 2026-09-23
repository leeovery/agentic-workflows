'use strict';

// The harvested `search-relevance` epic with both discussions concluded
// and the map sequenced. No specification groups them yet, no experiment
// is open, and the gap-analysis cache is stamped over the settled pair —
// so epic entry runs no machine work before the dashboard.
//
// The project has no roadmap at all: nothing has ever been parked or
// pulled. That is what makes the horizon a question asked in prose rather
// than a pick, and what makes the postpone create the map.

const e = require('../../mainlines/epic.cjs');

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);
    e.completeDiscussions(h);
  },
};
