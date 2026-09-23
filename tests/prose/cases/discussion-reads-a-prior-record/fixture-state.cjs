'use strict';

// Two epics and one topic that moved between them. `search-relevance`
// concluded its synonym-handling discussion, then postponed the topic to
// a `v2` horizon; a concern behavioural-ranking had for that decision
// landed in its triage queue afterwards and waits there with it — mail
// for a topic that waits. A year on, `managed-search` pulls the waiting
// item forward, and the engine stamps `prior` on the new map row.
//
// Nothing crossed: the brief, the concluded discussion, and the queued
// concern are all still `search-relevance`'s, which is what makes the new
// topic's initialisation a read rather than an inheritance.

const e = require('../../mainlines/epic.cjs');

const NEXT = 'managed-search';

module.exports = {
  NEXT,
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
      'live click-signal stream at query time, keyed on',
      'reformulation-and-click pairs. Signal ingestion settled the',
      'opposite side of the same wire: the events pipeline exposes batch',
      'aggregates only, and no live signal stream will be built — a',
      'streaming layer was rejected as infrastructure for a benefit',
      'nobody could name.',
      '',
      'So the expansion decision rests on a capability that will not',
      'exist. Three shapes were weighed here before this was routed on.',
      '',
      '1. Expansion reads the nightly aggregates. A shopper who reformulates',
      '   today gets the benefit of it tomorrow; head terms are unaffected,',
      '   because their pair-counts are large and stable overnight. The cost',
      '   is a new term — a product launched this morning, a misspelling',
      '   that starts trending at lunchtime — going a day without',
      '   expansions.',
      '2. Expansion keeps its own in-session store, separate from ranking:',
      '   the reformulation-and-click pairs of the current session only,',
      '   held in the search tier. Fresh within the session, empty at the',
      '   start of one, and a second store to operate.',
      '3. Rejected here: build the streaming layer after all. It reverses a',
      '   decision made on its own merits, for one consumer.',
      '',
      'This session leans to the nightly aggregates: the freshness the',
      'expansion decision reached for has a named consumer now, but a day',
      'of lag on a brand-new term is a narrower cost than a second store',
      'in the search tier.',
      '',
      'What synonym handling needs to decide: what the expansion service',
      'actually reads. Not in scope here: behaviour-driven expansion',
      'itself, which is settled and not in question.',
      '',
    ].join('\n'));
    h.engine('topic', 'triage', e.WU, 'discussion', 'synonym-handling',
      '--concern', scratch, '--slug', 'stream-that-will-not-exist',
      '-m', `discussion(${e.WU}/behavioural-ranking): reroute concern to synonym-handling`);

    const log = `.workflows/${NEXT}/discovery/sessions/session-001.md`;
    h.write(log, [
      '# Discovery Session 001',
      '',
      'Date: 2026-01-01',
      `Work unit: ${NEXT}`,
      '',
      '## Description (as of session)',
      '',
      'Search for the managed search product.',
      '',
      '## Seed',
      '',
      '(none)',
      '',
      '## Imports',
      '',
      '(none)',
      '',
      '## Map State at Start',
      '',
      '(empty — first session)',
      '',
      '## Exploration',
      '',
      'The managed search product ships this year and the catalogue moves',
      'onto it. Query understanding is the part that does not come for',
      'free, and the expansion work parked a year ago belongs beside it.',
      '',
      '## Edits',
      '',
      '(none)',
      '',
      '## Topics Identified',
      '',
      '(none)',
      '',
      '## Conclusion',
      '',
      '(none)',
      '',
    ].join('\n'));
    h.engine('workunit', 'create', NEXT, 'epic',
      '--description', 'Search for the managed search product',
      '--session-log-file', log);
    h.engine('discovery-session', 'close', NEXT, '-m', `discovery(${NEXT}): close session 001`);

    h.engine('roadmap', 'pull-forward', 'synonym-handling', '--into', NEXT, '--routing', 'discussion');
  },
};
