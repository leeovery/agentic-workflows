'use strict';

// A pure stale-reference correction waiting in a completed discussion's
// triage queue. Behavioural-ranking's batch decision later retired its
// interim click-weights table in favour of flat pair-counts files;
// synonym-handling's decision layer is coherent with the batch ruling
// (Sibling check in place) but two of its prose sites still cite the
// retired table as the current mechanism. The coherence pass caught it,
// the finding was approved, and `topic triage` reopened the completed
// discussion with the concern as one queue file whose title names no
// subtopic. The next session's fold must amend the two sites in place —
// dated notes naming the retiring decision — with no new section and no
// title-minted subtopic.

const e = require('../../mainlines/epic.cjs');

const WU = e.WU;

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);
    e.completeDiscussions(h);

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
      'could name, so we rejected it as over-engineering. The first cut of',
      'the nightly job staged its output in a click-weights table; once the',
      'consumers were known, the staging step had no reader of its own.',
      '',
      '### Decision',
      'Signal ingestion is a batch nightly aggregation job from the events',
      'pipeline into ranking features. Real-time streaming is rejected as',
      'over-engineering — the events pipeline exposes batch aggregates',
      'only, and no live signal stream will be built. The aggregates ship',
      'as flat pair-counts files consumed directly; the interim',
      'click-weights table is retired (2026-01-04) — nothing reads it.',
      '',
      '---',
      '',
      '## Summary',
      '',
      '### Key Insights',
      '1. Freshness has no consumer today — batch wins on simplicity.',
      '',
      '### Current State',
      '- Signal ingestion decided: batch nightly aggregation shipping flat',
      '  pair-counts files; the click-weights table is retired.',
      '',
    ].join('\n'));

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
      'behavioural-ranking, and daily refresh is fine — the scores are',
      'computed nightly from the click-weights table their job maintains.',
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
      '- Expansion source decided: behaviour-driven, computed nightly',
      '  from the click-weights table.',
      '',
    ].join('\n'));
    h.engine('commit', WU, '-m', `discussion(${WU}): reconcile discussion records`);

    h.write('.workflows/.cache/scratch/concern-scratch.md', [
      '### The click-weights table cited as current; it was retired',
      '*From: behavioural-ranking · discussion · 2026-01-05*',
      '',
      'Coherence finding (stale-reference). This document cites the',
      'click-weights table as the current mechanism feeding expansion',
      'scoring; behavioural-ranking retired the table on 2026-01-04 — the',
      'nightly job ships flat pair-counts files consumed directly, and',
      'nothing reads a table.',
      '',
      '> synonym-handling.md · Expansion Source · Journey: "the scores are',
      '> computed nightly from the click-weights table their job maintains."',
      '',
      '> behavioural-ranking.md · Signal Ingestion · Decision: "The',
      '> aggregates ship as flat pair-counts files consumed directly; the',
      '> interim click-weights table is retired (2026-01-04) — nothing',
      '> reads it."',
      '',
      'Two sites cite the table as current: the Journey sentence quoted',
      'above and the Summary\'s Current State bullet. The decision layer is',
      'coherent — expansion is batch-computed with daily refresh either',
      'way; only the citing prose names a mechanism that no longer exists.',
      '',
    ].join('\n'));
    h.engine('topic', 'triage', WU, 'discussion', 'synonym-handling',
      '--concern', '.workflows/.cache/scratch/concern-scratch.md', '--slug', 'click-weights-cited-as-current',
      '-m', `discussion(${WU}/behavioural-ranking): reroute concern to synonym-handling`);

    h.write(`.workflows/${WU}/.state/coherence-analysis.md`, [
      '# Coherence Analysis Cache',
      '',
      '## Findings',
      '',
      '### click-weights-stale-reference',
      '- **Category**: stale-reference',
      '- **Docs**: behavioural-ranking.md, synonym-handling.md',
      '- **Summary**: synonym-handling cites the click-weights table as current; behavioural-ranking retired it for flat pair-counts files',
      '- **Target**: synonym-handling',
      '',
    ].join('\n'));
    h.engine('commit', WU, '-m', `discovery(${WU}): coherence findings triaged`);
    h.engine('cache', 'stamp', WU, 'coherence-analysis');
    h.engine('commit', WU, '-m', `discovery(${WU}): stamp coherence analysis`);
  },
};
