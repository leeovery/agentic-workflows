'use strict';

//
// Migration 064: Untrack the knowledge directory
//
// The knowledge directory (.workflows/.knowledge/) is local to each
// checkout and git-ignored (060), so git tracks nothing under it. Where git
// still tracks files there, their removal is staged — `git rm -r --cached`,
// every file left on disk, content staged over them included — and nothing
// else in the index is touched. A migration stages and never commits: the
// reviewed migration commit records the removal with the rest of the run,
// and 060's rule keeps the files from being staged again.
//
// Outside a git work tree, or where git cannot run, there is nothing to
// untrack and the run skips.
//
// Idempotent: once staged, git tracks nothing there.
//

const { spawnSync } = require('child_process');

const KNOWLEDGE_DIR = '.workflows/.knowledge';

/**
 * @param {string} projectDir @param {string[]} args
 * @returns {{ok: boolean, stdout: string, stderr: string}}
 */
function git(projectDir, args) {
  const res = spawnSync('git', args, { cwd: projectDir, encoding: 'utf8' });
  return { ok: !res.error && res.status === 0, stdout: res.stdout || '', stderr: res.stderr || '' };
}

/** The stdout of a git call that must succeed. @param {string} projectDir @param {string[]} args */
function mustGit(projectDir, args) {
  const res = git(projectDir, args);
  if (!res.ok) throw new Error(`git ${args[0]} failed: ${res.stderr.trim()}`);
  return res.stdout;
}

/** @param {string} projectDir */
function tracksKnowledge(projectDir) {
  const inside = git(projectDir, ['rev-parse', '--is-inside-work-tree']);
  if (!inside.ok || inside.stdout.trim() !== 'true') return false;
  return mustGit(projectDir, ['ls-files', '--', KNOWLEDGE_DIR]).trim() !== '';
}

module.exports = {
  id: '064',
  description: 'untrack the knowledge directory',
  run({ projectDir, reportUpdate, reportSkip }) {
    if (!tracksKnowledge(projectDir)) {
      reportSkip();
      return;
    }
    mustGit(projectDir, ['rm', '-r', '--cached', '-f', '-q', '--', KNOWLEDGE_DIR]);
    reportUpdate();
  },
};
