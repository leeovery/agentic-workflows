'use strict';

// ---------------------------------------------------------------------------
// Domain ring: work-unit lifecycle transitions — complete (finish's, run in
// process), cancel, reactivate, and pivot, each a single transaction from the
// caller's perspective: manifest write, knowledge-base sync, scoped commit.
// A cancel leaves the unit's code first (18.3.9): a quick-fix's checkout
// taken back as its move takes it (fix-leave.cjs), and every pull request
// open on the unit's branches closed, the branches kept under their own
// names, so a reactivate finds them there (landing.cjs, `cancelClose`).
// A completed unit, of any type, is never reopened: it stays finished, and
// a later change to it is new work (`finishedRefusal`) — reactivate takes a
// cancelled unit alone, and cancel and pivot refuse a completed one.
//
// The status vocabulary comes from the shared schema
// (kernel/manifest-schema.cjs) — the same table the manifest
// CLI validates against, so the engine can never be the permissive path.
//
// The manifest write is the source of truth and lands first; the knowledge
// base is a derived index, so its failures are recorded as warnings, never
// blocks. Validation throws loud and specific before anything is touched.
// Every load→mutate→save runs under the writer lock, which the verb holds
// across its commit too.
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
const { commitStateTail, noteCommitOutcome } = require('./commit.cjs');
const { purgeWorkUnitCache } = require('./cache.cjs');
const { syncKnowledge } = require('./knowledge/sync.cjs');
const { addBatchTo, arrivingEntry, discoveryItems } = require('./discovery-map.cjs');
const { revertJoins, recordPutBack, retakeJoins } = require('./roadmap.cjs');
const { moveUnitMailToInbox } = require('./mail.cjs');
const { statePath } = require('../kernel/state-root.cjs');
const { todayStamp } = require('./dates.cjs');
const { unitOpenRecords, quickFixBuild, fixesBegun } = require('./derivations.cjs');
const { assertBeforeSpec } = require('./spec-standing.cjs');
const { abandonExperiments } = require('./transitions.cjs');
const { cancelClose } = require('./landing.cjs');
const { leaveCheckout } = require('./fix-leave.cjs');

const { recordClosed, nextCancel } = require('./cancel-closed.cjs');

const { VALID_WORK_UNIT_STATUSES } = require('../kernel/manifest-schema.cjs');

/** The refusal of a lifecycle verb acting on a completed unit (the header's). @param {string} workUnit */
const finishedRefusal = (workUnit) => `work unit "${workUnit}" is completed — a finished unit stays finished; a later change is new work`;

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
 * @property {string} [work_type]  complete: the unit's work type (drives the pipeline banner)
 * @property {string} status     the work unit's status after the transition
 * @property {string} [completed_at]      complete: the stamped date
 * @property {string} [previous_status]   reactivate: the status the unit came from
 * @property {string|null} committed  short commit sha, or null when nothing was staged
 * @property {string} [note]     set when committed is null
 * @property {string[]} warnings non-blocking failures (knowledge-base sync)
 * @property {string[]} [roadmap_reverted] cancel: roadmap items handed back to waiting by the cancel-revert hop
 * @property {import('./roadmap.cjs').HorizonGone[]} [roadmap_horizon_gone] cancel: those of them whose horizon was removed meanwhile, now on none
 * @property {string[]} [inbox] cancel: each waiting message's idea in the inbox, absolute
 * @property {{topic: string, ids: string[]}[]} [abandoned] cancel: each topic's experiment records it ended abandoned
 * @property {boolean} [pull_requests_closed] cancel: whether it closed any pull request open on the unit's branches
 * @property {string} [checkout] cancel: the branch it took a quick-fix's checkout back to, where it had the quick-fix's out
 * @property {string[]} [roadmap_rejoined] reactivate: the roadmap items its cancel put back, taken back
 * @property {string[]} [roadmap_stayed] reactivate: those other work took meanwhile, or archived, left where they are
 */

