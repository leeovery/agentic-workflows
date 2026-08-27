'use strict';

// Every task is built and implementation is complete; review has not
// begun — and the session that built it is still open, holding the
// implementation topic.
//
// The hold is declared, not beaten: a heartbeat is excluded from every
// snapshot, so materialise stamps it from the sidecar with a fresh
// mtime. It carries no identity, which is the legacy record's shape and
// the one that reads `held` from mtime alone — held while the file is
// younger than the staleness window, which outlasts any walk, and owned
// by nobody, so the walking session can never mistake it for its own.
//
// One work unit, not two: the collision the gate exists for is the
// common one — the implementation session still open on the checkout
// when the user opens a second to review. Whether the holder sits in
// this work unit or another changes nothing about the rule, and a
// second unit would buy the case only fixture.

const m = require('../../mainlines/feature.cjs');

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
    m.discuss(h);
    m.specify(h);
    m.plan(h);
    m.implement(h);

    h.write('.world-presence.json', JSON.stringify([
      { work_unit: m.WU, phase: 'implementation', topic: m.WU },
    ], null, 2));
  },
};
