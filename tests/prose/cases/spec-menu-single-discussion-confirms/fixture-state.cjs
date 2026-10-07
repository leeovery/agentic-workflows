'use strict';

// One concluded discussion and nothing grouped: the epic menu's
// specification row takes the single-discussion path, which picks nothing,
// so its own confirm stands before the grouping lands.

const e = require('../../mainlines/epic.cjs');
const WU = e.WU;

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);
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
      '### Decision',
      'Signal ingestion is a batch nightly aggregation job from the events',
      'pipeline into ranking features. Real-time streaming is rejected as',
      'over-engineering.',
      '',
    ].join('\n'));
    h.engine('discussion-map', 'add', WU, 'behavioural-ranking', 'signal-ingestion');
    h.engine('commit', WU, '-m', `discussion(${WU}): initialize behavioural-ranking discussion`);
    h.engine('discussion-map', 'set', WU, 'behavioural-ranking', 'signal-ingestion', 'decided');
    h.engine('topic', 'complete', WU, 'discussion', 'behavioural-ranking');
    h.engine('commit', WU, '-m', `discussion(${WU}): complete behavioural-ranking discussion`);

    h.write(`.workflows/${WU}/.state/discovery-gap-analysis.md`, [
      '# Discovery Gap Analysis Cache',
      '',
      '## Topics',
      '',
      '(none — the concluded discussion surfaced no new topics)',
      '',
    ].join('\n'));
    h.engine('cache', 'stamp', WU, 'gap-analysis');
    h.engine('commit', WU, '-m', `discovery(${WU}): stamp gap analysis`);
  },
};
