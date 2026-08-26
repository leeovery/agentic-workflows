'use strict';

// A research topic at the end of its own thread: metrics settled enough
// that the session is ready to wrap, no review ever run. The final review
// at conclusion is the one that fires, and the stubbed report returns a
// single route-laned finding whose ground none of the three map topics
// owns — so the delivery has to create the target before it can land.

const e = require('../../mainlines/epic.cjs');

const WU = e.WU;
const TOPIC = 'relevance-measurement';

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);

    h.engine('topic', 'start', WU, 'research', TOPIC);
    h.write(`.workflows/${WU}/research/${TOPIC}.md`, [
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
      'Two metrics answer two different questions, and the file needs',
      'both. NDCG@10 is the offline guard: rank-sensitive, standard, and',
      'comparable across runs, so a nightly job over a fixed query set',
      'catches a regression before anything ships.',
      '',
      'Interleaving win-rate is what settles a head-to-head. Mixing two',
      'rankings into one result list and reading which side earns the',
      'clicks removes the population differences that make small A/B',
      'differences unreadable, and the literature puts it at an order of',
      'magnitude fewer sessions than a split test for the same confidence.',
      'That is the method for deciding between two candidate rankings.',
      '',
      '## Judgment Collection',
      '',
      'Click-derived labels are free and plentiful; a small graded set',
      'guards regressions where clicks are too sparse to read. The hybrid',
      'is the pattern that keeps recurring for teams this size, and it is',
      'what the offline guard above assumes.',
      '',
      '## Open Questions',
      '',
      '- How large must an eval query set be before per-run comparisons',
      '  are trustworthy?',
      '',
    ].join('\n'));
    h.engine('commit', WU, '--topic', `research/${TOPIC}`, '-m',
      `research(${WU}/${TOPIC}): offline guard and head-to-head method`);
  },
};