/**
 * Complete a work unit: `status: completed`, `completed_at` stamped today
 * (engine-stamped, UTC), commit scoped to the work unit with the caller's
 * message. No knowledge-base action — completed units retain their chunks.
 * Refuses an already-completed unit, and a cancelled one, which goes
 * through reactivate first.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {{message: string}} opts  the commit message, finish's
 * @returns {WorkUnitLifecycleResult}
 */
function completeWorkUnit(cwd, workUnit, { message }) {
  assertLegalStatus('completed');
  const { completedAt, workType } = withWorkUnitLock(cwd, workUnit, () => {
    const loaded = loadWorkUnitManifest(cwd, workUnit);
    if (loaded.status === 'completed') {
      throw new Error(`work unit "${workUnit}" is already completed`);
    }
    if (loaded.status === 'cancelled') {
      throw new Error(`work unit "${workUnit}" is cancelled — reactivate it first`);
    }
    loaded.status = 'completed';
    const stamped = todayStamp();
    loaded.completed_at = stamped;

    saveWorkUnitManifest(cwd, workUnit, loaded);
    return { completedAt: stamped, workType: loaded.work_type };
  });

  /** @type {string[]} */
  const warnings = [];
  purgeWorkUnitCache(cwd, workUnit);
  const outcome = commitStateTail(cwd, workUnit, message, warnings);
  /** @type {WorkUnitLifecycleResult} */
  const result = { work_unit: workUnit, work_type: workType, status: 'completed', completed_at: completedAt, committed: outcome.committed, warnings };
  noteCommitOutcome(result, outcome);
  return result;
}

/**
 * End every open experiment record of the unit as a topic's cancel ends its
 * own, the unit's cancel the reason (18.4.22). Mutates the loaded manifest.
 * @param {Record<string, any>} manifest @returns {{topic: string, ids: string[]}[]}
 */
function abandonUnitExperiments(manifest) {
  const open = unitOpenRecords(manifest);
  for (const { topic, ids } of open) abandonExperiments(manifest, topic, ids, 'work unit cancelled');
  return open;
}

/**
 * The unit's code left as its cancel leaves it (18.3.9): a quick-fix's
 * checkout left as its move leaves it, the holder's work not committed set
 * aside and each checkout taken back (fix-leave.cjs); then every pull
 * request open on the unit's branches closed, in each repository it
 * touched, the branches kept under their own names (`cancelClose`,
 * landing.cjs), each the host names recorded on the loaded manifest as it
 * closes (`recordClosed`, cancel-closed.cjs). Each step is one a cancel run
 * again finds done; a refusal part way keeps the record of what closed
 * before it, saved and committed as the refusal goes on (`keepClosed`).
 * @param {string} cwd @param {Record<string, any>} manifest
 */
function leaveCode(cwd, manifest) {
  const checkout = quickFixBuild(manifest) && fixesBegun(manifest) ? leaveCheckout(cwd, manifest, 'workunit cancel', 'cancel') : null;
  let told = 0;
  try {
    return {
      checkout,
      ...cancelClose(cwd, manifest.name, (repo, name) => {
        recordClosed(manifest, repo, name);
        told += 1;
      }),
    };
  } catch (err) {
    if (told > 0) keepClosed(cwd, manifest);
    throw err;
  }
}

/** The record of what a refused cancel closed saved and committed alone, the unit otherwise as it stood. @param {string} cwd @param {Record<string, any>} manifest */
function keepClosed(cwd, manifest) {
  saveWorkUnitManifest(cwd, manifest.name, manifest);
  commitStateTail(cwd, [`${manifest.name}/manifest.json`], `ledger(${manifest.name}): record the pull requests its cancel closed`, []);
}

/**
 * Cancel a work unit: its code left first — a quick-fix's checkout taken
 * back, the holder's work set aside, and every pull request open on its
 * branches closed, the branches kept, those the host names recorded
 * (`leaveCode`, 18.3.9) — then `status: cancelled`, its open experiments
 * ended abandoned, every roadmap item joined to it put back with the joins
 * recorded on it, and each of its topics' waiting mail moved to the inbox
 * as ideas under the same lock (18.4.22, 18.8.20, 10.1.6), remove its
 * knowledge-base chunks (warn-don't-block), commit scoped to the work unit
 * and the ideas. Refuses an already-cancelled unit, and a completed one,
 * which stays finished (`finishedRefusal`) — cancellation is only offered
 * on active work.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @returns {WorkUnitLifecycleResult}
 */
