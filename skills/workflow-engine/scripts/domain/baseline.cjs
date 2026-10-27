'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the project baseline — the one home for reading the project
// manifest's `baseline` object. Boot's status field, the start menus'
// resume/manage rows, and the render surfaces all derive from this state, so
// the vocabulary and the remaining-count exist exactly once. Two more things
// live here: the signal boot attaches while nothing is recorded — the
// project's own account of what came before the workflows, read from every
// repo in it (kernel/repos) and handed to the one-time judgment as evidence
// to read rather than a number to threshold — and the verdict write, one
// state commit.
// ---------------------------------------------------------------------------

const { git, GitError, hasCommits } = require('../kernel/git.cjs');
const { projectRepos, projectPath } = require('../kernel/repos.cjs');
const { readProjectManifest, withProjectLock, writeProjectManifestAtomic } = require('../kernel/manifest.cjs');
const { commitStateScoped, noteIfNothingCommitted, PROJECT_MANIFEST_SPEC, WORKTREE_INCLUDE } = require('./commit.cjs');
const { findStateRoot } = require('../kernel/state-root.cjs');
const { isolatedGit } = require('../kernel/isolated-git.cjs');

/** The statuses a project manifest records; `none` is their absence. */
const RECORDED_STATUSES = /** @type {const} */ (['native', 'in-progress', 'completed', 'skipped']);
/** The two verdicts workflow-start's judgment can record. */
const VERDICTS = /** @type {const} */ (['native', 'skipped']);

/** @typedef {'none' | typeof RECORDED_STATUSES[number]} BaselineStatus */
/** @typedef {typeof VERDICTS[number]} BaselineVerdict */

/**
 * @typedef {object} BaselineState
 * @property {BaselineStatus} status
 * @property {{name: string, status: string}[]} areas  registration order
 * @property {number} remaining  areas not yet completed (0 unless in-progress)
 */

/**
 * @typedef {object} BaselineSignal
 * @property {string} root_date  author date of the earliest first commit across the project's repos (YYYY-MM-DD)
 * @property {string|null} workflows_date  author date of the state's first commit — null when the state holds none yet, so the whole history predates the workflows
 * @property {number} commits_total  every commit reachable from HEAD, summed across the repos — a project inside a larger repository counting the commits that touched its folder, a shallow nested clone none
 * @property {number} commits_before  the commits before the arrival, summed: each repo's last commit made before the state's first commit and that commit's ancestors (each whole history when the state holds no commit)
 * @property {string[]} history_before  those commits as `date  subject`, oldest first across the repos — the head and tail kept around an elision line when the run is long
 * @property {number} files_at_arrival  project files (outside `.claude/`, `.worktreeinclude` aside) in the trees the workflows arrived into — each repo's at its last commit before the arrival; HEAD's trees when the state holds no commit
 * @property {string[]} tree_at_arrival  that tree's top-level shape, named from the project: `dir/ (n)` and root files, largest first, elided past a dozen
 */

/**
 * Read the project baseline state. Anything other than a recorded status —
 * including a missing or corrupt project manifest, or a malformed field
 * shape — reads `none` with no areas: the nothing-recorded state the
 * one-time judgment keys on. Corruption surfaces loudly at the first
 * manifest write, not here — boot and the menus must stay usable.
 * @param {string} cwd
 * @returns {BaselineState}
 */
function baselineState(cwd) {
  /** @type {Record<string, any>} */
  let manifest = {};
  try {
    manifest = readProjectManifest(cwd);
  } catch (_) {
    return { status: 'none', areas: [], remaining: 0 };
  }
  const b = manifest && manifest.baseline;
  const raw = b && typeof b === 'object' && !Array.isArray(b) && typeof b.status === 'string' ? b.status : 'none';
  if (!RECORDED_STATUSES.includes(/** @type {typeof RECORDED_STATUSES[number]} */ (raw))) {
    return { status: 'none', areas: [], remaining: 0 };
  }
  const status = /** @type {BaselineStatus} */ (raw);
  const areasObj = b.areas && typeof b.areas === 'object' && !Array.isArray(b.areas) ? b.areas : {};
  const areas = Object.entries(areasObj)
    .filter(([, s]) => typeof s === 'string')
    .map(([name, s]) => ({ name, status: /** @type {string} */ (s) }));
  const remaining = status === 'in-progress' ? areas.filter((a) => a.status !== 'completed').length : 0;
  return { status, areas, remaining };
}

