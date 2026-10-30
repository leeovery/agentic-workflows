'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the code change, read across every repo in the project
// (kernel/repos) — what the prose and the agents would otherwise read with
// raw git in the root, which sees nothing of a repo nested in it. Paths in
// and out are the project's, whichever repo holds the code; a root inside a
// larger repository reads only the project's folder of it. In a project of
// one repo each read answers what git answers there.
//
// A selector picks commits by subject: those opening with a prefix, or a
// topic's task commits — `impl({work_unit}): T` and an internal id of that
// topic, so a sibling topic whose name extends it (`auth`, `auth-flow`) is
// never caught. Each repo holding one has a base — the parent of its
// earliest, the empty tree where that is the repo's first commit — and the
// change since is the range from the base to the repo's HEAD, confined to
// the files those commits touched, a submodule's pointer never among them.
// The uncommitted change is each repo's change against HEAD (the empty tree
// before its first commit), its untracked files read as additions, held out
// as the dirt is. A diff names every path from the project, a move as a
// deletion and an addition, one patch per repo in repo order. Nothing is
// written.
// ---------------------------------------------------------------------------

const {
  commitsBySubject, parentOrEmptyTree, emptyTree, hasCommits, diffPatch, diffWithUntracked, literally,
} = require('../kernel/git.cjs');
const { projectRepos, repoName, projectPath, codeHeldOut, projectDirtyEntries } = require('../kernel/repos.cjs');
const { stepOfId } = require('./task-id.cjs');

/** @typedef {import('../kernel/repos.cjs').Repo} Repo */
/** @typedef {{sha: string, subject: string, paths: string[]}} Commit */

/**
 * Which commits a read takes: `grep` narrows git's walk as a fixed string,
 * `selects` decides on the whole subject.
 * @typedef {{grep: string, selects: (subject: string) => boolean}} Selector
 */

/**
 * The commits whose subject opens with `prefix`.
 * @param {string} prefix
 * @returns {Selector}
 */
function subjectSelector(prefix) {
  return { grep: prefix, selects: (subject) => subject.startsWith(prefix) };
}

/**
 * A topic's task commits — `impl({work_unit}): T{internal id}`, the id one of
 * the topic's (`{topic}-{phase}-{task}`) and ending where the subject does or
 * at a character no id continues with, neither a word character nor `-` —
 * and with `phase`, only that phase's.
 * @param {string} workUnit @param {string} topic @param {number} [phase]
 * @returns {Selector}
 */
function taskSelector(workUnit, topic, phase) {
  const opening = `impl(${workUnit}): T${topic}-`;
  return {
    grep: opening,
    selects: (subject) => {
      if (!subject.startsWith(opening)) return false;
      const id = `${topic}-${subject.slice(opening.length).split(/[^\w-]/)[0]}`;
      const step = stepOfId(id);
      return step !== null && step.prefix === topic && (phase === undefined || step.phase === phase);
    },
  };
}

/**
 * Each repo's selected commits, oldest first, and its base. A repo with none
 * is left out. A submodule's pointer is the submodule's change, never its
 * parent's: a commit that recorded nothing else is not one of the parent's.
 * @param {Repo[]} repos @param {Selector} selector
 * @returns {{repo: Repo, commits: Commit[], base: string}[]}
 */
function matchedByRepo(repos, selector) {
  return repos.flatMap((repo) => {
    const commits = commitsBySubject(repo.path, selector.grep, selector.selects, repo.submodules);
    return commits.length === 0 ? [] : [{ repo, commits, base: parentOrEmptyTree(repo.path, commits[0].sha) }];
  });
}

/**
 * The files the commits touched, as their repo names them, each once.
 * @param {Commit[]} commits
 * @returns {string[]}
 */
function touched(commits) {
  return [...new Set(commits.flatMap((commit) => commit.paths))];
}

/**
 * The options that name a repo's diff from the project: `--relative`
 * confines a root inside a larger repository to the project's folder, and a
 * move reads as a deletion and an addition, so both its paths carry the
 * repo's folder.
 * @param {Repo} repo
 * @returns {string[]}
 */
function projectDiffOptions(repo) {
  const prefix = projectPath(repo.dir, '');
  return ['--relative', '--no-renames', `--src-prefix=a/${prefix}`, `--dst-prefix=b/${prefix}`];
}

/**
 * The selected commits across the project: each with its repo (`.` the
 * root), grouped in repo order, oldest first within each; the project paths
 * they touched, sorted; and each repo's base.
 * @param {string} cwd @param {Selector} selector
 * @returns {{commits: {repo: string, sha: string, subject: string}[], files: string[], repos: {repo: string, base: string}[]}}
 */
function codeLog(cwd, selector) {
  const matched = matchedByRepo(projectRepos(cwd), selector);
  return {
    commits: matched.flatMap(({ repo, commits }) => commits.map(({ sha, subject }) => ({ repo: repoName(repo), sha, subject }))),
    files: matched.flatMap(({ repo, commits }) => touched(commits).map((p) => projectPath(repo.dir, p))).sort(),
    repos: matched.map(({ repo, base }) => ({ repo: repoName(repo), base })),
  };
}

/**
 * The change the selected commits made: each repo's diff from its base to
 * HEAD, confined to the files they touched.
 * @param {string} cwd @param {Selector} selector
 * @returns {string} the unified diff, '' when there is none
 */
function selectedDiff(cwd, selector) {
  return matchedByRepo(projectRepos(cwd), selector)
    .map(({ repo, commits, base }) => diffPatch(repo.path, [...projectDiffOptions(repo), base, 'HEAD', '--', ...literally(touched(commits))]))
    .join('');
}

/**
 * The change not yet committed: each repo's tracked change and its untracked
 * files as additions, in one patch per repo.
 * @param {string} cwd
 * @returns {string} the unified diff, '' when there is none
 */
function uncommittedDiff(cwd) {
  return projectRepos(cwd)
    .map((repo) => diffWithUntracked(repo.path, hasCommits(repo.path) ? 'HEAD' : emptyTree(repo.path),
      projectDiffOptions(repo), codeHeldOut(repo)))
    .join('');
}

/**
 * The uncommitted files across the project, each with its porcelain status.
 * @param {string} cwd
 * @returns {{files: {path: string, status: string}[]}}
 */
function codeStatus(cwd) {
  return { files: projectDirtyEntries(projectRepos(cwd)) };
}

module.exports = { subjectSelector, taskSelector, codeLog, selectedDiff, uncommittedDiff, codeStatus };
