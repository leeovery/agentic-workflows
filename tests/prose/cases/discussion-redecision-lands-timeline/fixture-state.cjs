'use strict';

// The coherence loop's hand-off, landed: the seeded batch-vs-live-stream
// conflict (behavioural-ranking settled batch-only signal ingestion;
// synonym-handling's expansion decision rests on a live click-signal
// stream) was approved at the findings gate and triaged into
// synonym-handling. `topic triage` reopened the completed discussion and
// the concern sits in its Triage section under a title whose kebab-case
// collides with the decided expansion-source subtopic — the next
// session's drain must fold into the existing subtopic, not add a new
// one. The gate's aftermath closes the world: the analysis cache file,
// the triage commit, and the coherence stamp (one file, with the target
// reopened — mirroring the gate's boot-time behaviour).

const e = require('../../mainlines/epic.cjs');

const WU = e.WU;

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);
    e.completeDiscussions(h);

    h.engine('topic', 'triage', WU, 'discussion', 'synonym-handling');
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
      'upkeep and quality. For freshness we want expansions reacting',
      'within the session, so the expansion service reads the live',
      'click-signal stream at query time.',
      '',
      '### Decision',
      'Synonym expansion is behaviour-driven: the expansion service',
      'consumes the live click-signal stream at query time, keyed on',
      'reformulation-and-click pairs. The hand-maintained list is retired',
      'once behavioural coverage matches it.',
      '',
      '---',
      '',
      '## Summary',
      '',
      '### Key Insights',
      '1. Any curated list recreates the upkeep problem — derive',
      '   expansions from behaviour instead.',
      '',
      '### Current State',
      '- Expansion source decided: behaviour-driven, reading the live',
      '  click-signal stream.',
      '',
      '## Triage',
      '',
      '### Expansion Source',
      '*From: behavioural-ranking · discussion · 2026-01-01*',
      '',
      'Behavioural-ranking settled signal ingestion as a batch nightly',
      'aggregation job — real-time streaming rejected as over-engineering,',
      'the events pipeline exposes batch aggregates only, and no live',
      'signal stream will be built. The expansion-source decision here',
      'rests on the expansion service consuming a live click-signal stream',
      'at query time — infrastructure that decision says will not exist.',
      'The freshness assumption needs re-deciding against batch-only',
      'signals: either the expansion design works from the nightly batch',
      'aggregates, or this discussion makes the case for the stream',
      'against the earlier decision.',
      '',
    ].join('\n'));
    h.write(`.workflows/${WU}/.state/coherence-analysis.md`, [
      '# Coherence Analysis Cache',
      '',
      '## Findings',
      '',
      '### batch-vs-live-stream',
      '- **Category**: conflict',
      '- **Docs**: behavioural-ranking.md, synonym-handling.md',
      '- **Summary**: synonym expansion consumes a live click-signal stream that behavioural-ranking decided will not be built',
      '- **Target**: synonym-handling',
      '',
    ].join('\n'));
    h.engine('commit', WU, '-m', `discovery(${WU}): coherence findings triaged`);
    h.engine('cache', 'stamp', WU, 'coherence-analysis');
    h.engine('commit', WU, '-m', `discovery(${WU}): stamp coherence analysis`);
  },
};
