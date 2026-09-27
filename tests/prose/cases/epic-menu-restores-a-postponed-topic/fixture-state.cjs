'use strict';

// The harvested `search-relevance` epic with both discussions concluded,
// then `synonym-handling` postponed to a `v2` horizon the postpone itself
// created. That verb is the whole perturbation: the map row marked and
// its order stashed, the discussion item stashed and postponed, its
// chunks removed, the roadmap born holding one waiting item that records
// where it came from. The postpone takes its discussion out of the gap
// analysis's input, so the menu's next entry re-ran the analysis over what
// was left — a nothing-new pass, restamped — and this entry finds it fresh.

const e = require('../../mainlines/epic.cjs');

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);
    e.completeDiscussions(h);
    h.engine('topic', 'postpone', e.WU, 'synonym-handling', '--horizon', 'v2');
    h.engine('cache', 'stamp', e.WU, 'gap-analysis');
    h.engine('commit', e.WU, '-m', `discovery(${e.WU}): stamp gap analysis`);
  },
};
