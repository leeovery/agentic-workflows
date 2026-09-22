'use strict';

// The harvested `search-relevance` epic with both discussions concluded,
// then `synonym-handling` postponed to a `v2` horizon the postpone itself
// created. That verb is the whole perturbation: the map row marked and
// its order stashed, the discussion item stashed and postponed, its
// chunks removed, the roadmap born holding one waiting item that records
// where it came from.

const e = require('../../mainlines/epic.cjs');

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);
    e.completeDiscussions(h);
    h.engine('topic', 'postpone', e.WU, 'synonym-handling', '--horizon', 'v2');
  },
};
