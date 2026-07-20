'use strict';

// ---------------------------------------------------------------------------
// Domain ring: work-unit lifecycle transitions — complete, cancel,
// reactivate, and pivot, each a single transaction from the caller's
// perspective: manifest write, knowledge-base sync, scoped git commit.
//
// The status vocabulary comes from the shared schema
// (kernel/manifest-schema.cjs) — the same table the manifest
// CLI validates against, so the engine can never be the permissive path.
//
// The manifest write is the source of truth and lands first; the knowledge
// base is a derived index, so its failures are recorded as warnings, never
// blocks. Validation throws loud and specific before anything is touched.
// Every load→mutate→save runs under the owning manifest's lock (work-unit or
// project — the manifest locks every writer honours), taken one at a time and
// never nested, so multi-manifest transactions cannot deadlock.
// ---------------------------------------------------------------------------

const {
  loadWorkUnitManifest,
  saveWorkUnitManifest,
  withWorkUnitLock,
  readProjectManifest,
  writeProjectManifestAtomic,
  withProjectLock,
  ensureContainer,
} = require('../kernel/manifest.cjs');
const { commitScopedWithKb, noteIfNothingCommitted } = require('./commit.cjs');
const { knowledge } = require('./kb.cjs');
const { addItem } = require('./discovery-map.cjs');
const { todayStamp } = require('./dates.cjs');
const { computeNextPhase } = require('./derivations.cjs');

const { VALID_WORK_UNIT_STATUSES } = require('../kernel/manifest-schema.cjs');

// Refuse any status write the field surface would refuse — the two enforcers
// share one schema table.
/** @param {string} status */
function assertLegalStatus(status) {
  if (!VALID_WORK_UNIT_STATUSES.includes(status)) {
    throw new Error(`Invalid status "${status}". Must be one of: ${VALID_WORK_UNIT_STATUSES.join(', ')}`);
  }
}

/**
 * @typedef {object} WorkUnitLifecycleResult
 * @property {string} work_unit
 * @property {string} status     the work unit's status after the transition
 * @property {string} [completed_at]      complete: the stamped date
 * @property {string} [previous_status]   reactivate: the status the unit came from
 * @property {string|null} committed  short commit sha, or null when nothing was staged
 * @property {string} [note]     set when committed is null
 * @property {string[]} warnings non-blocking failures (knowledge-base sync)
 */

/**
 * Complete a work unit: `status: completed`, `completed_at` stamped today
 * (engine-stamped, UTC), commit scoped to the work unit with the caller's
 * message. No knowledge-base action — completed units retain their chunks.
 * Refuses an already-completed unit. A cancelled unit must go through
 * reactivate first — unless its pipeline is finished (derived next phase
 * `done`): that state completes directly (reactivate remains open too), and
 * cancellation removed the unit's chunks, so this path re-indexes them
 * (warn-don't-block).
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {{message: string}} opts  commit message — varies by caller (manual
 *   completion vs pipeline-terminal vs review-skipped), so it arrives via -m
 * @returns {WorkUnitLifecycleResult}
 */
function completeWorkUnit(cwd, workUnit, { message }) {
  assertLegalStatus('completed');
  const { completedAt, previous } = withWorkUnitLock(cwd, workUnit, () => {
    const loaded = loadWorkUnitManifest(cwd, workUnit);
    if (loaded.status === 'completed') {
      throw new Error(`work unit "${workUnit}" is already completed`);
    }
    if (loaded.status === 'cancelled' && computeNextPhase(loaded).next_phase !== 'done') {
      throw new Error(`work unit "${workUnit}" is cancelled — reactivate it first`);
    }
    const from = loaded.status;
    loaded.status = 'completed';
    const stamped = todayStamp();
    loaded.completed_at = stamped;

    saveWorkUnitManifest(cwd, workUnit, loaded);
    return { completedAt: stamped, previous: from };
  });

  /** @type {string[]} */
  const warnings = [];
  if (previous === 'cancelled') {
    reindexWorkUnit(cwd, workUnit, warnings);
  }

  const committed = commitScopedWithKb(cwd, `.workflows/${workUnit}`, message);
  /** @type {WorkUnitLifecycleResult} */
  const result = { work_unit: workUnit, status: 'completed', completed_at: completedAt, committed, warnings };
  noteIfNothingCommitted(result, committed);
  return result;
}

