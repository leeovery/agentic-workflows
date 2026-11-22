'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a quick-fix's worktree, held by one fix at a time (19.5.23)
// — what a fix had not committed when a question parked it set aside, so
// the next fix starts on a clean worktree, and put back when it starts
// again.
//
// - A raise that parks a fix holding the worktree — in progress, no question
//   waiting parking it yet (raise.cjs) — first sets aside what the worktree
//   holds not committed outside the state (worktree-prep.cjs,
//   `codeChanges`), in each of the project's repositories holding any: a
//   commit of it, its untracked files among it, on the tip the worktree has
//   out, at a ref of the unit's own, `refs/ledger/aside/{unit}/{task id}` —
//   never on the stash list, which every checkout shares — then each of its
//   paths back as that tip holds it, so the worktree is left clean at the
//   branch's tip for the next fix to start on. Its paths are read from each
//   checkout's top, a project that is a folder of a larger repository among
//   them. All or nothing: a step that fails undoes every part — each path
//   back in the worktree as it was, not staged, each ref it wrote dropped —
//   and the park is refused, saying so.
// - The fix's next start (task-verbs.cjs), once the worktree is laid out on
//   the branch, puts it back onto the tip as it then stands — git's own merge
//   of it from the tip it was set aside on, its change left uncommitted as
//   it was, nothing else of the index touched, and its ref dropped —
//   answering its paths as the set-aside did, a rename's both — refused,
//   nothing moved, where in any
//   repository it conflicts with what the tip now holds, naming each path,
//   the ref and the way on, in the order that works: the work seen, its
//   refs dropped, the task started, its change made again and committed.
// - A builder's or fix round's brief for the fix holding the worktree whose
//   work is set aside is refused, naming the start that puts it back
//   (brief.cjs, R27). Nothing set aside is lost: a fix closed keeps it,
//   naming it in its answer (task-verbs.cjs); a move keeps it, as it keeps
//   the fixes' commits under moved/, and a cancel keeps it too, each piece
//   named with the calls that show it, bring it into a checkout where it
//   stands and drop it, kept until the person drops it — on start this
//   work's screen before the move's yes, in its answer, at the topic's
//   first opening (enter.cjs), on the cancel's receipt and on the close's
//   screen (`keptAside`, `keptWords`, R26, 19.5.29).
// - A move's yes and a cancel set aside what the fix holding the worktree
//   had not committed as a park does, at the same ref, so the worktree is
//   taken apart clean (fix-leave.cjs); start this work's screen names it
//   before the move's yes (`asideWords`). Each piece's commit says why it
//   was set aside — a park, a move or a cancel — which `keptAside` and
//   every refusal naming it read back (`heldAside`).
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

/**
 * Why a fix's work is set aside, as its commit and every line naming it say
 * it, and what a set-aside that fails says did not happen: a question's
 * park, a move of the quick-fix, or its cancel.
 */
const WHY = Object.freeze({
  park: { why: 'when a question parked it', none: 'no question parked the fix' },
  move: { why: 'as the quick-fix moved', none: 'nothing moved' },
  cancel: { why: 'as the quick-fix was cancelled', none: 'nothing was cancelled' },
});

/** @typedef {keyof typeof WHY} Why */

/** What a set-aside commit's subject says before its why. */
const SET_ASIDE = '\'s work, set aside ';

/** The start that puts a fix's work back. @param {TaskRef} ref */
const startCall = (ref) => `engine task start ${ref.unit} ${shownTask(ref)}`;

/** Where a fix's work is set aside, in each repository holding any. @param {TaskRef} ref */
const asideRef = (ref) => `refs/ledger/aside/${ref.unit}/${taskId(ref)}`;

/** A git call in a repository as a way on names it: `git -C {folder}` in a nested one. @param {Repo} repo */
const gitIn = (repo) => (repo.dir === '' ? 'git' : `git -C ${plain(repo.dir)}`);

/** Why a fix's work was set aside, as its set-aside commit's subject says it (`WHY`). @param {string} subject */
const whyOf = (subject) => subject.slice(subject.indexOf(SET_ASIDE) + SET_ASIDE.length);

/** Each of the project's repositories holding work the fix set aside, with the commit holding it and why it was set aside. @param {string} cwd @param {TaskRef} ref */
function heldAside(cwd, ref) {
  return projectRepos(codeRoot(cwd)).flatMap((repo) => {
    const line = git(repo.path, ['for-each-ref', '--format=%(objectname)%09%(contents:subject)', asideRef(ref)]).trim();
    if (line === '') return [];
    const [sha, subject] = line.split('\t');
    return [{ repo, sha, why: whyOf(subject) }];
  });
}

/**
 * What the project holds not committed in a checkout, a part for each
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
 * the commit, its subject saying why.
 * @param {Held} held @param {TaskRef} ref @param {Why} why @returns {string}
 */
