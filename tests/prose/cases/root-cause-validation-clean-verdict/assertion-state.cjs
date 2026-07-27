'use strict';

// The fixture state plus what the walk should have done: the dispatch
// recorded, the agent's report landed at the path the dispatch returned,
// scan promoting the row and incorporate closing it. The report content
// comes from the same stub the case arms, so the bytes the walk writes
// and the bytes expected here cannot drift apart.

const fs = require('fs');
const path = require('path');

const fixture = require('./fixture-state.cjs');
const m = require('../../mainlines/bugfix.cjs');
const { readStub } = require('../../lib/cases.cjs');

module.exports = {
  build(h) {
    fixture.build(h);

    const dispatch = JSON.parse(h.engine(
      'agent', 'dispatch', m.WU, 'investigation', m.WU, '--kind', 'root-cause-validation'));
    fs.mkdirSync(path.dirname(path.join(h.dir, dispatch.file)), { recursive: true });
    h.write(dispatch.file, readStub('root-cause-validated').content);
    h.engine('agent', 'scan', m.WU, 'investigation', m.WU);
    h.engine('agent', 'incorporate', m.WU, 'investigation', m.WU, dispatch.id);
  },
};
