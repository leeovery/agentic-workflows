'use strict';

// The behavioural-ranking specification met a gap its record could not
// settle and routed it into its source: the concern sits in the
// behavioural-ranking discussion's triage queue, the discussion is back in
// progress, and the specification's source row is stale. The session
// committed its work and paused through the bridge, whose handoff lands the
// epic on its menu with the specification's pause. The gap analysis has
// been stamped over the discussions as they now stand, and the build order
// over the one specification, so the arrival runs no machine work before
// the banner.

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
    h.engine('manifest', 'set', `${WU}.specification.${TOPIC}`, `sources.${TOPIC}.status`, 'incorporated');
    h.write(`.workflows/${WU}/specification/${TOPIC}/specification.md`, [
      '# Specification: Behavioural Ranking',
      '',
      '## Specification',
      '',
      '### 1. Signal Ingestion',
      '',
      '- Click and purchase events reach ranking features through a',
      '  nightly batch aggregation job over the events pipeline.',
      '',
      '### 2. Ranking Features',
      '',
      '- The nightly job writes one behavioural score per catalogue item.',
      '',
    ].join('\n'));
    h.engine('commit', WU, '--topic', `specification/${TOPIC}`, '-m', `spec(${WU}): construct ${TOPIC}`);
    h.engine('build-order', 'sequence', WU, `${TOPIC}=1`);

    const concern = `.workflows/.cache/${WU}/specification/${TOPIC}/score-weighting.md`;
    h.write(concern, [
      '### Score weighting',
      `*From: ${TOPIC} · specification · 2026-01-01*`,
      '',
      'The specification needs the weighting between click-through and',
      'purchase rate in the behavioural score. The discussion decided how',
      'signals reach ranking and stopped there.',
      '',
    ].join('\n'));
    h.engine('topic', 'triage', WU, 'discussion', TOPIC, '--concern', concern, '--slug', 'score-weighting',
      '-m', `spec(${WU}): gap routed to ${TOPIC}`);
    h.engine('commit', WU, '--topic', `specification/${TOPIC}`, '-m', `spec(${WU}): pause — gap routed to ${TOPIC}`);

    h.engine('cache', 'stamp', WU, 'gap-analysis');
    h.engine('commit', WU, '-m', `discovery(${WU}): stamp gap analysis`);
  },
};
