'use strict';

// A topic that exists only as parked concerns: both sibling discussions
// concluded and each rerouted a measurement question into
// relevance-measurement, whose discussion item was created `triaged` by the
// deliveries — no artifact, no session, just a two-entry queue. The next
// session's entry is a first start where the queue is the whole agenda.

const e = require('../../mainlines/epic.cjs');

const WU = e.WU;

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);
    e.completeDiscussions(h);

    // The mainline's synonym-handling decision rests on the live
    // click-signal stream behavioural-ranking rejected — deliberate for
    // the coherence cases, a latent mine here: the consult surfaces it
    // mid-fold and the document-review safety net reroutes it, mutating
    // a sibling this case's claims hold still. Re-conclude the document
    // coherently (batch-computed expansion, Sibling check in place) so
    // the drain is the only thing this world exercises.
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
      'reformulation-and-click derivation is the part that matters.',
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
      '### Current State',
      '- Expansion source decided: behaviour-driven, computed from the',
      '  nightly batch aggregates, daily refresh.',
      '',
    ].join('\n'));
    h.engine('commit', WU, '-m',
      `discussion(${WU}/synonym-handling): correct expansion decision to batch-computed`);

    h.write(`.workflows/.cache/${WU}/discussion/behavioural-ranking/concern-offline-metrics-baseline.md`, [
      '### Offline Metrics Baseline',
      '*From: behavioural-ranking · discussion · 2026-01-02*',
      '',
      'Signal ingestion landed as batch nightly aggregation, which means',
      'ranking changes ship against day-old signals. Before any ranking',
      'change goes out we need an offline metrics baseline computed from',
      'those same batch aggregates — which metrics constitute it, and what',
      'movement against the baseline blocks a ship, are open decisions',
      'this topic owns.',
      '',
    ].join('\n'));
    h.engine('topic', 'triage', WU, 'discussion', 'relevance-measurement',
      '--concern', `.workflows/.cache/${WU}/discussion/behavioural-ranking/concern-offline-metrics-baseline.md`,
      '--slug', 'offline-metrics-baseline',
      '-m', `discussion(${WU}/behavioural-ranking): reroute concern to relevance-measurement`);

    h.write(`.workflows/.cache/${WU}/discussion/synonym-handling/concern-expansion-quality-tracking.md`, [
      '### Expansion Quality Tracking',
      '*From: synonym-handling · discussion · 2026-01-02*',
      '',
      'Synonym expansion is behaviour-driven, so its quality will drift as',
      'behaviour drifts. Something has to track expansion precision over',
      'time — what gets sampled, how precision is judged, and where the',
      'tracking lives are decisions for the measurement topic, not the',
      'expansion one.',
      '',
    ].join('\n'));
    h.engine('topic', 'triage', WU, 'discussion', 'relevance-measurement',
      '--concern', `.workflows/.cache/${WU}/discussion/synonym-handling/concern-expansion-quality-tracking.md`,
      '--slug', 'expansion-quality-tracking',
      '-m', `discussion(${WU}/synonym-handling): reroute concern to relevance-measurement`);
  },
};
