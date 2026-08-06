'use strict';

// A topic that exists only as one parked, bundled concern: a sibling
// discussion concluded and rerouted a three-ask measurement position into
// relevance-measurement as a single queue entry (the pre-split shape the
// landing rule now forbids at the origin — entries like it are still in
// queues). The discussion item was created `triaged` by the delivery — no
// artifact, no session; the walk must take the entry one ask at a time.

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
    // the walk is the only thing this world exercises.
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

    h.write(`.workflows/.cache/${WU}/discussion/behavioural-ranking/concern-measurement-gates-for-ranking-changes.md`, [
      '### Measurement gates for ranking changes',
      '*From: behavioural-ranking · discussion · 2026-01-02*',
      '',
      'behavioural-ranking settled signal ingestion as batch nightly',
      'aggregation, so ranking changes ship against day-old signals.',
      'Working that through produced three revisions to how ranking',
      'quality should be measured — three consequences, each this',
      "topic's to accept or reject.",
      '',
      '**1. An offline baseline computed from the batch aggregates.**',
      '',
      'Every ranking change is judged against an offline metrics baseline',
      'recomputed nightly from the same aggregates the ranker reads.',
      'Which metrics constitute the baseline is this topic\'s decision —',
      'behavioural-ranking only needs one to exist before changes ship.',
      '',
      '**2. Baseline movement gates a ship.**',
      '',
      'A ranking change whose offline metrics move against the baseline',
      'beyond a tolerance is blocked from shipping. Where the tolerance',
      'sits, and whether a human can override the block, are open — but',
      'without some gate the baseline is decoration.',
      '',
      '**3. Judged sampling replaces live A/B for expansion-affected queries.**',
      '',
      'Because signals are day-old, live A/B on expansion-affected',
      'queries reads noise. A judged sample of reformulated queries',
      'replaces it; sample size and refresh cadence are open.',
      '',
      '**Written firmly, open to challenge.** If this topic\'s model makes',
      'any of it wrong, say so and behavioural-ranking reopens.',
      '',
    ].join('\n'));
    h.engine('topic', 'triage', WU, 'discussion', 'relevance-measurement',
      '--concern', `.workflows/.cache/${WU}/discussion/behavioural-ranking/concern-measurement-gates-for-ranking-changes.md`,
      '--slug', 'measurement-gates-for-ranking-changes',
      '-m', `discussion(${WU}/behavioural-ranking): reroute concern to relevance-measurement`);
  },
};
