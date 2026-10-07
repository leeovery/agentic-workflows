'use strict';

// The fixture plus what the single path's yes lands: a proposed grouping
// under the work unit's name over the lone concluded discussion, committed
// before the handoff. Nothing starts — the specification starts after the
// clear.

const fixture = require('./fixture-state.cjs');
const e = require('../../mainlines/epic.cjs');
const WU = e.WU;

module.exports = {
  build(h) {
    fixture.build(h);
    h.engine('manifest', 'set', `${WU}.specification.${WU}`,
      'status=proposed', 'sources.behavioural-ranking.status=pending');
    h.engine('commit', WU, '--state', '-m', `spec(${WU}): propose ${WU}`);
  },
};
