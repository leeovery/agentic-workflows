'use strict';

// The plan is authored and complete; implementation has not begun.
// The project has seen an implementation before: the environment doc
// records that no setup is needed, and the project defaults record
// that project skills and linters were both skipped — so Steps 1, 3,
// and 4 each take their deterministic short arms.

const m = require('../../mainlines/feature.cjs');

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
    m.discuss(h);
    m.specify(h);
    m.plan(h);
    h.engine('manifest', 'set', 'project.defaults.project_skills', '[]');
    h.engine('manifest', 'set', 'project.defaults.linters', '[]');
    h.write('.workflows/.state/environment-setup.md', 'No special setup required.\n');
  },
};
