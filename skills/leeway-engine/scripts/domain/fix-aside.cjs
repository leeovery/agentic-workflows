'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a quick-fix's one checkout, held by one fix at a time
// (19.5.23) — what a fix had not committed when a question parked it set
// aside, so the next fix starts on a clean checkout, and put back when it
// starts again.
//
// - A raise that parks a fix holding the checkout — in progress, no question
//   waiting parking it yet (raise.cjs) — first sets aside what the checkout
//   holds not committed outside the state (worktree-prep.cjs,
//   `codeChanges`), in each of the project's repositories holding any: a
//   commit of it, its untracked files among it, on the tip the checkout has
//   out, at a ref of the unit's own, `refs/leeway/aside/{unit}/{task id}` —
//   never on the stash list, which every checkout shares — then each of its
//   paths back as that tip holds it, so the checkout is left clean at the
//   branch's tip for the next fix to start on. Its paths are read from each
//   checkout's top, a project that is a folder of a larger repository among
//   them. All or nothing: a step that fails undoes every part — each path
//   back in the checkout as it was, not staged, each ref it wrote dropped —
//   and the park is refused, saying so.
// - The fix's next start (task-verbs.cjs), once the checkout is on the
//   branch, puts it back onto the tip as it then stands — git's own merge
//   of it from the tip it was set aside on, its change left uncommitted as
//   it was, nothing else of the index touched, and its ref dropped —
//   answering its paths as the set-aside did, a rename's both — refused,
//   nothing moved, where in any
//   repository it conflicts with what the tip now holds, naming each path,
//   the ref and the way on, in the order that works: the work seen, its
//   refs dropped, the task started, its change made again and committed.
// - A builder's or fix round's brief for the fix holding the checkout whose
//   work is set aside is refused, naming the start that puts it back
//   (brief.cjs, R27). Nothing set aside is lost: a fix closed keeps it,
//   naming it in its answer (task-verbs.cjs); a move keeps it, as it keeps
//   the fixes' commits under moved/, and a cancel keeps it too, each piece
//   named with the calls that show it and bring it into the checkout where
//   it stands — on start this work's screen before the move's yes, in its
//   answer, at the topic's first opening (enter.cjs) and on the cancel's
//   receipt (`keptAside`, `keptWords`, R26).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { codeRoot } = require('../kernel/code-root.cjs');
const { git, tryGit, gitPath } = require('../kernel/git.cjs');
const { projectRepos, repoOf, repoPath, repoName, projectPath, topPath, folderPath, checkoutTop } = require('../kernel/repos.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { codeChanges } = require('./worktree-prep.cjs');
const { mergeTree, plain } = require('./landing-git.cjs');
const { quickFixBranch } = require('./landing-names.cjs');
const { taskId, parseTaskId, taskName, shownTask } = require('./task-id.cjs');

/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */
/** @typedef {import('../kernel/repos.cjs').Repo} Repo */

/** The start that puts a fix's work back. @param {TaskRef} ref */
const startCall = (ref) => `engine task start ${ref.unit} ${shownTask(ref)}`;

/** Where a fix's work is set aside, in each repository holding any. @param {TaskRef} ref */
const asideRef = (ref) => `refs/leeway/aside/${ref.unit}/${taskId(ref)}`;

/** A git call in a repository as a way on names it: `git -C {folder}` in a nested one. @param {Repo} repo */
const gitIn = (repo) => (repo.dir === '' ? 'git' : `git -C ${plain(repo.dir)}`);

/** Each of the project's repositories holding work the fix set aside, with the commit holding it. @param {string} cwd @param {TaskRef} ref */
function heldAside(cwd, ref) {
  return projectRepos(codeRoot(cwd)).flatMap((repo) => {
    const sha = tryGit(repo.path, ['rev-parse', '-q', '--verify', `${asideRef(ref)}^{commit}`])?.trim();
    return sha === undefined ? [] : [{ repo, sha }];
  });
}

/**
 * What the project's checkout holds not committed, a part for each
 * repository holding any: its checkout's top, and each path as that top
 * names it — a project that is a folder of a larger repository reads its
 * paths from there — and as the project names it.
 * @param {Repo[]} repos @returns {Held[]}
 */
function dirtByRepo(repos) {
  /** @type {Map<Repo, string[]>} */
  const by = new Map();
  for (const { path: at } of codeChanges(repos, { renames: false })) {
    const repo = repoOf(repos, at);
    by.set(repo, [...(by.get(repo) ?? []), repoPath(repo, at)]);
  }
  return [...by].map(([repo, paths]) => ({
    repo, top: checkoutTop(repo, repo.path), paths: paths.map((at) => topPath(repo, at)), shown: paths.map((at) => projectPath(repo.dir, at)),
  }));
}

/**
 * A part of the checkout held not committed (`dirtByRepo`), and the commit
 * keeping it once made.
 * @typedef {{repo: Repo, top: string, paths: string[], shown: string[], sha?: string}} Held
 */

/** The flags a git call takes its paths on its input by, NUL-separated. */
const FROM_INPUT = Object.freeze(['--pathspec-from-file=-', '--pathspec-file-nul']);

/**
 * The part's paths committed on its HEAD, its untracked files among them,
 * through an index of its own, touching neither the checkout nor its index:
 * the commit.
 * @param {Held} held @param {TaskRef} ref @returns {string}
 */
function asideCommit({ top, paths }, ref) {
  const env = { GIT_INDEX_FILE: gitPath(top, `leeway-aside-${process.pid}.index`) };
  try {
    git(top, ['read-tree', 'HEAD'], env);
    git(top, ['--literal-pathspecs', 'add', '--all', ...FROM_INPUT], env, paths.join('\0'));
    const tree = git(top, ['write-tree'], env).trim();
    return git(top, ['commit-tree', tree, '-p', 'HEAD', '-m', `${taskName(ref)}'s work, set aside when a question parked it`]).trim();
  } finally {
    fs.rmSync(env.GIT_INDEX_FILE, { force: true });
  }
}

/** Each of the part's paths back as its HEAD holds it, one HEAD lacks removed. @param {Held} held */
function cleaned({ top, paths }) {
  const tracked = paths.filter((at) => tryGit(top, ['cat-file', '-e', `HEAD:${at}`]) !== null);
  if (tracked.length > 0) git(top, ['--literal-pathspecs', 'restore', '--source=HEAD', '--staged', '--worktree', ...FROM_INPUT], undefined, tracked.join('\0'));
  const added = paths.filter((at) => !tracked.includes(at));
  if (added.length > 0) git(top, ['--literal-pathspecs', 'rm', '-r', '-q', '--cached', '--ignore-unmatch', ...FROM_INPUT], undefined, added.join('\0'));
  for (const at of added) fs.rmSync(path.join(top, at), { recursive: true, force: true });
}

/**
 * A set-aside that failed undone, part by part, as far as it went: each
 * path back in the checkout as the part's commit holds it — not staged —
 * and the ref it wrote dropped. Each step is tried alone, so a part the
 * set-aside never reached is passed over.
 * @param {Held} held @param {TaskRef} ref
 */
function undone({ top, paths, sha }, ref) {
  if (sha === undefined) return;
  try {
    git(top, ['--literal-pathspecs', 'restore', `--source=${sha}`, '--worktree', ...FROM_INPUT], undefined, paths.join('\0'));
  } catch {
    // a part whose paths were never cleaned holds them as they were
  }
  tryGit(top, ['update-ref', '-d', asideRef(ref), sha]);
}

/**
 * What the checkout holds not committed set aside for the fix parked (the
 * header's), and the checkout left clean at its tip: answers each path set
 * aside, from the project, in order, none where it held nothing. All or
 * nothing: where any step fails, every part is undone (`undone`) and the
 * set-aside refused in the words of `said`, saying so.
 * @param {string} cwd @param {TaskRef} ref @param {string} said @returns {string[]}
 */
function setAside(cwd, ref, said) {
  const dirt = dirtByRepo(projectRepos(codeRoot(cwd)));
  try {
    for (const held of dirt) {
      const sha = asideCommit(held, ref);
      git(held.top, ['update-ref', asideRef(ref), sha, '']);
      held.sha = sha;
    }
    dirt.forEach(cleaned);
  } catch (err) {
    for (const held of dirt) undone(held, ref);
    throw new Error(`${said}: ${taskName(ref)}'s work could not be set aside, so nothing was: the checkout holds it as before, none of it staged, and no question parked the fix — ${messageOf(err)}`);
  }
  return dirt.flatMap(({ shown }) => shown).sort();
}

/**
 * The fix's work set aside put back onto the branch's tip as it stands
 * (the header's), its ref dropped: answers each path put back, from the
 * project — refused in the words of `said`, nothing moved, where it
 * conflicts in any repository, its way on in the order that works: the
 * work seen, its refs dropped, the task started, its change made again.
 * @param {string} cwd @param {TaskRef} ref @param {string} said @returns {string[]}
 */
function putBack(cwd, ref, said) {
  const held = heldAside(cwd, ref).map((aside) => ({ ...aside, merged: mergeTree(aside.repo.path, `${aside.sha}^`, 'HEAD', aside.sha) }));
  const conflicts = held.flatMap(({ repo, merged }) => ('conflicts' in merged ? merged.conflicts.map((at) => projectPath(repo.dir, at)) : []));
  if (conflicts.length > 0) {
    const ways = held.map(({ repo }) => `\`${gitIn(repo)} diff ${asideRef(ref)}^ ${asideRef(ref)}\``).join(', ');
    const drops = held.map(({ repo }) => `\`${gitIn(repo)} update-ref -d ${asideRef(ref)}\``).join(', ');
    throw new Error(`${said}: ${taskName(ref)}'s work, set aside when a question parked it, does not go back onto ${quickFixBranch(ref.unit)} as it stands — it conflicts at ${conflicts.join(', ')} — so nothing moved: it is kept at ${asideRef(ref)}; see it, ${ways}, drop it, ${drops}, start the task again, ${startCall(ref)}, then make its change again by hand and commit it through the door`);
  }
  return held.flatMap(({ repo, sha, merged }) => {
    const top = checkoutTop(repo, repo.path);
    const paths = git(top, ['diff', '--name-only', '--no-renames', '-z', `${sha}^`, sha]).split('\0').filter(Boolean);
    git(repo.path, ['read-tree', '-m', '-u', 'HEAD', /** @type {{tree: string}} */ (merged).tree]);
    git(top, ['--literal-pathspecs', 'reset', '-q', ...FROM_INPUT], undefined, paths.join('\0'));
    git(repo.path, ['update-ref', '-d', asideRef(ref), sha]);
    return paths.map((at) => projectPath(repo.dir, folderPath(repo, at) ?? at));
  });
}

/**
 * Why a brief for the fix waits, or null: its work is set aside, and its
 * start puts it back.
 * @param {string} cwd @param {TaskRef} ref @returns {string|null}
 */
function asideRefusal(cwd, ref) {
  if (heldAside(cwd, ref).length === 0) return null;
  return `${taskName(ref)}'s work, set aside when a question parked it, is not back in the checkout — start it again first, ${startCall(ref)}, which puts it back`;
}

/**
 * Every fix of `unit` whose work is set aside, a line for each repository
 * holding it, in the tracker's order — what a move and a cancel keep
 * (R26): its task, the repository by its folder, the ref, the call that
 * shows the work, and the call that brings it into the checkout as it now
 * stands, whatever branch it has out.
 * @param {string} cwd @param {string} unit @returns {Kept[]}
 */
function keptAside(cwd, unit) {
  return projectRepos(codeRoot(cwd)).flatMap((repo) => git(repo.path, ['for-each-ref', '--format=%(refname)', `refs/leeway/aside/${unit}/`]).split('\n').filter(Boolean)
    .map((ref) => ({ ref: parseTaskId(ref.slice(ref.lastIndexOf('/') + 1)), repo, name: ref })))
    .sort((a, b) => a.ref.phase - b.ref.phase || a.ref.n - b.ref.n)
    .map(({ ref, repo, name }) => ({
      task: shownTask(ref), repo: repoName(repo), ref: name, see: `${gitIn(repo)} diff ${name}^ ${name}`, recover: `${gitIn(repo)} cherry-pick --no-commit ${name}`,
    }));
}

/** @typedef {{task: string, repo: string, ref: string, see: string, recover: string}} Kept */

/** A fix's kept work as the person reads it, wherever it is named (`keptAside`). @param {Kept} kept */
const keptWords = ({ task, repo, ref, see, recover }) => `Task ${task}'s work, set aside when a question parked it, is kept ${repo === '.' ? 'in the project\'s repository' : `in ${repo}`} at ${ref} — see it with ${see}; bring it into the checkout with ${recover}, settling any conflict`;

module.exports = { asideRef, heldAside, setAside, putBack, asideRefusal, keptAside, keptWords };
