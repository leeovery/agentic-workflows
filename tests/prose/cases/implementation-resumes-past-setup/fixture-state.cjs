'use strict';

// A previous implementation session's world: tracking initialised and
// committed, both setup values confirmed to topic level (skills as
// paths, linters as {name, command} rows), the project defaults holding
// the same values, and the environment doc keeping Step 1 silent. No
// task has been started. The skill paths are recorded values only:
// snapshots exclude .claude/skills/, and the silent-resume path under
// test never reads the filesystem.

const m = require('../../mainlines/feature.cjs');

const SKILLS = '[".claude/skills/laravel-conventions",".claude/skills/laravel-testing"]';
const LINTERS = '[{"name":"pint","command":"vendor/bin/pint --test"},{"name":"phpstan","command":"vendor/bin/phpstan analyse"}]';

function build(h) {
  m.init(h);
  m.create(h);
  m.discuss(h);
  m.specify(h);
  m.plan(h);
  h.write('.workflows/.state/environment-setup.md', 'No special setup required.\n');
  h.engine('manifest', 'set', 'project.defaults.project_skills', SKILLS);
  h.engine('manifest', 'set', 'project.defaults.linters', LINTERS);
  h.engine('task', 'init', 'pay', 'pay');
  h.engine('commit', 'pay', '-m', 'impl(pay): start implementation');
  h.engine('manifest', 'set', 'pay.implementation.pay', 'project_skills', SKILLS);
  h.engine('manifest', 'set', 'pay.implementation.pay', 'linters', LINTERS);
}

module.exports = { build };
