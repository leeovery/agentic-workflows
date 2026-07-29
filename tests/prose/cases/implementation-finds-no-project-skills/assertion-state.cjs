'use strict';

// The fixture plus what the walk should add: the implementation item
// from task init and its start commit, then the four empty-array
// records from the two discoveries' no-findings/skip arms. The topic
// sets are idempotent over task init's empty defaults; the project
// sets add the fields the fixture deliberately lacks.

const m = require('../../mainlines/feature.cjs');

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
    m.discuss(h);
    m.specify(h);
    m.plan(h);
    h.write('.workflows/.state/environment-setup.md', 'No special setup required.\n');
    h.engine('task', 'init', 'pay', 'pay');
    h.engine('commit', 'pay', '-m', 'impl(pay): start implementation');
    h.engine('manifest', 'set', 'pay.implementation.pay', 'project_skills', '[]');
    h.engine('manifest', 'set', 'project.defaults.project_skills', '[]');
    h.engine('manifest', 'set', 'pay.implementation.pay', 'linters', '[]');
    h.engine('manifest', 'set', 'project.defaults.linters', '[]');
  },
};
