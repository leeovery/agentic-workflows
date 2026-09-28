'use strict';

//
// Migration 063: Retire the knowledge store's old file
//
// The knowledge store was `.workflows/.knowledge/store.msp` and is now
// `store.bin`, so the old file is deleted where it exists. The knowledge
// directory is local to each checkout and git-ignored: a clone that finds
// 063 already recorded keeps its own old file, dead and harmless.
//
// The project-root `.worktreeinclude` lists the knowledge files Claude Code
// copies into a worktree it creates. A line naming the old file is renamed
// to the store's, or dropped where the store is already listed, so the
// store is listed once. Every other line, and the file's trailing newline,
// stay as they were; a missing file stays missing.
//
// Idempotent: once retired, neither the file nor the line is left.
//

const fs = require('fs');
const path = require('path');

const RETIRED_STORE = '.workflows/.knowledge/store.msp';
const STORE = '.workflows/.knowledge/store.bin';
const WORKTREE_INCLUDE = '.worktreeinclude';

/** @returns {boolean} there was a file to delete */
function deleteRetiredStore(projectDir) {
  try {
    fs.unlinkSync(path.join(projectDir, RETIRED_STORE));
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
}

/**
 * The lines with the retired store's line renamed to the store's, or dropped
 * where the store is already listed.
 * @param {string[]} lines
 * @returns {string[]}
 */
function retireStoreLine(lines) {
  let listed = lines.some((line) => line.trim() === STORE);
  return lines.flatMap((line) => {
    if (line.trim() !== RETIRED_STORE) return [line];
    if (listed) return [];
    listed = true;
    return [STORE];
  });
}

/** @returns {boolean} the file changed */
function retireIncludeLine(projectDir) {
  const file = path.join(projectDir, WORKTREE_INCLUDE);
  let content;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
  const retired = retireStoreLine(content.split('\n')).join('\n');
  if (retired === content) return false;
  fs.writeFileSync(file, retired);
  return true;
}

module.exports = {
  id: '063',
  description: 'retire the knowledge store\'s old file',
  run({ projectDir, reportUpdate, reportSkip }) {
    const fileDeleted = deleteRetiredStore(projectDir);
    const lineRetired = retireIncludeLine(projectDir);
    if (fileDeleted) reportUpdate();
    if (lineRetired) reportUpdate();
    if (!fileDeleted && !lineRetired) reportSkip();
  },
};