function asideCommit({ top, paths }, ref, why) {
  const env = { GIT_INDEX_FILE: gitPath(top, `ledger-aside-${process.pid}.index`) };
  try {
    git(top, ['read-tree', 'HEAD'], env);
    git(top, ['--literal-pathspecs', 'add', '--all', ...FROM_INPUT], env, paths.join('\0'));
    const tree = git(top, ['write-tree'], env).trim();
    return git(top, ['commit-tree', tree, '-p', 'HEAD', '-m', `${taskName(ref)}${SET_ASIDE}${WHY[why].why}`]).trim();
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
 * What the quick-fix's worktree, `cwd` in it, holds not committed set aside
 * for the fix parked, or holding it as the quick-fix moves or is cancelled
 * (the header's), and the worktree left clean at its tip: answers each path set aside, from the project, in
 * order, none where it held nothing. All or nothing: where any step fails,
 * every part is undone (`undone`) and the set-aside refused in the words of
 * `said`, saying so.
 * @param {string} cwd @param {TaskRef} ref @param {string} said @param {Why} [why] @returns {string[]}
 */
function setAside(cwd, ref, said, why = 'park') {
  const dirt = dirtByRepo(projectRepos(codeRoot(cwd)));
  try {
    for (const held of dirt) {
      const sha = asideCommit(held, ref, why);
      git(held.top, ['update-ref', asideRef(ref), sha, '']);
      held.sha = sha;
    }
    dirt.forEach(cleaned);
  } catch (err) {
    for (const held of dirt) undone(held, ref);
    throw new Error(`${said}: ${taskName(ref)}'s work could not be set aside, so nothing was: the worktree holds it as before, none of it staged, and ${WHY[why].none} — ${messageOf(err)}`);
  }
  return dirt.flatMap(({ shown }) => shown).sort();
}

/**
 * The fix's work set aside put back onto the branch's tip as it stands in
 * the quick-fix's worktree, `cwd` in it (the header's), its ref dropped: answers each path put back, from the
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
    throw new Error(`${said}: ${taskName(ref)}'s work, set aside ${held[0].why}, does not go back onto ${quickFixBranch(ref.unit)} as it stands — it conflicts at ${conflicts.join(', ')} — so nothing moved: it is kept at ${asideRef(ref)}; see it, ${ways}, drop it, ${drops}, start the task again, ${startCall(ref)}, then make its change again by hand and commit it through the door`);
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
  const held = heldAside(cwd, ref);
  if (held.length === 0) return null;
  return `${taskName(ref)}'s work, set aside ${held[0].why}, is not back in ${ref.unit}'s worktree — start it again first, ${startCall(ref)}, which puts it back`;
}

/**
 * Every fix of `unit` whose work is set aside, a line for each repository
 * holding it, in the tracker's order — what a move and a cancel keep
 * (R26): its task, the repository by its folder, the ref, why it was set
 * aside, as its commit says, the call that shows the work, the call that
 * brings it into the checkout as it now stands, whatever branch it has
 * out, and the call that drops it (19.5.29).
 * @param {string} cwd @param {string} unit @returns {Kept[]}
 */
function keptAside(cwd, unit) {
  return projectRepos(codeRoot(cwd)).flatMap((repo) => git(repo.path, ['for-each-ref', '--format=%(refname)%09%(contents:subject)', `refs/ledger/aside/${unit}/`]).split('\n').filter(Boolean)
    .map((line) => {
      const [name, subject] = line.split('\t');
      return { ref: parseTaskId(name.slice(name.lastIndexOf('/') + 1)), repo, name, why: whyOf(subject) };
    }))
    .sort((a, b) => a.ref.phase - b.ref.phase || a.ref.n - b.ref.n)
    .map(({ ref, repo, name, why }) => ({ task: shownTask(ref), repo: repoName(repo), ref: name, why, ...calls(repo, name) }));
}

/** The calls that show a piece of a fix's work set aside at `name` in `repo`, bring it into the checkout, and drop it. @param {Repo} repo @param {string} name */
const calls = (repo, name) => ({ see: `${gitIn(repo)} diff ${name}^ ${name}`, recover: `${gitIn(repo)} cherry-pick --no-commit ${name}`, drop: `${gitIn(repo)} update-ref -d ${name}` });

/** Where a repository is, as the person reads it. @param {string} repo its folder, `.` the project's own */
const keptIn = (repo) => (repo === '.' ? 'in the project\'s repository' : `in ${repo}`);

/** @typedef {{task: string, repo: string, ref: string, why: string, see: string, recover: string, drop: string}} Kept */

/** A fix's kept work as the person reads it, wherever it is named (`keptAside`). @param {Kept} kept */
const keptWords = ({ task, repo, ref, why, see, recover, drop }) => `Task ${task}'s work, set aside ${why}, is kept ${keptIn(repo)} at ${ref} — see it with ${see}; bring it into the checkout with ${recover}, settling any conflict; drop it with ${drop}`;

/**
 * What the quick-fix's worktree, `cwd` in it, holds not committed for the
 * fix holding it, which a move's yes sets aside (the header's), as start
 * this work's screen names it before the yes: a line for each repository
 * holding any, none where it holds nothing.
 * @param {string} cwd @param {TaskRef} ref @returns {string[]}
 */
function asideWords(cwd, ref) {
  const name = asideRef(ref);
  return dirtByRepo(projectRepos(codeRoot(cwd))).map(({ repo, shown }) => {
    const { see, recover, drop } = calls(repo, name);
    return `Task ${shownTask(ref)}'s work not committed — ${shown.join(', ')} — is set aside as the quick-fix moves and kept ${keptIn(repoName(repo))} at ${name} — see it then with ${see}; bring it into the checkout with ${recover}, settling any conflict; drop it then with ${drop}`;
  });
}

module.exports = { asideRef, heldAside, setAside, putBack, asideRefusal, keptAside, keptWords, asideWords };
