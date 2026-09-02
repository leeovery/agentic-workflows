'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the project baseline — the one home for reading the project
// manifest's `baseline` object. Boot's status field, the start menus'
// resume/manage rows, and the render surfaces all derive from this state, so
// the vocabulary and the remaining-count exist exactly once. The signal is
// the other half of boot's `none` report: the repository facts the one-time
// judgment — did a codebase predate the workflows? — is made from, so the
// verdict rests on history rather than on whatever happens to be in context.
// ---------------------------------------------------------------------------

const { spawnSync } = require('child_process');
const { readProjectManifest } = require('../kernel/manifest.cjs');

/** The lifecycle statuses a project manifest may record. */
const BASELINE_STATUSES = ['native', 'in-progress', 'completed', 'skipped'];

/**
 * @typedef {object} BaselineState
 * @property {'none'|'native'|'in-progress'|'completed'|'skipped'} status
 * @property {{name: string, status: string}[]} areas  registration order
 * @property {number} remaining  areas not yet completed (0 unless in-progress)
 */

/**
 * @typedef {object} BaselineSignal
 * @property {string} root_date  date of the repository's first commit (YYYY-MM-DD)
 * @property {string|null} workflows_date  date of the first commit touching `.workflows/` — null when none is committed yet, so every commit predates the workflows
 * @property {number} commits_before  commits made before the workflows arrived (the whole history when nothing under `.workflows/` is committed)
 * @property {number} commits_total  every commit reachable from HEAD
 * @property {number} files_before  tracked files outside `.claude/` and `.workflows/` at the last commit before the workflows arrived (at HEAD when nothing under `.workflows/` is committed)
 */

/**
 * Read the project baseline state. Anything other than a recognised
 * lifecycle status — including a missing or corrupt project manifest, or a
 * malformed field shape — reads `none` with no areas: the never-recorded
 * state the one-time judgment keys on. Corruption surfaces loudly at the
 * first manifest write, not here — boot and the menus must stay usable.
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
  const status = b && typeof b === 'object' && !Array.isArray(b) && typeof b.status === 'string' ? b.status : 'none';
  if (!BASELINE_STATUSES.includes(status)) {
    return { status: 'none', areas: [], remaining: 0 };
  }
  const areasObj = b.areas && typeof b.areas === 'object' && !Array.isArray(b.areas) ? b.areas : {};
  const areas = Object.entries(areasObj)
    .filter(([, s]) => typeof s === 'string')
    .map(([name, s]) => ({ name, status: /** @type {string} */ (s) }));
  const remaining = status === 'in-progress' ? areas.filter((a) => a.status !== 'completed').length : 0;
  return { status: /** @type {BaselineState['status']} */ (status), areas, remaining };
}

/**
 * Git stdout, or null on any failure — the signal is advisory and must
 * never make boot unusable (no repository, no commits, a broken checkout).
 * @param {string} cwd @param {string[]} args @returns {string|null}
 */
function gitOrNull(cwd, args) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (res.error || res.status !== 0) return null;
  return res.stdout;
}

/** Non-empty lines of a git listing. @param {string|null} out */
function lines(out) {
  return out === null ? [] : out.split('\n').map((l) => l.trim()).filter(Boolean);
}

/**
 * Tracked files at a revision, excluding the workflows' own footprint — the
 * skills install under `.claude/` and the `.workflows/` tree — so the count
 * reads as the project's code.
 * @param {string} cwd @param {string} rev @returns {number|null}
 */
function projectFilesAt(cwd, rev) {
  const out = gitOrNull(cwd, ['ls-tree', '-r', '--name-only', rev]);
  if (out === null) return null;
  return lines(out).filter((p) => !p.startsWith('.claude/') && !p.startsWith('.workflows/')).length;
}

/**
 * The repository facts behind the one-time baseline judgment: when the
 * history began, when the workflows first landed in it, and how much came
 * before. Null when there is no history to read — not a git repository, or
 * one with no commits — leaving the judgment to the tree.
 * @param {string} cwd
 * @returns {BaselineSignal|null}
 */
function baselineSignal(cwd) {
  const all = lines(gitOrNull(cwd, ['log', '--reverse', '--format=%H%x09%cs', 'HEAD']));
  if (all.length === 0) return null;
  const rootDate = all[0].split('\t')[1];
  const commitsTotal = all.length;

  const arrival = lines(gitOrNull(cwd, ['log', '--reverse', '--format=%H%x09%cs', 'HEAD', '--', '.workflows']))[0];
  if (arrival === undefined) {
    // Nothing under `.workflows/` is committed: the workflows are arriving
    // now, and the whole history predates them.
    const filesBefore = projectFilesAt(cwd, 'HEAD');
    if (filesBefore === null) return null;
    return { root_date: rootDate, workflows_date: null, commits_before: commitsTotal, commits_total: commitsTotal, files_before: filesBefore };
  }

  const [sha, workflowsDate] = arrival.split('\t');
  const before = all.findIndex((l) => l.startsWith(sha));
  if (before <= 0) {
    // The workflows arrived in the root commit — nothing came before.
    return { root_date: rootDate, workflows_date: workflowsDate, commits_before: 0, commits_total: commitsTotal, files_before: 0 };
  }
  const parent = all[before - 1].split('\t')[0];
  const filesBefore = projectFilesAt(cwd, parent);
  if (filesBefore === null) return null;
  return { root_date: rootDate, workflows_date: workflowsDate, commits_before: before, commits_total: commitsTotal, files_before: filesBefore };
}

module.exports = { baselineState, baselineSignal, BASELINE_STATUSES };
