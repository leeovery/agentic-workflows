'use strict';

// Both discussions concluded, the expansion specification completed
// over the pair and then cancelled as one unit from the epic menu. Its
// key is reserved for a reactivate; its two sources are unaccounted
// again, so the next specification entry runs the grouping analysis
// over them — and must name whatever it proposes afresh.

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
    h.engine('build-order', 'sequence', WU, 'expansion=1');

    // The epic menu's cancel of the Definition unit — the specification
    // stashed and cancelled, its order stashed, its sources untouched.
    h.engine('topic', 'cancel', WU, 'specification', 'expansion');
  },
};