// --- the signal -------------------------------------------------------------

const HISTORY_HEAD = 8;
const HISTORY_TAIL = 4;
const TREE_ENTRIES = 12;

/** @typedef {import('../kernel/repos.cjs').Repo} Repo */

/**
 * A commit as `date  subject`, timed by its author date.
 * @typedef {{time: number, row: string}} TimedRow
 */

/**
 * One repo's account, bounded by the workflows' arrival: its commits, its
 * first commit's date, the commits before the arrival and the files, in
 * project paths, of the tree the workflows arrived into.
 * @typedef {object} RepoAccount
 * @property {number} commits
 * @property {string|null} rootDate
 * @property {TimedRow[]} history  oldest first
 * @property {string[]} files
 */

/**
 * The revisions bounding a repo's account: `before` the last commit before
 * the workflows arrived, `tree` the commit whose tree they arrived into —
 * either null where there is none.
 * @typedef {{before: string|null, tree: string|null}} Cut
 */

/** Non-empty lines of a git listing. Throws when the read fails. @param {string} cwd @param {string[]} args @returns {string[]} */
function gitLines(cwd, args) {
  return git(cwd, args).split('\n').map((l) => l.trim()).filter(Boolean);
}

/** @param {string} cwd @param {string} rev @param {string[]} scope @returns {number} */
function countOf(cwd, rev, scope) {
  return parseInt(git(cwd, ['rev-list', '--count', rev, ...scope]), 10);
}

/** @param {string} cwd @returns {boolean} */
function isShallow(cwd) {
  return git(cwd, ['rev-parse', '--is-shallow-repository']).trim() === 'true';
}

/**
 * The pathspec a repo's history is read through: none at a repository's
 * top, and the folder itself for a project inside a larger repository, so
 * its history is the commits that touched the project.
 * @param {string} cwd
 * @returns {string[]}
 */
function scopeOf(cwd) {
  return git(cwd, ['rev-parse', '--show-prefix']).trim() === '' ? [] : ['--', '.'];
}

/**
 * The author date of the history's first commit: the repository's root
 * commit, or under a scope the first commit that touched it. Null when
 * there is none.
 * @param {string} cwd @param {string[]} scope
 * @returns {string|null}
 */
function firstDate(cwd, scope) {
  const roots = scope.length === 0 ? ['--max-parents=0'] : [];
  const [date] = gitLines(cwd, ['log', '--no-show-signature', ...roots, '--reverse', '--format=%as', 'HEAD', ...scope]);
  return date ?? null;
}

/** @param {number[]} values @returns {number} */
function sum(values) {
  return values.reduce((total, n) => total + n, 0);
}

/**
 * The state's first commit — its author date and committer time — or null
 * when the state holds none yet. Read in the state worktree, isolated.
 * @param {string} cwd
 * @returns {{date: string, time: string}|null}
 */
function arrivalIn(cwd) {
  const state = findStateRoot(cwd);
  if (state === null) return null;
  const out = isolatedGit(state).tryRun(['log', '--no-show-signature', '--max-parents=0', '--format=%as%x09%ct', 'HEAD']);
  const [first] = (out || '').split('\n').filter(Boolean);
  if (first === undefined) return null;
  const [date, time] = first.split('\t');
  return { date, time };
}

/**
 * Where the arrival cuts a repo: at the commit its branch stood on when the
 * state took its first commit — the last on its first-parent line made
 * before that second, so a side branch merged afterwards is never history
 * before it. A commit in the arrival's own second is the arrival's: the
 * setup boot commits its ignore line and hooks in it. No state commit means
 * the workflows are arriving now, into HEAD's tree, and the whole history
 * came before them.
 * @param {string} cwd @param {{time: string}|null} arrival
 * @returns {Cut}
 */
