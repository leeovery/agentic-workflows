'use strict';

// A graphed plan at the review boundary whose traceability pass has
// something to find in two successive cycles, each time in a task the
// last cycle never touched: cycle 1 in Phase 1's two tasks, cycle 2 in
// Phase 2's capture task. Every finding is a rule the specification
// already decides, so all four ride auto once the user opts in — which
// is the shape the churn exit has to stop: nothing recurs, everything
// resolves, and the next cycle brings a fresh pair.
//
// The plan is authored and graphed and no review has run: `review_cycle`
// is 0, so the review opens by stamping its cycle and the word baseline
// the diagnostic reads back.

const m = require('../../mainlines/feature.cjs');

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
    m.discuss(h);
    m.specify(h);
    m.planAuthored(h);
    m.planGraphed(h);
  },
};
