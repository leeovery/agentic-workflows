'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the knowledge directory's copy into new worktrees. Claude Code
// copies into each worktree it creates every gitignored file that a pattern
// in the project-root `.worktreeinclude` (gitignore syntax) matches, so boot
// keeps the knowledge files listed there — the store, its metadata, the
// config — and such a worktree starts with the index its checkout already
// built. The lines are appended when missing, and a line naming the store's
// retired file is renamed in place — or dropped, where the store is already
// listed; every other line in the file is the user's and stays as it is.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { KNOWLEDGE_DIR, STORE_FILE, STORE_FILES } = require('./kb.cjs');

const WORKTREE_INCLUDE = '.worktreeinclude';
const RETIRED_STORE_FILE = `${KNOWLEDGE_DIR}/store.msp`;

/**
 * The lines with the retired store file's line renamed to the store's, or
 * dropped where the store is already listed — so it is listed once.
 * @param {string[]} lines
 * @returns {string[]}
 */
function retireStoreLine(lines) {
  let listed = lines.some((line) => line.trim() === STORE_FILE);
  return lines.flatMap((line) => {
    if (line.trim() !== RETIRED_STORE_FILE) return [line];
    if (listed) return [];
    listed = true;
    return [STORE_FILE];
  });
}

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
    const lines = retireStoreLine(content.split('\n'));
    const listed = new Set(lines.map((line) => line.trim()));
    const missing = STORE_FILES.filter((p) => !listed.has(p));
    const kept = lines.join('\n');
    const separator = kept === '' || kept.endsWith('\n') ? '' : '\n';
    const synced = missing.length === 0 ? kept : `${kept}${separator}${missing.join('\n')}\n`;
    if (synced === content) return { changed: false };
    fs.writeFileSync(file, synced);
    return { changed: true };
  } catch (err) {
    return { changed: false, error: `${WORKTREE_INCLUDE} — ${err instanceof Error ? err.message : String(err)}` };
  }
}

module.exports = { syncWorktreeInclude, WORKTREE_INCLUDE };
