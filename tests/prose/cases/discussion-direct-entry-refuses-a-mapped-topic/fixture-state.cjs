'use strict';

// A harvested, sequenced epic and nothing else: the search-relevance map
// holds three topics with briefs, summaries, descriptions, and an order,
// the session is closed, and no per-phase work has begun. Sequenced
// here so the continue-epic visit is a pure read — the walk should
// leave the world exactly as it found it.

const e = require('../../mainlines/epic.cjs');

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);
    h.engine('discovery-map', 'sequence', e.WU,
      'behavioural-ranking=1', 'synonym-handling=2', 'relevance-measurement=3');
  },
};
