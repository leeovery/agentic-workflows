'use strict';

// The misdirected-knowledge world: behavioural-ranking concluded in an
// earlier sitting (batch nightly aggregation, click and purchase
// counts, no live stream). Synonym-handling's session then decided its
// expansion source against that batch-only world — but instead of
// rerouting the correction it owes the sibling (the aggregation job
// must also emit reformulation-and-click *pair* aggregates), the
// session stranded it as a carry-note in Summary → Open Threads and
// walked away without concluding. The next session opens cold to wrap
// up; document review must catch the note and route it through triage.

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
      'The events pipeline reliably captures clicks and purchases. The open',
      'question was how those signals reach ranking features.',
      '',
      '### Options Considered',
      '',
      '**Batch nightly aggregation**',
      '- Pros: simple, replayable, fits the existing warehouse jobs',
      '- Cons: signals lag up to a day',
      '',
      '**Real-time streaming**',
      '- Pros: fresh signals',
      '- Cons: new infrastructure and operational burden nobody has asked for',
      '',
      '### Journey',
      'We started assuming fresher is better, then worked through what any',
      'consumer actually does with sub-day freshness — nothing today. A',
      'streaming layer would be new infrastructure for a benefit nobody',
      'could name, so we rejected it as over-engineering.',
      '',
      '### Decision',
      'Signal ingestion is a batch nightly aggregation job from the events',
      'pipeline into ranking features, aggregating click and purchase',
      'counts. Real-time streaming is rejected as over-engineering — the',
      'events pipeline exposes batch aggregates only, and no live signal',
      'stream will be built.',
      '',
      '---',
      '',
      '## Summary',
      '',
      '### Key Insights',
      '1. Freshness has no consumer today — batch wins on simplicity.',
      '',
      '### Current State',
      '- Signal ingestion decided: batch nightly aggregation, no streaming.',
      '',
    ].join('\n'));
    h.engine('discussion-map', 'add', WU, 'behavioural-ranking', 'signal-ingestion');
    h.engine('commit', WU, '-m', `discussion(${WU}): initialize behavioural-ranking discussion`);
    h.engine('discussion-map', 'set', WU, 'behavioural-ranking', 'signal-ingestion', 'decided');
    h.engine('topic', 'complete', WU, 'discussion', 'behavioural-ranking');
    h.engine('commit', WU, '-m', `discussion(${WU}): complete behavioural-ranking discussion`);

    h.engine('topic', 'start', WU, 'discussion', 'synonym-handling');
    h.write(`.workflows/${WU}/discussion/synonym-handling.md`, [
      '# Discussion: Synonym Handling',
      '',
      '## Context',
      '',
      'The hand-maintained synonym and misspelling list is untrusted, and',
      'replace-rather-than-clean was settled at shaping. This discussion',
      'settles what replaces it.',
      '',
      '---',
      '',
      '## Expansion Source',
      '',
      '### Context',
      'If the list goes, something has to produce expansions at query time.',
      '',
      '### Options Considered',
      '',
      '**Curated replacement list (managed service)**',
      '- Pros: known shape, quick to adopt',
      '- Cons: recreates the upkeep problem that killed the current list',
      '',
      '**Behaviour-driven expansion**',
      '- Pros: learns from what users actually click after reformulating',
      '- Cons: needs behavioural signals available to the expansion service',
      '',
      '### Journey',
      'A managed list just moves the upkeep somewhere else. Deriving',
      'expansions from reformulation-and-click pairs kept winning on both',
      'upkeep and quality. Signal ingestion is batch-only per',
      'behavioural-ranking, and daily refresh is fine — the',
      'reformulation-and-click derivation is the part that matters. That',
      'does mean the nightly job has to expose the pairs themselves, which',
      'its decided schema (click and purchase counts) does not.',
      '',
      '### Decision',
      'Sibling check: behavioural-ranking — signal ingestion is a batch',
      'nightly aggregation job; no live stream will be built. Synonym',
      'expansion is behaviour-driven, computed from the nightly batch',
      'aggregates: expansions derive from reformulation-and-click pairs',
      'and refresh daily. The hand-maintained list is retired once',
      'behavioural coverage matches it.',
      '',
      '---',
      '',
      '## Summary',
      '',
      '### Key Insights',
      '1. Any curated list recreates the upkeep problem — derive',
      '   expansions from behaviour instead.',
      '2. Daily refresh suffices; the pair derivation is what matters.',
      '',
      '### Open Threads',
      '- Cross-topic note to carry → behavioural-ranking: expansion needs',
      '  the nightly aggregation job to also emit reformulation-and-click',
      '  pair aggregates — its decided schema covers click and purchase',
      '  counts only, so the aggregation schema decision needs extending.',
      '',
      '### Current State',
      '- Expansion source decided: behaviour-driven, computed from the',
      '  nightly batch aggregates, daily refresh.',
      '',
    ].join('\n'));
    h.engine('discussion-map', 'add', WU, 'synonym-handling', 'expansion-source');
    h.engine('commit', WU, '-m', `discussion(${WU}): initialize synonym-handling discussion`);
    h.engine('discussion-map', 'set', WU, 'synonym-handling', 'expansion-source', 'decided');
    h.engine('commit', WU, '-m', `discussion(${WU}/synonym-handling): document expansion source decision`);
  },
};
