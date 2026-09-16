'use strict';

// A harvested epic with its map sequenced and nothing started: three
// fresh topics, no per-phase item under any name. The epic menu must
// offer every one of them to cancel — the never-started topic
// included — and cancelling one marks the map row alone.

const e = require('../../mainlines/epic.cjs');
const WU = e.WU;

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);
    h.engine('discovery-map', 'sequence', WU,
      'behavioural-ranking=1', 'synonym-handling=2', 'relevance-measurement=3');
    h.engine('commit', WU, '-m', `discovery(${WU}): sequence the map`, '--discovery');
  },
};
