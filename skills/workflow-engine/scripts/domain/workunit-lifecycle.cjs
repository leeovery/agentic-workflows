'use strict';

// ---------------------------------------------------------------------------
// Domain ring: work-unit lifecycle transitions — complete, cancel,
// reactivate, and pivot, each a single transaction from the caller's
// perspective: manifest write, knowledge-base sync, scoped git commit.
//
// The status vocabulary comes from the shared schema
// (workflow-shared/scripts/manifest-schema.cjs) — the same table the manifest
// CLI validates against, so the engine can never be the permissive path.
//
// The manifest write is the source of truth and lands first; the knowledge
// base is a derived index, so its failures are recorded as warnings, never
// blocks. Validation throws loud and specific before anything is touched.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { loadWorkUnitManifest, saveWorkUnitManifest } = require('../kernel/manifest.cjs');
const { commitScoped } = require('../kernel/git.cjs');
const { knowledge, INDEXED_ARTIFACTS } = require('./kb.cjs');
const { readProjectManifest, writeProjectManifestAtomic } = require('./workunit-create.cjs');
const { addItem } = require('./discovery-map.cjs');

const { VALID_WORK_UNIT_STATUSES } = require('../../../workflow-shared/scripts/manifest-schema.cjs');

// Refuse any status write the manifest CLI would refuse — the two enforcers
// share one schema table.
/** @param {string} status */
function assertLegalStatus(status) {
  if (!VALID_WORK_UNIT_STATUSES.includes(status)) {
    throw new Error(`Invalid status "${status}". Must be one of: ${VALID_WORK_UNIT_STATUSES.join(', ')}`);
  }
}

