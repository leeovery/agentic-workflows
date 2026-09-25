'use strict';

// A live epic discussion standing on completed research, nothing moved
// beneath it. The map is harvested and behavioural-ranking rerouted to
// research; its research concluded first — signal availability and per-query density — and its
// discussion is mid-flight with both of its points decided and written
// up, the weighting decision a purchase-weighted per-query blend. No
// flag, no wait: the peer's re-landing happens during the walk, through
// an armed substitution.

const e = require('../../mainlines/epic.cjs');

const WU = e.WU;
const TOPIC = 'behavioural-ranking';

module.exports = {
  WU,
  TOPIC,
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);

    // Research first: the map routes the topic to research, the research
    // runs and lands, then the discussion is born on top of it.
    h.engine('discovery-map', 'reroute', WU, TOPIC, 'research');
    h.engine('topic', 'start', WU, 'research', TOPIC);
    h.write(`.workflows/${WU}/research/${TOPIC}.md`, [
      '# Research: Behavioural Ranking',
      '',
      'What behavioural signal the events pipeline carries, and how dense it',
      'is per query — the ground the ranking discussion stands on.',
      '',
      '## Starting Point',
      '',
      'What we know so far:',
      '- Click and purchase events land in the events pipeline; the pipeline',
      '  is reliable and exposes batch aggregates nightly.',
      '- Nothing feeds those signals back into ranking today.',
      '',
      '## Signal Availability',
      '',
      'Clicks and purchases are captured per session with the query that',
      'produced them. The pipeline exposes nightly batch aggregates only — no',
      'live stream exists, and none is planned.',
      '',
      '## Per-Query Signal Density',
      '',
      'Queried the events warehouse for the click and purchase distribution',
      'per distinct query over the last thirty days. Findings:',
      '- 4% of distinct queries account for 71% of all clicks; the median',
      '  query collects two clicks in the window.',
      '- Purchases are sparser still: 11% of distinct queries see any',
      '  purchase in thirty days.',
      '',
      '## Carried into discussion',
      '',
      '- How signals reach ranking — batch aggregation, or a stream the',
      '  pipeline does not offer.',
      '- How much each signal counts for, given how sparse purchases are.',
      '',
    ].join('\n'));
    h.engine('commit', WU, '--topic', `research/${TOPIC}`, '-m',
      `research(${WU}/${TOPIC}): signal availability and density`);
    h.engine('topic', 'complete', WU, 'research', TOPIC);
    h.engine('commit', WU, '--topic', `research/${TOPIC}`, '-m',
      `research(${WU}): complete ${TOPIC} research`);

    h.engine('topic', 'start', WU, 'discussion', TOPIC);
    h.write(`.workflows/${WU}/discussion/${TOPIC}.md`, [
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
      'pipeline into ranking features. Real-time streaming is rejected as',
      'over-engineering.',
      '',
      '---',
      '',
      '## Signal Weighting',
      '',
      '### Context',
      'Once clicks and purchases reach the ranker as per-query aggregates,',
      'how much should each count for?',
      '',
      '### Options Considered',
      '',
      '**Purchases only**',
      '- Pros: the strongest intent signal, hard to game',
      '- Cons: sparse — most queries see no purchase in a month',
      '',
      '**Clicks and purchases, purchase-weighted**',
      '- Pros: coverage from clicks, conviction from purchases',
      '- Cons: click position bias leaks into the feature',
      '',
      '### Journey',
      'Purchases alone would leave most queries without a signal at all.',
      'Blending them, with a purchase counting for several clicks, keeps',
      'coverage while letting conviction dominate where it exists. Position',
      'bias is a known correction the aggregation job can apply.',
      '',
      '### Decision',
      'The ranking feature blends clicks and purchases per query, a purchase',
      'weighted as five clicks, with a position-bias correction applied in',
      'the nightly job.',
      '',
      '---',
      '',
      '## Summary',
      '',
      '### Key Insights',
      '1. Freshness has no consumer today — batch wins on simplicity.',
      '2. Purchases carry conviction, clicks carry coverage; the blend keeps',
      '   both.',
      '',
      '### Current State',
      '- Signal ingestion decided: batch nightly aggregation, no streaming.',
      '- Signal weighting decided: purchase-weighted blend with position-bias',
      '  correction.',
      '',
    ].join('\n'));
    h.engine('discussion-map', 'add', WU, TOPIC, 'signal-ingestion');
    h.engine('discussion-map', 'set', WU, TOPIC, 'signal-ingestion', 'decided');
    h.engine('discussion-map', 'add', WU, TOPIC, 'signal-weighting');
    h.engine('discussion-map', 'set', WU, TOPIC, 'signal-weighting', 'decided');
    h.engine('commit', WU, '--topic', `discussion/${TOPIC}`, '-m',
      `discussion(${WU}/${TOPIC}): signal ingestion and weighting decided`);
  },
};
