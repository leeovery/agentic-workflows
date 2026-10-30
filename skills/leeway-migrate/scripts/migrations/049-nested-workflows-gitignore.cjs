'use strict';

//
// Migration 049: Nested .workflows/.gitignore
//
// Migrations 010/011 wrote the cache ignore rule into the repo-root
// .gitignore, which no engine commit scope can ever stage (every scope lives
// under .workflows/) — it stayed untracked forever. The ignore rules belong
// inside the tree the engine commits: .workflows/.gitignore, which also
// covers orphaned atomic-write temp files (.manifest.json.<pid>.tmp) a
// crashed writer can leave behind.
//
// Steps:
//   1. Ensure .workflows/.gitignore carries the .cache/ and temp-file rules
//   2. Remove the exact .workflows/.cache/ line from the repo-root .gitignore
//   3. Delete the root .gitignore only when that rule was its only content
//
// Idempotent: rules already present are skipped; a root .gitignore without
// the rule is untouched. Steps 1 and 2/3 report independently, mirroring the
// bash version's two report calls.
//

const fs = require('fs');
const path = require('path');

// The lines grep sees in a file: split on '\n', dropping the trailing-newline
// artifact so a whole-line match (grep -xF) and inversion (grep -vxF) behave
// exactly as the shell did.
function grepLines(content) {
  if (content === '') return [];
  const parts = content.split('\n');
  if (parts[parts.length - 1] === '') parts.pop();
  return parts;
}

// grep -qxF: any whole line equals `needle`.
function hasExactLine(content, needle) {
  return grepLines(content).indexOf(needle) !== -1;
}

module.exports = {
  id: '049',
  description: 'nested .workflows/.gitignore',
  run({ projectDir, reportUpdate, reportSkip }) {
    const workflowsDir = path.join(projectDir, '.workflows');
    const nested = path.join(workflowsDir, '.gitignore');
    const rootGitignore = path.join(projectDir, '.gitignore');
    const rootEntry = '.workflows/.cache/';

    // --- Step 1: Ensure the nested .workflows/.gitignore carries both rules ---

    fs.mkdirSync(workflowsDir, { recursive: true });

    let nestedChanged = false;
    for (const rule of ['.cache/', '.manifest.json.*.tmp']) {
      if (fs.existsSync(nested)) {
        const content = fs.readFileSync(nested, 'utf8');
        if (hasExactLine(content, rule)) continue;
        // Ensure the file ends with a newline before appending.
        if (content.length > 0 && !content.endsWith('\n')) {
          fs.appendFileSync(nested, '\n');
        }
      }
      fs.appendFileSync(nested, rule + '\n');
      nestedChanged = true;
    }

    if (nestedChanged) reportUpdate(); else reportSkip();

    // --- Steps 2+3: Retire the repo-root rule; drop the file only when the
    // --- rule was all it held ---

    if (fs.existsSync(rootGitignore)) {
      const content = fs.readFileSync(rootGitignore, 'utf8');
      if (hasExactLine(content, rootEntry)) {
        const kept = grepLines(content).filter((line) => line !== rootEntry);
        const remaining = kept.map((line) => line + '\n').join(''); // grep -vxF output
        if (remaining.length > 0) {
          fs.writeFileSync(rootGitignore, remaining);
        } else {
          fs.rmSync(rootGitignore);
        }
        reportUpdate();
      } else {
        reportSkip();
      }
    } else {
      reportSkip();
    }
  },
};
