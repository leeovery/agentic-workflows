'use strict';

// A live epic discussion whose research moved beneath it and has since
// landed. The map is harvested; behavioural-ranking's discussion is
// mid-flight with both of its points decided and written up. A peer
// session working relevance-measurement's research rerouted an empirical
// question that is behavioural-ranking's ground — per-query signal
// density in the events warehouse — research-side: the delivery parked
// the research as a triaged stub and flagged the in-progress discussion
// `reconcile_needed: research`. A research session then started from the
// stub, measured the warehouse, folded the concern, and concluded. The
// flag is still on the discussion: nothing has read the landed research
// into it.

const e = require('../../mainlines/epic.cjs');

const WU = e.WU;
const TOPIC = 'behavioural-ranking';

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);

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
      '## Triage',
      '',
      '(none)',
      '',
    ].join('\n'));
    h.engine('discussion-map', 'add', WU, TOPIC, 'signal-ingestion');
    h.engine('discussion-map', 'set', WU, TOPIC, 'signal-ingestion', 'decided');
    h.engine('discussion-map', 'add', WU, TOPIC, 'signal-weighting');
    h.engine('discussion-map', 'set', WU, TOPIC, 'signal-weighting', 'decided');
    h.engine('commit', WU, '--topic', `discussion/${TOPIC}`, '-m',
      `discussion(${WU}/${TOPIC}): signal ingestion and weighting decided`);

    // The peer's delivery — research-side, from relevance-measurement's
    // research session: the engine parks the stub, flags the discussion,
    // installs the concern, and commits.
    const scratch = `.workflows/.cache/${WU}/research/relevance-measurement/concern-signal-density.md`;
    h.write(scratch, [
      '### How dense is the behavioural signal per query?',
      '*From: relevance-measurement · research · 2026-01-01*',
      '',
      'Sizing an evaluation set against the events warehouse showed most',
      'queries collecting only a handful of clicks in a thirty-day window,',
      'and purchases far fewer. Behavioural ranking\'s weighting rests on',
      'those per-query aggregates existing — but nobody has measured what',
      'share of queries actually carry enough signal to rank on, or where',
      'the head/tail line falls. Settling this needs the warehouse queried',
      'for the per-query click and purchase distribution over a real',
      'window — a measurement, not a decision.',
      '',
    ].join('\n'));
    h.engine('topic', 'triage', WU, 'research', TOPIC,
      '--concern', scratch,
      '--slug', 'signal-density',
      '-m', `research(${WU}/relevance-measurement): reroute concern to ${TOPIC}`);

    // The research session: started from the stub, the warehouse measured,
    // the concern folded and absorbed, the research concluded and indexed.
    h.engine('topic', 'start', WU, 'research', TOPIC);
    h.write(`.workflows/${WU}/research/${TOPIC}.md`, [
      '# Research: Behavioural Ranking',
      '',
      'Per-query signal density in the events warehouse — measured so the',
      'discussion\'s weighting stands on a number rather than an assumption.',
      '',
      '## Starting Point',
      '',
      'What we know so far:',
      '- The discussion has settled batch nightly aggregation and a',
      '  purchase-weighted blend of clicks and purchases per query.',
      '- A concern rerouted from relevance-measurement asked whether most',
      '  queries carry enough behavioural signal to rank on at all.',
      '',
      '---',
      '',
      '## Per-Query Signal Density',
      '',
      'Queried the events warehouse for the click and purchase distribution',
      'per distinct query over the last thirty days. Findings:',
      '- 4% of distinct queries account for 71% of all clicks; the median',
      '  query collects two clicks in the window.',
      '- Purchases are sparser still: 11% of distinct queries see any',
      '  purchase in thirty days.',
      '- Above roughly fifty clicks in the window, per-query aggregates are',
      '  stable week to week; below it they swing with single sessions.',
      '',
      '## What This Means for Weighting',
      '',
      'A per-query blend is well-defined only for the head — the few percent',
      'of queries above the stability line. For the tail, any per-query',
      'aggregate is noise dressed as signal, and a purchase weighted as five',
      'clicks amplifies a single event into a ranking swing.',
      '',
      '## Carried into discussion',
      '',
      '- The weighting decision needs a head/tail split it does not yet',
      '  have: the per-query blend above the stability line, and something',
      '  else beneath it — a category-level aggregate, or no behavioural',
      '  feature at all.',
      '- Whether the stability line (about fifty clicks in thirty days) is a',
      '  fixed threshold or recomputed with each nightly run.',
      '',
      '## Triage',
      '',
      '### How dense is the behavioural signal per query?',
      '*From: relevance-measurement · research · 2026-01-01*',
      '',
      'Folded into Per-Query Signal Density above — the measurement the',
      'concern asked for.',
      '',
    ].join('\n'));
    h.engine('topic', 'absorb', WU, 'research', TOPIC,
      '--file', '001-signal-density.md',
      '-m', `research(${WU}/${TOPIC}): absorb 001-signal-density (from relevance-measurement)`);
    h.engine('topic', 'complete', WU, 'research', TOPIC);
    h.engine('commit', WU, '-m', `research(${WU}): complete ${TOPIC} research`);
  },
};
