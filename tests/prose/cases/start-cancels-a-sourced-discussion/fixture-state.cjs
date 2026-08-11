'use strict';

// A search-relevance epic past its grouping: both discussions are
// completed, and the expansion specification has been started over
// them — both source rows pending. Cancelling synonym-handling from
// the epic menu must refuse (a live spec is built from it), route
// through the engine-rendered cascade gate, and on confirmation
// cancel the discussion and the specification together.

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
      'sources.behavioural-ranking.status=pending',
      'sources.synonym-handling.status=pending');
    h.write(`.workflows/${WU}/specification/expansion/specification.md`,
      '# Specification — Expansion\n\n(started, nothing extracted)\n');
    h.engine('commit', WU, '-m', `spec(${WU}): start expansion specification`);
  },
};
