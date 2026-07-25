'use strict';

// Expected end state for the root-cause validation walk: the row
// dispatched, the report landed, scan promoted it, incorporate closed it.
// The report content is read from the stub the case arms, so the bytes
// the walk writes and the bytes expected here cannot drift.

const fs = require('fs');
const path = require('path');

const m = require('../_shared/bugfix-mainline.cjs');
const { readStub } = require('../../lib/cases.cjs');

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
    m.investigateToRootCause(h);

    const dispatch = JSON.parse(h.engine(
      'agent', 'dispatch', m.WU, 'investigation', m.WU, '--kind', 'root-cause-validation'));
    fs.mkdirSync(path.dirname(path.join(h.dir, dispatch.file)), { recursive: true });
    h.write(dispatch.file, readStub('root-cause-validated').content);
    h.engine('agent', 'scan', m.WU, 'investigation', m.WU);
    h.engine('agent', 'incorporate', m.WU, 'investigation', m.WU, dispatch.id);
  },
};