function cutAt(cwd, arrival) {
  if (arrival === null) return { before: 'HEAD', tree: 'HEAD' };
  const last = git(cwd, ['rev-list', '-1', '--first-parent', `--before=@${Number(arrival.time) - 1}`, 'HEAD']).trim() || null;
  return { before: last, tree: last };
}

/**
 * The commits reachable from `rev` under the scope, oldest first.
 * @param {string} cwd @param {string} rev @param {string[]} scope @returns {TimedRow[]}
 */
function historyOf(cwd, rev, scope) {
  return gitLines(cwd, ['log', '--no-show-signature', '--reverse', '--format=%at%x09%as%x09%s', rev, ...scope]).map((line) => {
    const tab = line.indexOf('\t');
    return { time: Number(line.slice(0, tab)), row: line.slice(tab + 1).replace('\t', '  ') };
  });
}

/**
 * The files of the repo's tree at `rev`, in project paths — none without one.
 * @param {Repo} repo @param {string|null} rev
 * @returns {string[]}
 */
function filesAt(repo, rev) {
  return rev === null ? [] : gitLines(repo.path, ['ls-tree', '-r', '--name-only', rev]).map((p) => projectPath(repo.dir, p));
}

/**
 * @param {Repo} repo @param {Cut} cut @param {string[]} scope
 * @returns {RepoAccount}
 */
function accountOf(repo, cut, scope) {
  return {
    commits: countOf(repo.path, 'HEAD', scope),
    rootDate: firstDate(repo.path, scope),
    history: cut.before === null ? [] : historyOf(repo.path, cut.before, scope),
    files: filesAt(repo, cut.tree),
  };
}

/**
 * A nested repo's account. A shallow clone's history is truncated, so it
 * adds its tree alone.
 * @param {Repo} repo @param {Cut} cut
 * @returns {RepoAccount}
 */
function nestedAccount(repo, cut) {
  if (!isShallow(repo.path)) return accountOf(repo, cut, []);
  return { commits: 0, rootDate: null, history: [], files: filesAt(repo, cut.tree) };
}

/**
 * The repos' histories as one, oldest first — each repo's own order kept,
 * the next row the earliest of the rows each repo has next.
 * @param {TimedRow[][]} histories @returns {string[]}
 */
function mergedByTime(histories) {
  const at = histories.map(() => 0);
  /** @type {string[]} */
  const rows = [];
  const total = sum(histories.map((h) => h.length));
  while (rows.length < total) {
    const pick = histories.reduce((best, h, i) => {
      if (at[i] === h.length) return best;
      return best === -1 || h[at[i]].time < histories[best][at[best]].time ? i : best;
    }, -1);
    rows.push(histories[pick][at[pick]].row);
    at[pick] += 1;
  }
  return rows;
}

/**
 * A long run keeps its head and tail around one elision line — enough to see
 * what the history is made of without carrying it whole.
 * @param {string[]} rows @returns {string[]}
 */
function elided(rows) {
  if (rows.length <= HISTORY_HEAD + HISTORY_TAIL) return rows;
  return [
    ...rows.slice(0, HISTORY_HEAD),
    `… ${rows.length - HISTORY_HEAD - HISTORY_TAIL} more …`,
    ...rows.slice(-HISTORY_TAIL),
  ];
}

/**
 * The project's files, less the workflows' own footprint in the code tree
 * (the skills install under `.claude/`, the `.worktreeinclude` earlier boots
 * kept): a file count plus the top-level shape, largest entries first.
 * @param {string[]} paths project paths
 * @returns {{files_at_arrival: number, tree_at_arrival: string[]}}
 */
function treeShape(paths) {
  const project = paths.filter((p) => !p.startsWith('.claude/') && p !== WORKTREE_INCLUDE);
  /** @type {Map<string, number>} */
  const top = new Map();
  for (const p of project) {
    const slash = p.indexOf('/');
    const key = slash === -1 ? p : `${p.slice(0, slash)}/`;
    top.set(key, (top.get(key) || 0) + 1);
  }
  const entries = [...top.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, n]) => (name.endsWith('/') ? `${name} (${n})` : name));
  const shown = entries.length > TREE_ENTRIES
    ? [...entries.slice(0, TREE_ENTRIES), `… ${entries.length - TREE_ENTRIES} more …`]
    : entries;
  return { files_at_arrival: project.length, tree_at_arrival: shown };
}

