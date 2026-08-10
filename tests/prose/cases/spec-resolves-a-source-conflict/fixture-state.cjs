'use strict';

// The seeded cross-document conflict, met at specification. Both
// discussions are complete: behavioural-ranking decided batch-only
// signal ingestion (no live stream will be built); synonym-handling's
// expansion decision rests, uncited, on a live click-signal stream.
// The grouping analysis concluded: one proposed spec over both
// discussions, and the consolidation cache carries the tension the
// full read surfaced. Construction must meet the conflict at the
// expansion chunk, stop for the user, land the settled decision in
// synonym-handling's document as if decided then, reindex it, run the
// sources-stale safety valve, and continue — the discussion is never
// reopened.

const e = require('../../mainlines/epic.cjs');

const WU = e.WU;

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);
    e.completeDiscussions(h);

    // Grouping analysis outcome: the proposed spec and its source rows
    // (analysis-flow C's upsert shape), then the consolidation cache
    // with the surfaced tension (analysis-flow D).
    h.engine('manifest', 'set', `${WU}.specification.expansion`,
      'status=proposed',
      'sources.behavioural-ranking.status=pending',
      'sources.synonym-handling.status=pending');
    h.write(`.workflows/${WU}/.state/discussion-consolidation-analysis.md`, [
      '# Discussion Consolidation Analysis',
      '',
      '## Recommended Groupings',
      '',
      '### Expansion',
      '- **behavioural-ranking**: settles the signal ingestion the expansion pipeline consumes',
      '- **synonym-handling**: settles what replaces the hand-maintained list',
      '',
      '**Coupling**: Expansion scoring is derived from the behavioural signals — one pipeline, one spec.',
      '**Tension**: behavioural-ranking × synonym-handling — expansion freshness rests on a live click-signal stream that behavioural-ranking ruled will not be built.',
      '',
      '## Analysis Notes',
      '(none)',
      '',
    ].join('\n'));
    h.engine('commit', WU, '-m', `spec(${WU}): grouping analysis`);
  },
};
