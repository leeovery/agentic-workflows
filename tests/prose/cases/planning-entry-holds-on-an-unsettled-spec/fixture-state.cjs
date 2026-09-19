'use strict';

// A plan authored and graphed, and a specification that moved beneath it
// after the session that built it went away: a peer reopened the source
// discussion, which staled the specification's extracted source row and
// flagged the specification itself. The specification still reads
// `completed` — nobody has re-entered it — so a hold keyed on its status
// alone would let this entry straight through.

const m = require('../../mainlines/feature.cjs');

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
    m.discuss(h);
    m.specify(h);
    m.planAuthored(h);
    m.planGraphed(h);

    // The peer's move: the discussion reopens, and the engine's staleness
    // hop flips the specification's `pay` source row to `stale` and flags
    // the specification `reconcile_needed: discussion`.
    h.engine('topic', 'reopen', m.WU, 'discussion', m.WU);
  },
};
