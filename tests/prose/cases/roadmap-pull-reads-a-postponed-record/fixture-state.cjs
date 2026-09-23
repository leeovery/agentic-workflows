'use strict';

// A roadmap holding one item that used to be a topic and two that never
// were. `search-relevance` concluded its synonym-handling discussion and
// postponed the topic to `v2` — the postpone created the map and listed
// the topic's brief and discussion as the item's sources — and a concern
// behavioural-ranking had for that decision landed in its triage queue
// afterwards, where it still waits. Two capabilities were parked out of
// the same epic beside it, carrying its session log as their source.
//
// The queued concern is the point: no `sources` entry names it, so a
// pull that enumerates the record from `sources` alone never sees it.

const e = require('../../mainlines/epic.cjs');

const LOG = `${e.WU}/discovery/sessions/session-001.md`;

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);
    e.completeDiscussions(h);

    h.engine('topic', 'postpone', e.WU, 'synonym-handling', '--horizon', 'v2');

    const scratch = `.workflows/.cache/${e.WU}/discussion/behavioural-ranking/concern-stream-that-will-not-exist.md`;
    h.write(scratch, [
      '### Expansion reads a stream nobody will build',
      '*From: behavioural-ranking · discussion · 2026-01-08*',
      '',
      'Synonym handling settled that the expansion service consumes the',
      'live click-signal stream at query time. Signal ingestion settled',
      'the opposite side of the same wire: the events pipeline exposes',
      'batch aggregates only, and no live signal stream will be built.',
      'So the expansion decision rests on a capability that will not',
      'exist, and what the expansion service actually reads is a decision',
      'synonym handling still owes.',
      '',
    ].join('\n'));
    h.engine('topic', 'triage', e.WU, 'discussion', 'synonym-handling',
      '--concern', scratch, '--slug', 'stream-that-will-not-exist',
      '-m', `discussion(${e.WU}/behavioural-ranking): reroute concern to synonym-handling`);

    h.engine('roadmap', 'add', 'query-understanding',
      '--horizon', 'v2',
      '--summary', 'Understand what a shopper meant, not just what they typed',
      '--origin', `park:${e.WU}`, '--source', LOG);
    h.engine('roadmap', 'add', 'personalised-ranking',
      '--horizon', 'v3',
      '--summary', 'Rank on who is searching as well as what they searched for',
      '--origin', `park:${e.WU}`, '--source', LOG);
  },
};
