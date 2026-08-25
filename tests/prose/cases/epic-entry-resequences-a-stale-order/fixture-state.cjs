'use strict';

// Two specification items born ordered, then one completes — the
// completion sets `build_order_stale`, and the next epic entry's
// sequencing step should re-derive the order and clear it.

const e = require('../../mainlines/epic.cjs');
const WU = e.WU;

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);
    e.completeDiscussions(h);

    // The groupings as a prior session's analysis landed them: each
    // concluded discussion an independent grouping of one, orders
    // riding the same write (the birth path this recipe replays).
    h.engine('topic', 'start', WU, 'specification', 'behavioural-ranking');
    h.engine('manifest', 'set', `${WU}.specification.behavioural-ranking`,
      'sources.behavioural-ranking.status', 'incorporated');
    h.engine('manifest', 'set', `${WU}.specification.synonym-handling`,
      'status=proposed', 'sources.synonym-handling.status=pending');
    h.engine('build-order', 'sequence', WU,
      'behavioural-ranking=1', 'synonym-handling=2');
    h.write(`.workflows/${WU}/specification/behavioural-ranking/specification.md`, [
      '# Specification: Behavioural Ranking',
      '',
      '## Overview',
      '',
      'Feed behavioural signals into ranking via the batch nightly',
      'aggregation the discussion settled on.',
      '',
      '## Dependencies',
      '',
      '(none)',
      '',
    ].join('\n'));
    h.engine('commit', WU, '-m', `spec(${WU}): behavioural-ranking specification`);
    // Completion flags the build order stale — the state under test.
    h.engine('topic', 'complete', WU, 'specification', 'behavioural-ranking');
    h.engine('commit', WU, '-m', `spec(${WU}): complete behavioural-ranking specification`);
  },
};
