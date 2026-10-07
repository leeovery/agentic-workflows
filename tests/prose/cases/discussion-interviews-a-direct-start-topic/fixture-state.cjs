'use strict';

// A harvested, sequenced epic, and the fourth map row the epic menu's d
// door lands before its handoff: query-intent, routed to discussion,
// source direct-start, a summary and description drawn from the name
// alone, and no brief. The door commits nothing — the row rides the
// topic's first commit — so the manifest is declared dirt over the
// version the harvest left committed.

const fs = require('fs');
const path = require('path');
const e = require('../../mainlines/epic.cjs');

const MANIFEST = `.workflows/${e.WU}/manifest.json`;

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);
    h.engine('discovery-map', 'sequence', e.WU,
      'behavioural-ranking=1', 'synonym-handling=2', 'relevance-measurement=3');

    const committed = fs.readFileSync(path.join(h.dir, MANIFEST), 'utf8');
    h.engine('discovery-map', 'add', e.WU, 'query-intent', 'discussion',
      '--source', 'direct-start',
      '--summary', 'Work out what a shopper means by a query before search answers it.',
      '--description', 'The intent behind a search query — what kind of thing the shopper is asking for — so search can respond to that rather than matching keywords.',
      '--force-dismissed');
    h.write('.world-dirt.json', JSON.stringify([{ path: MANIFEST, committed }], null, 2));
  },
};
