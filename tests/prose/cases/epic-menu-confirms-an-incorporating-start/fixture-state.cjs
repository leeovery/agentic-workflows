'use strict';

// All three discussions concluded. The behavioural-ranking specification
// started over its own discussion and relevance-measurement's; a later
// grouping analysis kept a grouping apart that takes behavioural-ranking's
// discussion in beside synonym-handling — half that specification's
// sources, no majority. Starting the grouping incorporates the started
// specification, which the epic menu's start row does not show.

const e = require('../../mainlines/epic.cjs');
const WU = e.WU;

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);
    e.completeDiscussions(h);

    h.engine('discovery-map', 'reroute', WU, 'relevance-measurement', 'discussion');
    h.engine('topic', 'start', WU, 'discussion', 'relevance-measurement');
    h.write(`.workflows/${WU}/discussion/relevance-measurement.md`, [
      '# Discussion: Relevance Measurement',
      '',
      '## Context',
      '',
      'Every ranking change is decided by argument. This discussion settles',
      'how a change is scored before it ships.',
      '',
      '---',
      '',
      '## Evaluation Set',
      '',
      '### Decision',
      'Relevance is scored offline against a judged query set drawn from',
      'the events pipeline\'s nightly click aggregates; a ranking change',
      'ships only when it does not lower the set\'s score.',
      '',
    ].join('\n'));
    h.engine('discussion-map', 'add', WU, 'relevance-measurement', 'evaluation-set');
    h.engine('commit', WU, '-m', `discussion(${WU}): initialize relevance-measurement discussion`);
    h.engine('discussion-map', 'set', WU, 'relevance-measurement', 'evaluation-set', 'decided');
    h.engine('topic', 'complete', WU, 'discussion', 'relevance-measurement');
    h.engine('commit', WU, '-m', `discussion(${WU}): complete relevance-measurement discussion`);
    h.engine('cache', 'stamp', WU, 'gap-analysis');
    h.engine('commit', WU, '-m', `discovery(${WU}): stamp gap analysis`);

    h.engine('topic', 'start', WU, 'specification', 'behavioural-ranking');
    h.engine('manifest', 'set', `${WU}.specification.behavioural-ranking`,
      'sources.behavioural-ranking.status=incorporated',
      'sources.relevance-measurement.status=incorporated');
    h.write(`.workflows/${WU}/specification/behavioural-ranking/specification.md`, [
      '# Specification: Behavioural Ranking',
      '',
      '## Overview',
      '',
      'Click and purchase signals feed ranking features through a batch',
      'nightly aggregation from the events pipeline, scored against the',
      'judged query set before any change ships.',
      '',
    ].join('\n'));
    h.engine('commit', WU, '-m', `spec(${WU}): behavioural-ranking specification`);

    h.engine('manifest', 'set', `${WU}.specification.expansion`,
      'status=proposed',
      'sources.synonym-handling.status=pending',
      'sources.behavioural-ranking.status=pending');
    h.engine('build-order', 'sequence', WU, 'behavioural-ranking=1', 'expansion=2');
    h.write(`.workflows/${WU}/.state/discussion-consolidation-analysis.md`, [
      '# Discussion Consolidation Analysis',
      '',
      '## Recommended Groupings',
      '',
      '### Behavioural Ranking',
      '- **behavioural-ranking**: settles the signal ingestion the ranker consumes',
      '- **relevance-measurement**: settles how a ranking change is scored',
      '',
      '### Expansion',
      '- **synonym-handling**: settles behaviour-driven expansion',
      '- **behavioural-ranking**: the click signals expansion reads come from its ingestion',
      '',
      '## Analysis Notes',
      'Expansion shares behavioural-ranking with the started Behavioural Ranking',
      'specification — one of its two sources, no majority — so it stands apart.',
      '',
    ].join('\n'));
    h.engine('manifest', 'set', `${WU}.discussion`,
      'analysis_cache.checksum=fixture-stub', 'analysis_cache.generated=2026-01-01T00:00:00.000Z');
    h.engine('commit', WU, '-m', `spec(${WU}): grouping analysis`);
  },
};
