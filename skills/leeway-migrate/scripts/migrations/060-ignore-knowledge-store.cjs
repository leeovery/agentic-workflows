'use strict';

//
// Migration 060: Ignore the knowledge directory
//
// The knowledge directory (.workflows/.knowledge/) is local to each
// checkout: the store is a derived index every checkout builds from the
// committed artifacts, its metadata describes that store, and the knowledge
// config setup writes records this checkout's choice. None of it belongs in
// git, so one rule ignores the whole directory.
//
// Extends .workflows/.gitignore the way 049 and 053 do. Files already
// tracked are boot's to untrack — a migration never runs git.
//
// Idempotent: a rule already present is skipped; existing content and
// custom rules are preserved.
//

const fs = require('fs');
const path = require('path');

const RULES = ['.knowledge/'];

// grep -qxF: any whole line equals `needle`.
function hasExactLine(content, needle) {
  const lines = content.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines.indexOf(needle) !== -1;
}

module.exports = {
  id: '060',
  description: 'ignore the knowledge directory',
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
