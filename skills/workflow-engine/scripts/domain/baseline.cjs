'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the project baseline — the one home for reading the project
// manifest's `baseline` object. Boot's status field, the start menus'
// resume/manage rows, and the render surfaces all derive from this state, so
// the vocabulary and the remaining-count exist exactly once. Two more things
// live here: the signal boot attaches while nothing is recorded — the
// repository's own account of what came before the workflows, handed to the
// one-time judgment as evidence to read rather than a number to threshold —
// and the verdict write, one confined transaction.
// ---------------------------------------------------------------------------

const { tryGit } = require('../kernel/git.cjs');
const { readProjectManifest, withProjectLock, writeProjectManifestAtomic } = require('../kernel/manifest.cjs');
const { commitPathspecScoped, noteIfNothingCommitted, PROJECT_MANIFEST_SPEC } = require('./commit.cjs');

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
 * @property {string} root_date  author date of the repository's first commit (YYYY-MM-DD)
 * @property {string|null} workflows_date  author date of the first commit touching `.workflows/` — null when none is committed yet, so the whole history predates the workflows
 * @property {number} commits_total  every commit reachable from HEAD
 * @property {number} commits_before  ancestors of the commit the workflows arrived in (the whole history when nothing under `.workflows/` is committed)
 * @property {string[]} history_before  those commits as `date  subject`, oldest first — the head and tail kept around an elision line when the run is long
 * @property {number} files_at_arrival  project files (outside `.claude/` and `.workflows/`) in the tree the workflows arrived into — HEAD's tree when nothing under `.workflows/` is committed
 * @property {string[]} tree_at_arrival  that tree's top-level shape: `dir/ (n)` and root files, largest first, elided past a dozen
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

/** Non-empty lines of a git listing, or null when the read failed. @param {string} cwd @param {string[]} args @returns {string[]|null} */
function gitLines(cwd, args) {
  const out = tryGit(cwd, args);
  return out === null ? null : out.split('\n').map((l) => l.trim()).filter(Boolean);
}

/**
 * The commits reachable from `rev` as `date  subject`, oldest first. A long
 * run keeps its head and tail around one elision line — enough to see what
 * the history is made of without carrying it whole.
 * @param {string} cwd @param {string} rev @returns {string[]|null}
 */
function historyOf(cwd, rev) {
  const rows = gitLines(cwd, ['log', '--no-show-signature', '--reverse', '--format=%as%x09%s', rev]);
  if (rows === null) return null;
  const shaped = rows.map((r) => r.replace('\t', '  '));
  if (shaped.length <= HISTORY_HEAD + HISTORY_TAIL) return shaped;
  return [
    ...shaped.slice(0, HISTORY_HEAD),
    `… ${shaped.length - HISTORY_HEAD - HISTORY_TAIL} more …`,
    ...shaped.slice(-HISTORY_TAIL),
  ];
}

/**
 * The project's tree at `rev`, less the workflows' own footprint (the skills
 * install under `.claude/`, the `.workflows/` tree): a file count plus the
 * top-level shape, largest entries first.
 * @param {string} cwd @param {string} rev
 * @returns {{files_at_arrival: number, tree_at_arrival: string[]}|null}
 */
function treeAt(cwd, rev) {
  const paths = gitLines(cwd, ['ls-tree', '-r', '--name-only', rev]);
  if (paths === null) return null;
  const project = paths.filter((p) => !p.startsWith('.claude/') && !p.startsWith('.workflows/'));
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
 * The repository's account of what came before the workflows: when the
 * history began, when `.workflows/` first landed in it, the commits before
 * that arrival (as commits, not a count alone) and the project tree they
 * arrived into. Null when there is no honest history to read — not a git
 * repository, no commits, a shallow clone, or a read that failed — leaving
 * the judgment to the tree.
 * @param {string} cwd
 * @returns {BaselineSignal|null}
 */
function baselineSignal(cwd) {
  if ((tryGit(cwd, ['rev-parse', '--is-shallow-repository']) || '').trim() === 'true') return null;
  const total = tryGit(cwd, ['rev-list', '--count', 'HEAD']);
  if (total === null) return null;
  const commitsTotal = parseInt(total, 10);
  if (!Number.isInteger(commitsTotal) || commitsTotal === 0) return null;

  const roots = gitLines(cwd, ['log', '--no-show-signature', '--max-parents=0', '--reverse', '--format=%as', 'HEAD']);
  if (roots === null || roots.length === 0) return null;
  const rootDate = roots[0];

  const arrivals = gitLines(cwd, ['log', '--no-show-signature', '--reverse', '--format=%H%x09%as', 'HEAD', '--', '.workflows']);
  if (arrivals === null) return null;

  if (arrivals.length === 0) {
    // Nothing under `.workflows/` is committed: the workflows are arriving
    // now, into HEAD's tree, and the whole history came before them.
    const tree = treeAt(cwd, 'HEAD');
    const history = historyOf(cwd, 'HEAD');
    if (tree === null || history === null) return null;
    return { root_date: rootDate, workflows_date: null, commits_total: commitsTotal, commits_before: commitsTotal, history_before: history, ...tree };
  }

  const [sha, workflowsDate] = arrivals[0].split('\t');
  const tree = treeAt(cwd, sha);
  const parents = tryGit(cwd, ['rev-list', '--parents', '-n', '1', sha]);
  if (tree === null || parents === null) return null;
  const firstParent = parents.trim().split(/\s+/)[1];
  if (!firstParent) {
    // The workflows arrived in the root commit: no commits came before, and
    // the tree they arrived into is that commit's own.
    return { root_date: rootDate, workflows_date: workflowsDate, commits_total: commitsTotal, commits_before: 0, history_before: [], ...tree };
  }
  const before = tryGit(cwd, ['rev-list', '--count', firstParent]);
  const history = historyOf(cwd, firstParent);
  if (before === null || history === null) return null;
  return { root_date: rootDate, workflows_date: workflowsDate, commits_total: commitsTotal, commits_before: parseInt(before, 10), history_before: history, ...tree };
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
 * @returns {{status: BaselineVerdict, committed: string|null, note?: string}}
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
  const committed = commitPathspecScoped(cwd, PROJECT_MANIFEST_SPEC, VERDICT_MESSAGES[status]);
  /** @type {{status: BaselineVerdict, committed: string|null, note?: string}} */
  const result = { status, committed };
  noteIfNothingCommitted(result, committed);
  return result;
}

module.exports = { baselineState, baselineSignal, recordBaselineVerdict };