function cancelWorkUnit(cwd, workUnit) {
  assertLegalStatus('cancelled');
  const { mail, abandoned, reverted, gone, left } = withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    if (manifest.status === 'cancelled') {
      throw new Error(`work unit "${workUnit}" is already cancelled`);
    }
    if (manifest.status === 'completed') throw new Error(finishedRefusal(workUnit));
    const code = leaveCode(cwd, manifest);
    manifest.status = 'cancelled';
    const ended = abandonUnitExperiments(manifest);
    // The cancel-revert hop, whole-unit form: every roadmap item joined to
    // the unit returns to waiting, the joins recorded on the unit for its
    // reactivate. The project manifest rides this commit when a revert landed.
    const hop = revertJoins(cwd, workUnit);
    recordPutBack(manifest, hop.joins);

    saveWorkUnitManifest(cwd, workUnit, manifest);
    return { mail: moveUnitMailToInbox(cwd, manifest), abandoned: ended, reverted: hop.reverted, gone: hop.horizon_gone, left: code };
  });

  /** @type {string[]} */
  const warnings = [...(left.warnings ?? [])];
  syncKnowledge(cwd, [{ remove: { workUnit } }], warnings);

  purgeWorkUnitCache(cwd, workUnit);
  const specs = [workUnit, ...mail.map(({ idea }) => idea)];
  if (reverted.length > 0) specs.push('manifest.json');
  const outcome = commitStateTail(cwd, specs, `ledger(${workUnit}): mark as cancelled`, warnings);
  /** @type {WorkUnitLifecycleResult} */
  const result = { work_unit: workUnit, status: 'cancelled', inbox: mail.map(({ idea }) => statePath(cwd, idea)), pull_requests_closed: left.closed, committed: outcome.committed, warnings };
  if (left.checkout !== null) result.checkout = left.checkout;
  if (reverted.length > 0) result.roadmap_reverted = reverted;
  if (gone.length > 0) result.roadmap_horizon_gone = gone;
  if (abandoned.length > 0) result.abandoned = abandoned;
  noteCommitOutcome(result, outcome);
  return result;
}

/**
 * Re-index a work unit's chunk-backed material: the bulk pass scoped to the
 * unit — the record copies and the short record.
 *
 * `clearFirst` (pivot) removes the unit's chunks before re-indexing: a pivot
 * restamps the work_type of chunks already indexed, which the bulk pass
 * would otherwise leave standing. Reactivation from a cancel starts from
 * removed chunks, so the index alone restores them.
 * @param {string} cwd @param {string} workUnit @param {string[]} warnings
 * @param {{clearFirst?: boolean}} [opts]
 */
function reindexWorkUnit(cwd, workUnit, warnings, opts) {
  syncKnowledge(cwd, [
    ...(opts && opts.clearFirst ? [{ remove: { workUnit } }] : []),
    { reindex: workUnit },
  ], warnings);
}

/**
 * Reactivate a cancelled work unit: `status: in-progress`, the roadmap
 * items its cancel put back taken back where they still wait (18.8.20), the
 * next cancel's entry of the pull requests closed opened (cancel-closed.cjs),
 * commit scoped to the work unit. A finished pipeline (derived next phase
 * `done`) is no bar. A completed unit is refused, nothing written: it stays
 * finished (`finishedRefusal`). Cancellation removed the unit's
 * knowledge-base chunks, so reactivating re-indexes them (warn-don't-block).
 * @param {string} cwd project root
 * @param {string} workUnit
 * @returns {WorkUnitLifecycleResult}
 */
