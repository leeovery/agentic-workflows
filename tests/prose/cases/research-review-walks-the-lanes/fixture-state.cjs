'use strict';

// A research topic mid-flight — threads deepening, no review yet. The
// session that resumes it will document one more finding, which arms the
// dispatch trigger; the stubbed review returns one apply-laned correction
// and one explore-laned thread, so the walk exercises research's own lane
// declarations end to end from a live dispatch.

const e = require('../../mainlines/epic.cjs');

const WU = e.WU;

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);

    h.engine('topic', 'start', WU, 'research', 'relevance-measurement');
    h.write(`.workflows/${WU}/research/relevance-measurement.md`, [
      '# Research: Relevance Measurement',
      '',
      'How to tell whether a relevance change makes results better or',
      'worse. No evaluation set and no metrics exist — every ranking tweak',
      'is decided by argument.',
      '',
      '## Starting Point',
      '',
      'What we know so far:',
      '- Click and purchase events land reliably in the events pipeline.',
      '- The team has never built an evaluation harness.',
      '- Starting technical: candidate metrics, then how to collect',
      '  judgments.',
      '',
      '---',
      '',
      '## Candidate Metrics',
      '',
      'NDCG@10 is the leading candidate for the primary offline metric —',
      'rank-sensitive, standard, and comparable across runs. Click-through',
      'position as a cheap secondary signal.',
      '',
      'RankBench note (benchmark survey, 2025): click-derived relevance',
      'labels correlated 0.92 with human judgments at rank 10 across three',
      'commerce datasets — strong enough to stand in for graded judgments',
      'at the depth NDCG@10 reads.',
      '',
      '## Judgment Collection',
      '',
      'Graded judgments need human raters — a labelling pass over a query',
      'sample, refreshed as the catalogue moves. Sizing and cadence',
      'unexplored.',
      '',
      '## Open Questions',
      '',
      '- How large must an eval query set be before per-run comparisons',
      '  are trustworthy?',
      '',
    ].join('\n'));
    h.engine('commit', WU, '--topic', 'research/relevance-measurement',
      '-m', `research(${WU}/relevance-measurement): candidate metrics and judgment threads`);
  },
};
