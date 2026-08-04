'use strict';

// An epic topic mid-discussion whose review came back split across two
// lanes: one correction the document's own decision determines, and two
// concerns that belong to sibling topics. The walk clears the apply lane
// first, then sends the route batch — two triage landings, one call.

const e = require('../../mainlines/epic.cjs');

const WU = e.WU;

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);

    h.engine('discovery-map', 'reroute', WU, 'synonym-handling', 'discussion');
    h.engine('discovery-map', 'sequence', WU,
      'behavioural-ranking=1', 'synonym-handling=2', 'relevance-measurement=3');

    h.engine('topic', 'start', WU, 'discussion', 'behavioural-ranking');
    h.write(`.workflows/${WU}/discussion/behavioural-ranking.md`, [
      '# Discussion: Behavioural Ranking',
      '',
      '## Context',
      '',
      'Click and purchase events land in the events pipeline but nothing',
      'feeds them back into ranking. This discussion settles what signals',
      'feed the ranker and how they get there.',
      '',
      '---',
      '',
      '## Signal Ingestion',
      '',
      '### Context',
      'How click and purchase signals reach ranking features.',
      '',
      '### Options Considered',
      '',
      '**Batch nightly aggregation**',
      '- Pros: simple, replayable, fits the existing warehouse jobs',
      '- Cons: a day stale',
      '',
      '**Live event stream**',
      '- Pros: fresh within minutes',
      '- Cons: a new always-on consumer nobody owns yet',
      '',
      '### Journey',
      'The live stream was attractive until ownership came up — nobody',
      'owns an always-on consumer, and staleness turned out not to matter',
      'for ranking features that move slowly. Batch won on both counts,',
      'and the live stream was dropped rather than deferred.',
      '',
      '### Decision',
      'Signals reach ranking by nightly batch aggregation over the',
      'warehouse. Ingestion is batch-only; a live stream may be revisited',
      'if freshness ever becomes a ranking requirement.',
      '',
      '---',
      '',
      '## Summary',
      '',
      '### Current State',
      '- Signal ingestion decided — nightly batch, never a live stream.',
      '',
      '## Triage',
      '',
      '(none)',
      '',
    ].join('\n'));
    h.engine('discussion-map', 'add', WU, 'behavioural-ranking', 'signal-ingestion');
    h.engine('discussion-map', 'set', WU, 'behavioural-ranking', 'signal-ingestion', 'decided');
    h.engine('commit', WU, '--topic', 'discussion/behavioural-ranking',
      '-m', `discussion(${WU}/behavioural-ranking): signal ingestion decided`);

    h.engine('agent', 'dispatch', WU, 'discussion', 'behavioural-ranking', '--kind', 'review');
    h.write(`.workflows/.cache/${WU}/discussion/behavioural-ranking/review-001.md`, [
      '# Discussion Review — review-001',
      '',
      '## Summary',
      '',
      'One correction the document already determines, and three concerns',
      'whose home is a sibling topic.',
      '',
      '## Gaps Identified',
      '',
      '### F1: The Decision reopens a live stream the Journey dropped',
      '',
      '**Lane:** apply',
      '',
      'Signal Ingestion § Journey records the live stream was dropped',
      'rather than deferred. The Decision beneath it ends "a live stream',
      'may be revisited if freshness ever becomes a ranking requirement",',
      'which reopens what the Journey closed. Strike the clause.',
      '',
      '### F2: Query-time expansion needs signals this topic made batch-only',
      '',
      '**Lane:** route — synonym-handling',
      '',
      'Ingestion being batch-only bounds what any consumer of these signals',
      'can assume. Whether expansions can be derived from day-stale',
      'reformulation-and-click pairs is that topic\'s call, not this one\'s,',
      'but it inherits the constraint decided here.',
      '',
      '### F3: Nothing says how a ranking change is judged better or worse',
      '',
      '**Lane:** route — relevance-measurement',
      '',
      'This topic decides what feeds the ranker and stops there. Whether a',
      'change helped is the measurement topic\'s ground, and it has not',
      'started.',
      '',
      '### F4: synonym-handling owes a decision on expansion refresh cadence',
      '',
      '**Lane:** route — synonym-handling',
      '',
      'Ingestion being nightly bounds how fresh an expansion set can be. That',
      'topic must decide whether expansions refresh on the nightly cadence or',
      'hold until a full rebuild — a decision owed, with both options already',
      'on the table, not a question needing exploration.',
      '',
      '## Observations',
      '',
      '- The Options blocks would read faster as a table. Style only.',
      '',
      'STATUS: gaps_found',
      'FINDINGS: F1,F2,F3,F4',
      'GAPS_COUNT: 4',
      'QUESTIONS_COUNT: 0',
      'SUMMARY: One determined correction; three concerns owned by sibling topics.',
      '',
    ].join('\n'));
    h.engine('agent', 'scan', WU, 'discussion', 'behavioural-ranking');
    h.engine('agent', 'ack', WU, 'discussion', 'behavioural-ranking', 'review-001', '--findings', 'F1,F2,F3,F4');
    h.engine('agent', 'announce', WU, 'discussion', 'behavioural-ranking', 'review-001');
  },
};
