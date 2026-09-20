'use strict';

// The plan is authored and graphed, and one review cycle already ran
// clean in an earlier sitting — a clean review writes no tracking file,
// so `review_cycle` at 1 with an empty tracking subtree is the whole
// record of it. The specification is settled: completed, its source row
// incorporated, no reconcile flag. Nothing holds the plan, so this walk
// is the conclusion's unblocked path.

const m = require('../../mainlines/feature.cjs');

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
    m.discuss(h);
    m.specify(h);
    m.planAuthored(h);
    m.planGraphed(h);

    h.engine('manifest', 'set', `${m.WU}.planning.${m.WU}`, 'review_cycle', '1');
    h.engine('commit', m.WU, '-m', `planning(${m.WU}): complete plan review (cycle 1)`, '--topic', `planning/${m.WU}`);
  },
};
