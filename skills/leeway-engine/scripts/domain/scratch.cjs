'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a reviewer's scratch worktree — where the build's reviewers,
// a phase's among them, and the review phase's readers run the tests, make
// a break and run the product, never in a checkout of the work (13.2,
// 14.2.2). Each brief dispatching one names its layout and the two calls
// below, filled in, run from the project's checkout (brief-records.cjs).
//
// - `scratch lay <name> <commit> [<folder>=<commit> …]`: the project laid
//   out afresh in a worktree of its own, `name`'s, beside the builders'
//   isolation worktrees (project-layout.cjs, `scratchTop`), whatever was
//   laid out under that name before taken apart first: the project's own
//   repository at the first commit, each child repository at the commit
//   given for its folder, every one detached and nested as the project
//   lays them out, and each prepared as Claude Code prepares an isolation
//   worktree — the `.worktreeinclude` files copied and the
//   `worktree.symlinkDirectories` linked (worktree-prep.cjs) — so the
//   project's tests and its verify setup run there as in its checkout. It
//   answers the project's folder there. Refused where a repository of the
//   project is given no commit, or a folder is given twice or is none of
//   its child repositories'; and where a repository has no commit of the
//   one given.
// - `scratch remove <name>`: that worktree taken apart, each repository's
//   registration of it with it; one not there passes.
//
// Neither writes the state.
// ---------------------------------------------------------------------------

const { tryGit } = require('../kernel/git.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { projectRepos } = require('../kernel/repos.cjs');
const { layOutCommits, scratchTop, takeApart } = require('./project-layout.cjs');
const { refusing } = require('./staged-payload.cjs');
const { repoNamed } = require('./phase-stack.cjs');

/** @typedef {import('../kernel/repos.cjs').Repo} Repo */

const SCRATCH_USAGE = [
  'scratch lay <name> <commit> [<folder>=<commit> …]',
  'scratch remove <name>',
].join('\n');

/** A scratch worktree's name: lowercase words, digits, dots and dashes. */
const NAME = /^[a-z0-9][a-z0-9.-]*$/;

/**
 * Each repository's commit, in full, by its folder: the project's own the
 * first given, each child's by `{folder}={commit}`; refused as the header
 * says.
 * @param {Repo[]} repos @param {string} own @param {string[]} children
 * @returns {Map<string, string>}
 */
function commitsGiven(repos, own, children) {
  /** @type {Map<string, string>} */
  const given = new Map([['', own]]);
  for (const pair of children) {
    const at = pair.indexOf('=');
    const [folder, commit] = at === -1 ? [pair, ''] : [pair.slice(0, at), pair.slice(at + 1)];
    if (folder === '' || commit === '') throw new Error(`"${pair}" names no child repository's commit — each is <folder>=<commit>`);
    if (!repos.some((repo) => repo.dir === folder)) throw new Error(`${folder} is no child repository of the project's`);
    if (given.has(folder)) throw new Error(`${folder} is given a commit twice`);
    given.set(folder, commit);
  }
  const missing = repos.filter((repo) => !given.has(repo.dir)).map((repo) => repo.dir);
  if (missing.length > 0) throw new Error(`no commit is given for ${missing.join(', ')} — every repository of the project is laid out, each <folder>=<commit>`);
  return new Map(repos.map((repo) => {
    const commit = tryGit(repo.path, ['rev-parse', '-q', '--verify', `${given.get(repo.dir)}^{commit}`])?.trim();
    if (commit === undefined) throw new Error(`${repoNamed(repo)} has no commit ${given.get(repo.dir)}`);
    return [repo.dir, commit];
  }));
}

/** The project's repositories, and the top of the scratch worktree `name` names. @param {string} cwd @param {string} name */
function scratchOf(cwd, name) {
  if (!NAME.test(name)) throw new Error(`"${name}" is no scratch worktree's name — lowercase words, digits, dots and dashes`);
  const repos = projectRepos(codeRoot(cwd));
  return { repos, top: scratchTop(repos[0], `scratch-${name}`) };
}

/** `scratch lay`. @param {string} cwd @param {string} name @param {string} own @param {string[]} children */
function layScratch(cwd, name, own, children) {
  const { repos, top } = scratchOf(cwd, name);
  const commits = commitsGiven(repos, own, children);
  takeApart(repos, top);
  const [project] = layOutCommits(repos[0].path, repos, commits, top);
  return { name, path: project.path };
}

/** `scratch remove`. @param {string} cwd @param {string} name */
function removeScratch(cwd, name) {
  const { repos, top } = scratchOf(cwd, name);
  takeApart(repos, top);
  return { name, removed: true };
}

/**
 * `scratch lay|remove`: the verb's answer, its refusal opening on its
 * command.
 * @param {string} cwd @param {string[]} positional @param {Record<string, string>} opts
 * @returns {Record<string, unknown>}
 */
function runScratchVerb(cwd, [verb, name, ...rest], opts) {
  const flagless = Object.keys(opts).length === 0;
  if (verb === 'lay' && name !== undefined && rest.length > 0 && flagless) return refusing('scratch lay', () => layScratch(cwd, name, rest[0], rest.slice(1)));
  if (verb === 'remove' && name !== undefined && rest.length === 0 && flagless) return refusing('scratch remove', () => removeScratch(cwd, name));
  throw new Error(`Usage: ${SCRATCH_USAGE.split('\n').map((line) => `engine ${line}`).join(' | ')}`);
}

module.exports = { SCRATCH_USAGE, runScratchVerb };
