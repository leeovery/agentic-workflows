'use strict';

// Both discussions concluded and the grouping analysis reconciled: a
// behavioural-ranking specification already started over its own
// discussion, and a proposed expansion grouping over synonym-handling.
// Two actionable rows, so the groupings menu offers the unify — whose
// confirm must name the started specification it supersedes.

const e = require('../../mainlines/epic.cjs');
const WU = e.WU;

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);
    e.completeDiscussions(h);

    h.engine('topic', 'start', WU, 'specification', 'behavioural-ranking');
    h.engine('manifest', 'set', `${WU}.specification.behavioural-ranking`,
      'sources.behavioural-ranking.status=incorporated');
    h.write(`.workflows/${WU}/specification/behavioural-ranking/specification.md`, [
      '# Specification: Behavioural Ranking',
      '',
      '## Overview',
      '',
      'Click and purchase signals feed ranking features through a batch',
      'nightly aggregation from the events pipeline.',
      '',
    ].join('\n'));
    h.engine('commit', WU, '-m', `spec(${WU}): behavioural-ranking specification`);

    h.engine('manifest', 'set', `${WU}.specification.expansion`,
      'status=proposed',
      'sources.synonym-handling.status=pending');
    h.engine('build-order', 'sequence', WU, 'behavioural-ranking=1', 'expansion=2');
    h.write(`.workflows/${WU}/.state/discussion-consolidation-analysis.md`, [
      '# Discussion Consolidation Analysis',
      '',
      '## Recommended Groupings',
      '',
      '### Behavioural Ranking',
      '- **behavioural-ranking**: settles the signal ingestion the ranker consumes',
      '',
      '### Expansion',
      '- **synonym-handling**: settles what replaces the hand-maintained list',
      '',
      '## Analysis Notes',
      '(none)',
      '',
    ].join('\n'));
    h.engine('manifest', 'set', `${WU}.discussion`,
      'analysis_cache.checksum=fixture-stub', 'analysis_cache.generated=2026-01-01T00:00:00.000Z');
    h.engine('commit', WU, '-m', `spec(${WU}): grouping analysis`);
  },
};