function reactivateWorkUnit(cwd, workUnit) {
  assertLegalStatus('in-progress');
  const { previous, rejoined, stayed } = withWorkUnitLock(cwd, workUnit, () => {
    const loaded = loadWorkUnitManifest(cwd, workUnit);
    if (loaded.status === 'in-progress') {
      throw new Error(`work unit "${workUnit}" is already in-progress`);
    }
    if (loaded.status === 'completed') throw new Error(finishedRefusal(workUnit));
    if (loaded.status !== 'cancelled') {
      throw new Error(`work unit "${workUnit}" is not cancelled (status: ${loaded.status ?? 'none'})`);
    }
    const from = loaded.status;
    loaded.status = 'in-progress';
    nextCancel(loaded);
    const retaken = retakeJoins(cwd, workUnit, loaded);

    saveWorkUnitManifest(cwd, workUnit, loaded);
    return { previous: from, ...retaken };
  });

  /** @type {string[]} */
  const warnings = [];
  reindexWorkUnit(cwd, workUnit, warnings);

  const specs = rejoined.length > 0 ? [workUnit, 'manifest.json'] : workUnit;
  const outcome = commitStateTail(cwd, specs, `ledger(${workUnit}): reactivate work unit`, warnings);
  /** @type {WorkUnitLifecycleResult} */
  const result = { work_unit: workUnit, status: 'in-progress', previous_status: previous, committed: outcome.committed, warnings };
  if (rejoined.length > 0) result.roadmap_rejoined = rejoined;
  if (stayed.length > 0) result.roadmap_stayed = stayed;
  noteCommitOutcome(result, outcome);
  return result;
}

/**
 * @typedef {object} WorkUnitPivotResult
 * @property {string} work_unit
 * @property {string} work_type  always `epic`
 * @property {string|null} committed  short commit sha, or null when nothing was staged
 * @property {string} [note]     set when committed is null
 * @property {string[]} warnings non-blocking failures (knowledge-base re-index)
 */

/**
 * Pivot a feature to an epic: flip `work_type` in the work-unit manifest AND
 * the project manifest's registration; in the same save, the feature's single
 * topic (topic name = work unit name) on the discovery map with the summary
 * and description Claude drafted from its record and its log (18.3.7), first
 * in its order, and the map approved at the pivot
 * (`phases.discovery.approved_at`, 18.3.5), as approve-map's yes orders and
 * approves a map; re-index the unit so chunk metadata carries the new work_type
 * (warn-don't-block), and commit both manifests. Only an in-progress feature
 * before its spec pivots, its topic gone past it (4.11.2).
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {{summary?: string, description?: string}} topic  its map row's words
 * @returns {WorkUnitPivotResult}
 */
function pivotWorkUnit(cwd, workUnit, topic) {
  const entry = arrivingEntry(workUnit, topic, 'workunit pivot');
  withWorkUnitLock(cwd, workUnit, () => {
    const loaded = loadWorkUnitManifest(cwd, workUnit);
    if (loaded.work_type !== 'feature') {
      throw new Error(`work unit "${workUnit}" is not a feature (work_type: ${loaded.work_type ?? 'none'}) — only features pivot to epics`);
    }
    if (loaded.status === 'completed') throw new Error(finishedRefusal(workUnit));
    if (loaded.status !== 'in-progress') {
      throw new Error(`work unit "${workUnit}" is not in-progress (status: ${loaded.status ?? 'none'}) — reactivate it first`);
    }
    assertBeforeSpec(cwd, loaded, 'ownWork');
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
    addBatchTo(loaded, [entry], null);
    discoveryItems(loaded)[workUnit].order = 1;
    loaded.phases.discovery.approved_at = new Date().toISOString();
    saveWorkUnitManifest(cwd, workUnit, loaded);
  });

  // The registration must agree with the manifest — a fresh read under the
  // project lock, upserted.
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

  const outcome = commitStateTail(cwd, [workUnit, 'manifest.json'], `ledger(${workUnit}): pivot to epic`, warnings);
  /** @type {WorkUnitPivotResult} */
  const result = { work_unit: workUnit, work_type: 'epic', committed: outcome.committed, warnings };
  noteCommitOutcome(result, outcome);
  return result;
}

module.exports = { completeWorkUnit, cancelWorkUnit, reactivateWorkUnit, pivotWorkUnit, reindexWorkUnit };
