'use strict';

//
// Migration 053: Ignore lock and temp files under .workflows/
//
// The engine's transient artifacts — manifest lock files
// (.workflows/{wu}/.lock, plus the .breaking stale-break guard), the
// project lock (.workflows/.project-lock), and the knowledge store's
// atomic-write temp files (.workflows/.knowledge/*.tmp) — are stageable
// today: a scoped `git add` racing a live holder commits them. (The
// .commit-lock rules cover a lock that ultimately shipped in the .git
// dir instead — harmless, kept for the frozen rule set.) Migration 049 created
// .workflows/.gitignore with only the .cache/ and manifest-temp rules;
// this extends it to cover every transient the engine creates.
//
// Idempotent: rules already present are skipped; existing content and
// custom rules are preserved.
//

const fs = require('fs');
const path = require('path');

const RULES = [
  '.lock',
  '.lock.breaking',
  '.project-lock',
  '.project-lock.breaking',
  '.commit-lock',
  '.commit-lock.breaking',
  '.knowledge/*.tmp',
];

// grep -qxF: any whole line equals `needle`.
function hasExactLine(content, needle) {
  const lines = content.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines.indexOf(needle) !== -1;
}

module.exports = {
  id: '053',
  description: 'ignore lock and temp files under .workflows/',
  run({ projectDir, reportUpdate, reportSkip }) {
    const workflowsDir = path.join(projectDir, '.workflows');
    const nested = path.join(workflowsDir, '.gitignore');

    fs.mkdirSync(workflowsDir, { recursive: true });

    let changed = false;
    for (const rule of RULES) {
      if (fs.existsSync(nested)) {
        const content = fs.readFileSync(nested, 'utf8');
        if (hasExactLine(content, rule)) continue;
        if (content.length > 0 && !content.endsWith('\n')) {
          fs.appendFileSync(nested, '\n');
        }
      }
      fs.appendFileSync(nested, rule + '\n');
      changed = true;
    }

    if (changed) reportUpdate(); else reportSkip();
  },
};
