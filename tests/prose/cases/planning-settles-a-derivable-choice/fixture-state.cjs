'use strict';

// The plan is authored and graphed; review and conclusion have not run.
// The integrity review's stub stages three findings against this world:
// a settled call the specification determines (where the user opts into
// auto), a choice the specification in fact settles — its duplicate-start
// rule decides a retried checkout — and a choice that is a fork in how
// the plan achieves idempotency, nothing in the record leaning. The
// session must dispose the second to settled on the specification's
// rule and the third to settled on its own honest call, and apply both
// under auto with no stop.

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
