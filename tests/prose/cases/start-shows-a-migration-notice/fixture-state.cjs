'use strict';

// A project that ran the workflows before plan mode went: migration 034
// wrote `showClearContextOnPlanAccept: true` into its settings, and the
// project committed it. The migrations log has 067 un-recorded, so the next
// boot runs it live — it removes the key and, finding it in the last commit,
// hands back a notice for the person.

const fs = require('fs');
const path = require('path');
const e = require('../../mainlines/epic.cjs');

const SETTINGS = '.claude/settings.json';

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);

    const settings = JSON.parse(fs.readFileSync(path.join(h.dir, SETTINGS), 'utf8'));
    h.write(SETTINGS, JSON.stringify({ showClearContextOnPlanAccept: true, ...settings }, null, 2) + '\n');

    const migrationsDir = path.join(__dirname, '..', '..', '..', '..', 'skills', 'workflow-migrate', 'scripts', 'migrations');
    const recorded = fs.readdirSync(migrationsDir)
      .map((f) => (f.match(/^(\d+)-/) || [])[1])
      .filter((id) => id && id !== '067')
      .sort();
    h.write('.workflows/.state/migrations', recorded.join('\n') + '\n');
    h.git('add', '--', SETTINGS, '.workflows/.state/migrations');
    h.git('commit', '-q', '-m', 'chore: settings and migration state from before 067');
  },
};
