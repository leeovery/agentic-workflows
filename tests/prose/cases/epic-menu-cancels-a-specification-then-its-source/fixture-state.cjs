'use strict';

// Both discussions concluded, the expansion specification completed
// over the pair with its plan completed beneath it, and no
// implementation anywhere. The started specification locks both source
// topics on the cancel menu; cancelling the specification unit frees
// them, and the freed synonym-handling topic then cancels on its own.

const e = require('../../mainlines/epic.cjs');
const WU = e.WU;

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);
    e.completeDiscussions(h);

    h.engine('topic', 'start', WU, 'specification', 'expansion');
    h.engine('manifest', 'set', `${WU}.specification.expansion`,
      'sources.behavioural-ranking.status=incorporated',
      'sources.synonym-handling.status=incorporated');
    h.write(`.workflows/${WU}/specification/expansion/specification.md`, [
      '# Specification: Expansion',
      '',
      '## Overview',
      '',
      'Behaviour-driven query expansion fed by the batch nightly',
      'aggregation the ranking discussion settled on.',
      '',
      '## Dependencies',
      '',
      '(none)',
      '',
    ].join('\n'));
    h.engine('commit', WU, '-m', `spec(${WU}): expansion specification`);
    h.engine('topic', 'complete', WU, 'specification', 'expansion');
    h.engine('commit', WU, '-m', `spec(${WU}): complete expansion specification`);
    // The sequence runs after the completion: it clears the stale flag
    // the completion set, leaving the entry's refresh step silent.
    h.engine('build-order', 'sequence', WU, 'expansion=1');

    h.engine('topic', 'start', WU, 'planning', 'expansion');
    h.write(`.workflows/${WU}/planning/expansion/planning.md`, [
      '# Plan: expansion',
      '',
      'One phase, minimal — enough for the menu to read a completed',
      'plan.',
      '',
    ].join('\n'));
    h.engine('commit', WU, '-m', `plan(${WU}): expansion plan`);
    h.engine('topic', 'complete', WU, 'planning', 'expansion');
    h.engine('commit', WU, '-m', `plan(${WU}): complete expansion plan`);
  },
};
