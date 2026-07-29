'use strict';

// The plan is authored and complete; implementation has not begun.
// No project defaults exist for project_skills or linters — first-time
// discovery for both — and the environment doc keeps Step 1 silent.

const m = require('../../mainlines/feature.cjs');

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
    m.discuss(h);
    m.specify(h);
    m.plan(h);
    h.write('.workflows/.state/environment-setup.md', 'No special setup required.\n');
  },
};