/**
 * The project's account of what came before the workflows, across every
 * repo in it: when the history began, when the state took its first
 * commit, the commits before that arrival (as commits, not a count alone)
 * and the project tree they arrived into. A project inside a larger
 * repository reads the commits that touched its folder. A repo with no
 * commits yet adds nothing, a shallow nested clone its tree alone, and a
 * submodule's pointer is never one of the root's files. Null when there is
 * no honest history to read — not a git repository, no commits, a shallow
 * root, or a git read that failed — leaving the judgment to the tree. Any
 * other failure is a bug, and throws.
 * @param {string} cwd
 * @returns {BaselineSignal|null}
 */
function baselineSignal(cwd) {
  try {
    const [root, ...nested] = projectRepos(cwd);
    if (isShallow(root.path)) return null;
    const arrival = arrivalIn(cwd);
    const accounts = [
      ...(hasCommits(root.path) ? [accountOf(root, cutAt(root.path, arrival), scopeOf(root.path))] : []),
      ...nested.filter((repo) => hasCommits(repo.path)).map((repo) => nestedAccount(repo, cutAt(repo.path, arrival))),
    ];
    const commitsTotal = sum(accounts.map((a) => a.commits));
    if (commitsTotal === 0) return null;
    const repoDirs = new Set(nested.map((repo) => repo.dir));
    return {
      root_date: accounts.flatMap((a) => (a.rootDate === null ? [] : [a.rootDate])).sort()[0],
      workflows_date: arrival && arrival.date,
      commits_total: commitsTotal,
      commits_before: sum(accounts.map((a) => a.history.length)),
      history_before: elided(mergedByTime(accounts.map((a) => a.history))),
      ...treeShape(accounts.flatMap((a) => a.files).filter((p) => !repoDirs.has(p))),
    };
  } catch (err) {
    if (err instanceof GitError) return null;
    throw err;
  }
}

// --- the verdict ------------------------------------------------------------

/** @type {Record<BaselineVerdict, string>} */
const VERDICT_MESSAGES = {
  native: 'baseline: the project grew up on the workflows',
  skipped: 'baseline: decline the assessment offer',
};

/**
 * Record workflow-start's one-time verdict — `native` (the project grew up
 * on the workflows) or `skipped` (the offer was declined) — and commit it
 * confined to the project manifest. Refuses any other value, and refuses
 * once anything is recorded: the judgment happens once.
 * @param {string} cwd @param {string} verdict
 * @returns {{status: BaselineVerdict, committed: string|null, note?: string, warnings?: string[]}}
 */
function recordBaselineVerdict(cwd, verdict) {
  if (!VERDICTS.includes(/** @type {BaselineVerdict} */ (verdict))) {
    throw new Error(`baseline record: the verdict is one of ${VERDICTS.join(', ')} — got "${verdict}"`);
  }
  const status = /** @type {BaselineVerdict} */ (verdict);
  const current = baselineState(cwd).status;
  if (current !== 'none') {
    throw new Error(`baseline record: the baseline is "${current}" — the verdict is recorded once, while nothing is recorded`);
  }
  withProjectLock(cwd, () => {
    /** @type {Record<string, any>} */
    const manifest = readProjectManifest(cwd);
    const b = manifest.baseline && typeof manifest.baseline === 'object' && !Array.isArray(manifest.baseline) ? manifest.baseline : {};
    manifest.baseline = { ...b, status };
    writeProjectManifestAtomic(cwd, manifest);
  });
  const { committed, warnings } = commitStateScoped(cwd, PROJECT_MANIFEST_SPEC, VERDICT_MESSAGES[status]);
  /** @type {{status: BaselineVerdict, committed: string|null, note?: string, warnings?: string[]}} */
  const result = { status, committed };
  noteIfNothingCommitted(result, committed);
  if (warnings.length > 0) result.warnings = warnings;
  return result;
}

module.exports = { baselineState, baselineSignal, recordBaselineVerdict };
