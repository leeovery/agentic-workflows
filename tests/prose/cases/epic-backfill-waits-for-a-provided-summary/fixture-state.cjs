'use strict';

// The harvested search-relevance epic plus a fourth topic that landed on
// the map without its summary or description — the backfill form, left
// for the next epic entry to draft — and whose discussion was started
// but never written to disk. Its source file is missing, so the backfill
// has nothing to draft from.

const e = require('../../mainlines/epic.cjs');

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);
    h.engine('discovery-map', 'add', e.WU, 'query-autocomplete', 'discussion', '--backfill');
    h.engine('topic', 'start', e.WU, 'discussion', 'query-autocomplete');
    h.engine('commit', e.WU, '-m', `discovery(${e.WU}): add query-autocomplete`, '--discovery');
  },
};
