'use strict';

// The plan is authored and complete; implementation has not begun. A
// previous feature settled the project setup: both project defaults are
// populated (skills as paths, linters as {name, command} rows) and the
// environment doc keeps Step 1 silent. The pay topic records neither
// value — first session, confirm path. The skill paths are recorded
// values only: snapshots exclude .claude/skills/, and the confirm path
// under test never reads the filesystem.

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
}

module.exports = { build, SKILLS, LINTERS };
