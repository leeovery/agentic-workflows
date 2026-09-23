'use strict';

//
// Migration 060: Ignore the knowledge store
//
// The knowledge store is a derived index every checkout builds from the
// committed artifacts, so its files belong outside git: the store itself
// (.workflows/.knowledge/store.msp), its metadata (metadata.json), and the
// backups `knowledge rebuild` sets aside while it runs (*.bak). The lock
// and the atomic-write temp files are already ignored (053). config.json
// stays tracked — it records that the project is set up.
//
// Extends .workflows/.gitignore the way 049 and 053 do. Files already
// tracked are boot's to untrack — a migration never runs git.
//
// Idempotent: rules already present are skipped; existing content and
// custom rules are preserved.
//

const fs = require('fs');
const path = require('path');

const RULES = [
  '.knowledge/store.msp',
  '.knowledge/metadata.json',
  '.knowledge/*.bak',
];

// grep -qxF: any whole line equals `needle`.
function hasExactLine(content, needle) {
  const lines = content.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines.indexOf(needle) !== -1;
}

module.exports = {
  id: '060',
  description: 'ignore the knowledge store',
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