/**
 * Cancel a work unit: `status: cancelled`, remove its knowledge-base chunks
 * (warn-don't-block), commit scoped to the work unit. Refuses an
 * already-cancelled unit; a completed unit must go through reactivate first —
 * cancellation is only offered on active work.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @returns {WorkUnitLifecycleResult}
 */
function cancelWorkUnit(cwd, workUnit) {
  assertLegalStatus('cancelled');
  withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    if (manifest.status === 'cancelled') {
      throw new Error(`work unit "${workUnit}" is already cancelled`);
    }
    if (manifest.status === 'completed') {
      throw new Error(`work unit "${workUnit}" is completed — reactivate it first`);
    }
    manifest.status = 'cancelled';

    saveWorkUnitManifest(cwd, workUnit, manifest);
  });

  /** @type {string[]} */
  const warnings = [];
  knowledge(cwd, ['remove', '--work-unit', workUnit], 'knowledge remove', warnings);

  const committed = commitScopedWithKb(cwd, `.workflows/${workUnit}`, `workflow(${workUnit}): mark as cancelled`);
  /** @type {WorkUnitLifecycleResult} */
  const result = { work_unit: workUnit, status: 'cancelled', committed, warnings };
  noteIfNothingCommitted(result, committed);
  return result;
}

/**
 * Re-index a work unit's chunk-backed material in ONE knowledge spawn (formerly
 * one spawn per artifact). `knowledge index --work-unit <wu>` runs the bulk
 * discovery scoped to this unit — exactly the set the per-artifact walk covered:
 * every completed indexed-phase topic, the shape-valid imports and seeds, the
 * on-disk analysis caches, and (epics only) the discovery session logs. The CLI
 * reads the manifest itself, so no manifest is threaded in here.
 *
 * `clearFirst` (pivot) removes the unit's chunks before re-indexing. A pivot
 * refreshes chunk work_type metadata on ALREADY-indexed chunks, and bulk index
 * skips artifacts that are already indexed — so the stale chunks must be cleared
 * first for the fresh index to re-stamp them. reactivate / complete-from-
 * cancelled start from removed chunks (cancellation cleared them), so the index
 * alone restores them. All warn-don't-block.
 * @param {string} cwd @param {string} workUnit @param {string[]} warnings
 * @param {{clearFirst?: boolean}} [opts]
 */
function reindexWorkUnit(cwd, workUnit, warnings, opts) {
  if (opts && opts.clearFirst) {
    knowledge(cwd, ['remove', '--work-unit', workUnit], 'knowledge remove', warnings);
  }
  knowledge(cwd, ['index', '--work-unit', workUnit], 'knowledge index', warnings);
}

/**
 * Reactivate a completed or cancelled work unit: `status: in-progress`, a
 * stale `completed_at` cleared, commit scoped to the work unit. A finished
 * pipeline (derived next phase `done`) is no bar — the reactivated unit
 * surfaces as finalising until a phase is reopened, which is exactly the
 * revisit path the navigation skills route through here. Cancellation removed
 * the unit's knowledge-base chunks, so reactivating from `cancelled`
 * re-indexes them (warn-don't-block); completed units retained their chunks —
 * no knowledge-base action.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @returns {WorkUnitLifecycleResult}
 */
function reactivateWorkUnit(cwd, workUnit) {
  assertLegalStatus('in-progress');
  const { previous } = withWorkUnitLock(cwd, workUnit, () => {
    const loaded = loadWorkUnitManifest(cwd, workUnit);
    if (loaded.status === 'in-progress') {
      throw new Error(`work unit "${workUnit}" is already in-progress`);
    }
    if (loaded.status !== 'completed' && loaded.status !== 'cancelled') {
      throw new Error(`work unit "${workUnit}" is not completed or cancelled (status: ${loaded.status ?? 'none'})`);
    }
    const from = loaded.status;
    loaded.status = 'in-progress';
    if ('completed_at' in loaded) delete loaded.completed_at;

    saveWorkUnitManifest(cwd, workUnit, loaded);
    return { previous: from };
  });

  /** @type {string[]} */
  const warnings = [];
  if (previous === 'cancelled') {
    reindexWorkUnit(cwd, workUnit, warnings);
  }

  const committed = commitScopedWithKb(cwd, `.workflows/${workUnit}`, `workflow(${workUnit}): reactivate work unit`);
  /** @type {WorkUnitLifecycleResult} */
  const result = { work_unit: workUnit, status: 'in-progress', previous_status: previous, committed, warnings };
  noteIfNothingCommitted(result, committed);
  return result;
}