/** The work unit's date stamp for today (UTC), matching the manifest `created` field. */
function todayStamp() {
  return new Date().toISOString().slice(0, 10);
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
 * Refuses an already-completed unit; a cancelled unit must go through
 * reactivate first.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {{message: string}} opts  commit message — varies by caller (manual
 *   completion vs pipeline-terminal vs review-skipped), so it arrives via -m
 * @returns {WorkUnitLifecycleResult}
 */
function completeWorkUnit(cwd, workUnit, { message }) {
  assertLegalStatus('completed');
  const manifest = loadWorkUnitManifest(cwd, workUnit);
  if (manifest.status === 'completed') {
    throw new Error(`work unit "${workUnit}" is already completed`);
  }
  if (manifest.status === 'cancelled') {
    throw new Error(`work unit "${workUnit}" is cancelled — reactivate it first`);
  }
  manifest.status = 'completed';
  const completedAt = todayStamp();
  manifest.completed_at = completedAt;

  saveWorkUnitManifest(cwd, workUnit, manifest);

  const committed = commitScoped(cwd, `.workflows/${workUnit}`, message);
  /** @type {WorkUnitLifecycleResult} */
  const result = { work_unit: workUnit, status: 'completed', completed_at: completedAt, committed, warnings: [] };
  if (committed === null) result.note = 'nothing to commit';
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
  const manifest = loadWorkUnitManifest(cwd, workUnit);
  if (manifest.status === 'cancelled') {
    throw new Error(`work unit "${workUnit}" is already cancelled`);
  }
  if (manifest.status === 'completed') {
    throw new Error(`work unit "${workUnit}" is completed — reactivate it first`);
  }
  manifest.status = 'cancelled';

  saveWorkUnitManifest(cwd, workUnit, manifest);

  /** @type {string[]} */
  const warnings = [];
  knowledge(cwd, ['remove', '--work-unit', workUnit], 'knowledge remove', warnings);

  const committed = commitScoped(cwd, `.workflows/${workUnit}`, `workflow(${workUnit}): mark as cancelled`);
  /** @type {WorkUnitLifecycleResult} */
  const result = { work_unit: workUnit, status: 'cancelled', committed, warnings };
  if (committed === null) result.note = 'nothing to commit';
  return result;
}

/**
 * Re-index the work unit's chunk-backed material: every completed artifact in
 * an indexed phase, the tracked imports and seeds (entries must match
 * `imports/{file}.md` / `seeds/{file}.md` — anything else signals a tampered
 * manifest entry and is skipped), and the on-disk analysis caches. Restores
 * what cancellation removed, and refreshes chunk metadata after a pivot. All
 * warn-don't-block.
 * @param {string} cwd @param {string} workUnit @param {object} manifest @param {string[]} warnings
 */
function reindexWorkUnit(cwd, workUnit, manifest, warnings) {
  const phases = manifest.phases && typeof manifest.phases === 'object' ? manifest.phases : {};
  for (const [phase, artifact] of Object.entries(INDEXED_ARTIFACTS)) {
    const ph = phases[phase];
    const items = ph && typeof ph === 'object' && ph.items && typeof ph.items === 'object' ? ph.items : {};
    for (const [topic, item] of Object.entries(items)) {
      if (item && typeof item === 'object' && item.status === 'completed') {
        knowledge(cwd, ['index', artifact(workUnit, topic)], `knowledge index (${phase}/${topic})`, warnings);
      }
    }
  }

  for (const field of ['imports', 'seeds']) {
    const entries = Array.isArray(manifest[field]) ? manifest[field] : [];
    const shape = new RegExp(`^${field}/[^./][^/]*\\.md$`);
    for (const entry of entries) {
      const rel = entry && typeof entry === 'object' ? entry.path : null;
      if (typeof rel !== 'string' || !shape.test(rel)) continue;
      knowledge(cwd, ['index', `.workflows/${workUnit}/${rel}`], `knowledge index (${rel})`, warnings);
    }
  }

  for (const cache of ['research-analysis.md', 'discovery-gap-analysis.md']) {
    const rel = `.workflows/${workUnit}/.state/${cache}`;
    if (fs.existsSync(path.join(cwd, rel))) {
      knowledge(cwd, ['index', rel], `knowledge index (.state/${cache})`, warnings);
    }
  }
}

/**
 * Reactivate a completed or cancelled work unit: `status: in-progress`, a
 * stale `completed_at` cleared, commit scoped to the work unit. Cancellation
 * removed the unit's knowledge-base chunks, so reactivating from `cancelled`
 * re-indexes them (warn-don't-block); completed units retained their chunks —
 * no knowledge-base action.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @returns {WorkUnitLifecycleResult}
 */
function reactivateWorkUnit(cwd, workUnit) {
  assertLegalStatus('in-progress');
  const manifest = loadWorkUnitManifest(cwd, workUnit);
  if (manifest.status === 'in-progress') {
    throw new Error(`work unit "${workUnit}" is already in-progress`);
  }
  if (manifest.status !== 'completed' && manifest.status !== 'cancelled') {
    throw new Error(`work unit "${workUnit}" is not completed or cancelled (status: ${manifest.status ?? 'none'})`);
  }
  const previous = manifest.status;
  manifest.status = 'in-progress';
  if ('completed_at' in manifest) delete manifest.completed_at;

  saveWorkUnitManifest(cwd, workUnit, manifest);

  /** @type {string[]} */
  const warnings = [];
  if (previous === 'cancelled') {
    reindexWorkUnit(cwd, workUnit, manifest, warnings);
  }

  const committed = commitScoped(cwd, `.workflows/${workUnit}`, `workflow(${workUnit}): reactivate work unit`);
  /** @type {WorkUnitLifecycleResult} */
  const result = { work_unit: workUnit, status: 'in-progress', previous_status: previous, committed, warnings };
  if (committed === null) result.note = 'nothing to commit';
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
  const manifest = loadWorkUnitManifest(cwd, workUnit);
  if (manifest.work_type !== 'feature') {
    throw new Error(`work unit "${workUnit}" is not a feature (work_type: ${manifest.work_type ?? 'none'}) — only features pivot to epics`);
  }
  if (manifest.status !== 'in-progress') {
    throw new Error(`work unit "${workUnit}" is not in-progress (status: ${manifest.status ?? 'none'}) — reactivate it first`);
  }
  // The map add runs mid-transaction — prove it can succeed before flipping
  // anything.
  const phases = manifest.phases && typeof manifest.phases === 'object' ? manifest.phases : {};
  const discovery = phases.discovery && typeof phases.discovery === 'object' ? phases.discovery : {};
  const items = discovery.items && typeof discovery.items === 'object' ? discovery.items : {};
  if (items[workUnit]) {
    throw new Error(`"${workUnit}" is already on the discovery map — the pivot appears to have already run`);
  }
  if (Array.isArray(discovery.dismissed) && discovery.dismissed.includes(workUnit)) {
    throw new Error(`"${workUnit}" is on the discovery map's dismissed list — clear it before pivoting`);
  }
  // Read (and refuse corrupt JSON) before anything mutates.
  const projectManifestFile = path.join(cwd, '.workflows', 'manifest.json');
  const projectManifest = readProjectManifest(projectManifestFile);

  const routing = phases.research ? 'research' : 'discussion';

  manifest.work_type = 'epic';
  saveWorkUnitManifest(cwd, workUnit, manifest);

  // The feature's single topic joins the map (routing, source, no summary/
  // description — backfill semantics).
  addItem(cwd, workUnit, workUnit, { routing, backfill: true });

  // The registration must agree with the manifest — upserted, so a legacy
  // unit that predates registration is registered rather than skipped.
  if (!projectManifest.work_units || typeof projectManifest.work_units !== 'object') projectManifest.work_units = {};
  if (!projectManifest.work_units[workUnit] || typeof projectManifest.work_units[workUnit] !== 'object') {
    projectManifest.work_units[workUnit] = {};
  }
  projectManifest.work_units[workUnit].work_type = 'epic';
  writeProjectManifestAtomic(projectManifestFile, projectManifest);

  // Chunk metadata carries work_type — that's why pivot re-indexes.
  /** @type {string[]} */
  const warnings = [];
  reindexWorkUnit(cwd, workUnit, manifest, warnings);

  const committed = commitScoped(cwd, [`.workflows/${workUnit}`, '.workflows/manifest.json'], `workflow(${workUnit}): pivot to epic`);
  /** @type {WorkUnitPivotResult} */
  const result = { work_unit: workUnit, work_type: 'epic', routing, committed, warnings };
  if (committed === null) result.note = 'nothing to commit';
  return result;
}

module.exports = { completeWorkUnit, cancelWorkUnit, reactivateWorkUnit, pivotWorkUnit };
