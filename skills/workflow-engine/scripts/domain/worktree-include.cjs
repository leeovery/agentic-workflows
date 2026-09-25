'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the knowledge directory's copy into new worktrees. Claude Code
// copies into each worktree it creates every gitignored file that a pattern
// in the project-root `.worktreeinclude` (gitignore syntax) matches, so boot
// keeps the knowledge files listed there — the store, its metadata, the
// config — and such a worktree starts with the index its checkout already
// built. The lines are appended when missing; every other line in the file
// is the user's and stays as it is.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { STORE_FILES } = require('./kb.cjs');

const WORKTREE_INCLUDE = '.worktreeinclude';

/**
 * Ensure `.worktreeinclude` lists the knowledge files, creating the file
 * when there is none. A file that cannot be read or written is left as found
 * and reported rather than thrown: boot must never fail over it.
 * @param {string} cwd project root
 * @returns {{changed: boolean, error?: string}}
 */
function syncWorktreeInclude(cwd) {
  const file = path.join(cwd, WORKTREE_INCLUDE);
  try {
    const content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const listed = new Set(content.split('\n').map((line) => line.trim()));
    const missing = STORE_FILES.filter((p) => !listed.has(p));
    if (missing.length === 0) return { changed: false };
    const separator = content === '' || content.endsWith('\n') ? '' : '\n';
    fs.appendFileSync(file, `${separator}${missing.join('\n')}\n`);
    return { changed: true };
  } catch (err) {
    return { changed: false, error: `${WORKTREE_INCLUDE} — ${err instanceof Error ? err.message : String(err)}` };
  }
}

module.exports = { syncWorktreeInclude, WORKTREE_INCLUDE };