/**
 * @typedef {object} WorkUnitPivotResult
 * @property {string} work_unit
 * @property {string} work_type  always `epic`
 * @property {string} routing    the map item's routing (research when the phase exists, else discussion)
 * @property {string|null} committed  short commit sha, or null when nothing was staged
 * @property {string} [note]     set when committed is null
 * @property {string[]} warnings non-blocking failures (knowledge-base re-index)
 */

/**
 * Pivot a feature to an epic: flip `work_type` in the work-unit manifest AND
 * the project manifest's registration, register the feature's single topic
 * (topic name = work unit name) on the discovery map with backfill semantics
 * (summary-backfill drafts summary/description on the next epic entry),
 * re-index the unit so chunk metadata carries the new work_type
 * (warn-don't-block), and commit both manifests. Routing reflects the work
 * already done: `research` when the research phase exists, else `discussion`.
 * Only an in-progress feature pivots.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @returns {WorkUnitPivotResult}
 */
function pivotWorkUnit(cwd, workUnit) {
  const { routing } = withWorkUnitLock(cwd, workUnit, () => {
    const loaded = loadWorkUnitManifest(cwd, workUnit);
    if (loaded.work_type !== 'feature') {
      throw new Error(`work unit "${workUnit}" is not a feature (work_type: ${loaded.work_type ?? 'none'}) — only features pivot to epics`);
    }
    if (loaded.status !== 'in-progress') {
      throw new Error(`work unit "${workUnit}" is not in-progress (status: ${loaded.status ?? 'none'}) — reactivate it first`);
    }
    // The map add runs mid-transaction — prove it can succeed before flipping
    // anything.
    const phases = loaded.phases && typeof loaded.phases === 'object' ? loaded.phases : {};
    const discovery = phases.discovery && typeof phases.discovery === 'object' ? phases.discovery : {};
    const items = discovery.items && typeof discovery.items === 'object' ? discovery.items : {};
    if (items[workUnit]) {
      throw new Error(`"${workUnit}" is already on the discovery map — the pivot appears to have already run`);
    }
    if (Array.isArray(discovery.dismissed) && discovery.dismissed.includes(workUnit)) {
      throw new Error(`"${workUnit}" is on the discovery map's dismissed list — clear it before pivoting`);
    }
    // Read (and refuse corrupt JSON) before anything mutates.
    readProjectManifest(cwd);

    loaded.work_type = 'epic';
    saveWorkUnitManifest(cwd, workUnit, loaded);
    return { routing: phases.research ? 'research' : 'discussion' };
  });

  // The feature's single topic joins the map (routing, source, no summary/
  // description — backfill semantics). Its own locked read-modify-write.
  addItem(cwd, workUnit, workUnit, { routing, backfill: true });

  // The registration must agree with the manifest — a fresh read under the
  // project lock, upserted, so a legacy unit that predates registration is
  // registered rather than skipped.
  withProjectLock(cwd, () => {
    const projectManifest = readProjectManifest(cwd);
    const workUnits = ensureContainer(projectManifest, 'work_units', 'work_units');
    ensureContainer(workUnits, workUnit, `work_units.${workUnit}`).work_type = 'epic';
    writeProjectManifestAtomic(cwd, projectManifest);
  });

  // Chunk metadata carries work_type — that's why pivot clears then re-indexes.
  /** @type {string[]} */
  const warnings = [];
  reindexWorkUnit(cwd, workUnit, warnings, { clearFirst: true });

  const committed = commitScopedWithKb(cwd, [`.workflows/${workUnit}`, '.workflows/manifest.json'], `workflow(${workUnit}): pivot to epic`);
  /** @type {WorkUnitPivotResult} */
  const result = { work_unit: workUnit, work_type: 'epic', routing, committed, warnings };
  noteIfNothingCommitted(result, committed);
  return result;
}

module.exports = { completeWorkUnit, cancelWorkUnit, reactivateWorkUnit, pivotWorkUnit };
