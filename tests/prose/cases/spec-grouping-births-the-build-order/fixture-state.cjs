'use strict';

// Two concluded discussions, a stamped gap analysis, and no
// specification items anywhere: the next specification entry runs the
// grouping analysis for the first time, and the build order should be
// born inside its reconcile.

const e = require('../../mainlines/epic.cjs');

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);
    e.completeDiscussions(h);
  },
};
