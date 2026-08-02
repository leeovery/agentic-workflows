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
