'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a state merge's landing (4.7). The working tree moves to the
// merge's tree (state-merge-worktree.cjs), then the worktree's index, then
// the branch, only from the tip it moves from. Before the first file is
// touched, the landing is recorded in the state worktree's git directory:
// the tip it moves from, the commit it moves to, the working tree's steps,
// the paths whose index entries follow, and what the merge said. A kill
// part-way leaves the record, and whichever writer next moves the branch,
// the next catch-up or a state commit, finishes that landing first; so
// nothing a killed landing wrote is ever read or committed as this
// machine's own change. The record goes once the branch has moved, and one
// whose branch moved on regardless is dropped.
//
// The merge's context is opened here too. The branch is the caller's to
// name, so the state worktree's machinery, which finishes a landing before
// it commits, can require this module.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { isolatedGit } = require('../kernel/isolated-git.cjs');
const { READ_BUDGET_BYTES } = require('../kernel/git.cjs');
const { writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { titlecase } = require('./conventions.cjs');
const { moveWorktree, alignIndex } = require('./state-merge-worktree.cjs');

// The merge's files, in the state worktree's own git dir, beside the state
// commit's private index.
const LANDING = 'leeway-merge-landing.json';
const MERGE_INDEX = 'leeway-merge.index';
const SCRATCH = 'leeway-merge-files';
const STAGED = 'leeway-merge-staged';

/** @typedef {import('./state-merge-worktree.cjs').WorktreeContext} WorktreeContext */

/**
 * The state worktree opened for a merge: the merge's context, the
 * worktree's own git dir, and where a landing under way is recorded.
 * @typedef {WorktreeContext & {gitDir: string, landingFile: string}} LandingContext
 */

/**
 * A landing under way: the tip the branch and the working tree move from,
 * the commit they move to, the working tree's steps, the paths whose index
 * entries follow, and what the merge said on the way.
 * @typedef {{
 *   from: string,
 *   to: string,
 *   steps: import('./state-merge-worktree.cjs').Steps,
 *   aligned: string[],
 *   said: string[],
 * }} Landing
 */

/** A record the merge keeps in the git dir, or null where none is. @param {string} file @returns {any} */
function readRecord(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Open the state worktree at `root`, with `branch` checked out, for a merge.
 * @param {string} root @param {string} branch @param {{readBudgetBytes?: number}} [opts]
 * @returns {LandingContext}
 */
function openMerge(root, branch, { readBudgetBytes = READ_BUDGET_BYTES } = {}) {
  const git = isolatedGit(root);
  const [objectFormat, gitDir] = git.run(['rev-parse', '--show-object-format', '--absolute-git-dir']).trim().split('\n');
  const inGitDir = (/** @type {string} */ name) => path.join(gitDir, name);
  return {
    root,
    branch,
    git,
    objectFormat,
    gitDir,
    project: titlecase(path.basename(path.dirname(root))),
    index: inGitDir(MERGE_INDEX),
    scratch: inGitDir(SCRATCH),
    staged: inGitDir(STAGED),
    landingFile: inGitDir(LANDING),
    blobs: new Map(),
    budget: readBudgetBytes,
  };
}

/** @param {LandingContext} ctx */
function branchRef(ctx) {
  return `refs/heads/${ctx.branch}`;
}

/**
 * Make a recorded landing: the working tree's steps, then the worktree's
 * index, then the branch, only from the tip the landing moves from; then
 * the record goes.
 * @param {LandingContext} ctx @param {Landing} landing @param {boolean} resumed  whether a kill cut it short
 * @returns {string[]} the notes and warnings on the way
 */
function makeLanding(ctx, landing, resumed) {
  const moved = moveWorktree(ctx, landing.steps, resumed);
  const aligned = alignIndex(ctx, landing.to, landing.aligned);
  ctx.git.run(['update-ref', '-m', `catch up: ${landing.to}`, branchRef(ctx), landing.to, landing.from]);
  fs.rmSync(ctx.landingFile, { force: true });
  return [...landing.said, ...moved.notes, ...moved.warnings, ...aligned];
}

/**
 * Land: record the landing before the first file is touched, then make it.
 * The caller holds the writer lock.
 * @param {LandingContext} ctx @param {Landing} landing
 * @returns {string[]} the notes and warnings on the way
 */
function startLanding(ctx, landing) {
  writeJsonAtomic(ctx.landingFile, landing);
  return makeLanding(ctx, landing, false);
}

/**
 * Finish the landing a kill cut short in the state worktree at `root`,
 * where one is recorded and the branch still stands at the tip it moves
 * from; drop the record where the branch has moved on. The caller holds the
 * writer lock.
 * @param {string} root @param {string} branch @param {string} gitDir  the state worktree's own
 * @returns {string[]} the notes and warnings on the way
 */
function finishLanding(root, branch, gitDir) {
  /** @type {Landing|null} */
  const landing = readRecord(path.join(gitDir, LANDING));
  if (landing === null) return [];
  const ctx = openMerge(root, branch);
  if (ctx.git.run(['rev-parse', '--verify', '--quiet', `${branchRef(ctx)}^{commit}`]).trim() === landing.from) {
    return makeLanding(ctx, landing, true);
  }
  fs.rmSync(ctx.landingFile, { force: true });
  return [];
}

module.exports = { readRecord, openMerge, startLanding, finishLanding };
