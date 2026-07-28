'use strict';

// The epic is harvested: three topics on the map with their briefs, the
// discovery session closed. No per-topic phase has started.

const m = require('../../mainlines/epic.cjs');

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
    m.harvest(h);
  },
};
