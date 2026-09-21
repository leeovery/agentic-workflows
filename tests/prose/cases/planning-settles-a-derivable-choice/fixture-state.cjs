'use strict';

// The plan is authored and graphed; review and conclusion have not run.
// The integrity review's stub stages three findings against this world:
// a settled call the specification determines (where the user opts into
// auto), a choice the specification in fact settles — its duplicate-start
// rule decides a retried checkout — and a choice whose whole substance is
// a mechanism the specification never decided: what the capture consumer
// derives its duplicate key from and where it keeps it. The session must
// dispose the second to settled on the specification's rule and apply it
// under auto with no stop, and decline the third as the builder's before
// anything renders for it.

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
