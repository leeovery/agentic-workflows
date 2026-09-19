'use strict';

// An epic whose behavioural-ranking specification was constructed over
// the one discussion that settles the ground it stands on. The
// discussion decided how signals reach ranking — a nightly batch over
// the events pipeline, streaming rejected — and stopped there.
// Construction went one step further and wrote a combined behavioural
// score with a 30/70 weighting, which no source decides and no
// measurement can settle: the epic's relevance-measurement topic is
// still unexplored, so there is no evaluation set to test a weighting
// against. Review has not begun; the specification's source row reads
// incorporated and the item is in progress.

const e = require('../../mainlines/epic.cjs');

const WU = e.WU;
const TOPIC = 'behavioural-ranking';

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);
    e.completeDiscussions(h);

    h.engine('topic', 'start', WU, 'specification', TOPIC);
    h.engine('manifest', 'set', `${WU}.specification.${TOPIC}`,
      `sources.${TOPIC}.status=pending`,
      'review_cycle=0',
      'finding_gate_mode=gated',
      'construction_gate_mode=gated',
      'date=2026-01-01');
    h.write(`.workflows/${WU}/specification/${TOPIC}/specification.md`, [
      '# Specification: Behavioural Ranking',
      '',
      '## Specification',
      '',
      '### 1. Signal Ingestion',
      '',
      '- Click and purchase events reach ranking features through a',
      '  nightly batch aggregation job over the events pipeline.',
      '- Ranking never reads a live signal stream: the events pipeline',
      '  exposes batch aggregates only, and no streaming layer is built.',
      '',
      '### 2. Ranking Features',
      '',
      '- The nightly job writes one behavioural score per catalogue item.',
      '- The score combines click-through rate and purchase rate,',
      '  weighted 30/70 in favour of purchases.',
      '',
      '---',
      '',
      '## Working Notes',
      '',
    ].join('\n'));
    h.engine('manifest', 'set', `${WU}.specification.${TOPIC}`, `sources.${TOPIC}.status`, 'incorporated');
    h.engine('commit', WU, '-m', `spec(${WU}): construct ${TOPIC}`);
  },
};
