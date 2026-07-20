'use strict';

// ---------------------------------------------------------------------------
// Domain ring: topic transitions — start, complete, cancel, and reactivate,
// each a single transaction from the caller's perspective.
//
// start/complete are phase-item lifecycle bookkeeping: manifest write plus,
// for complete in an indexed phase, a knowledge-base index. No git commit —
// the calling session's commit cadence picks the manifest change up.
// cancel/reactivate are the epic transactions: manifest write, knowledge-base
// sync, scoped git commit.
//
// The manifest write is the source of truth and lands first; the knowledge
// base is a derived index, so its failures are recorded as warnings, never
// blocks. Validation throws loud and specific before anything is touched.
// ---------------------------------------------------------------------------

const { loadWorkUnitManifest, saveWorkUnitManifest } = require('../kernel/manifest.cjs');
const { commitScoped } = require('../kernel/git.cjs');
const { knowledge, INDEXED_ARTIFACTS } = require('./kb.cjs');

const { VALID_PHASES, VALID_PHASE_STATUSES } = require('../../../workflow-shared/scripts/manifest-schema.cjs');

// Phase-item lifecycle operates on WORK phases only. Discovery items are map
// items (no lifecycle status — computed at render time); they are created and
// edited by the discovery tooling, never by topic commands.
const LIFECYCLE_PHASES = VALID_PHASES.filter((p) => p !== 'discovery');

// Refuse any status write the manifest CLI would refuse — the two enforcers
// share one schema (workflow-shared/scripts/manifest-schema.cjs), so the
// engine can never be the permissive path around a validation refusal.
/** @param {string} phase @param {string} status */
function assertLegalWrite(phase, status) {
  if (!LIFECYCLE_PHASES.includes(phase)) {
    throw new Error(`unknown or non-lifecycle phase "${phase}" (${LIFECYCLE_PHASES.join('|')}) — discovery items are map items; use the discovery tooling`);
  }
  const valid = VALID_PHASE_STATUSES[/** @type {keyof typeof VALID_PHASE_STATUSES} */ (phase)];
  if (!valid || !valid.includes(status)) {
    throw new Error(`Invalid status "${status}" for phase "${phase}". Must be one of: ${(valid || []).join(', ')}`);
  }
}

/**
 * @typedef {object} TopicTransitionResult
 * @property {string} topic
 * @property {string} phase
 * @property {string} status     the topic's status after the transition
 * @property {string|null} committed  short commit sha, or null when nothing was staged
 * @property {string} [note]     set when committed is null
 * @property {string[]} warnings non-blocking failures (knowledge-base sync)
 */

/**
 * The phase item for `topic`, or a loud error.
 * @param {object} manifest @param {string} phase @param {string} topic
 * @returns {{status?: string, previous_status?: string}}
 */
function phaseItem(manifest, phase, topic) {
  assertLegalWrite(phase, 'cancelled');
  const phases = manifest && manifest.phases;
  const ph = phases && typeof phases === 'object' ? phases[phase] : undefined;
  const items = ph && typeof ph === 'object' ? ph.items : undefined;
  if (!items || typeof items !== 'object') {
    throw new Error(`no ${phase} items in the manifest (phases.${phase}.items)`);
  }
  const item = items[topic];
  if (!item || typeof item !== 'object') {
    throw new Error(`no ${phase} item "${topic}" in the manifest (phases.${phase}.items)`);
  }
  return item;
}

/**
 * @typedef {object} TopicStartResult
 * @property {string} topic
 * @property {string} phase
 * @property {string} status   always `in-progress`
 * @property {boolean} created true when the phase item was created, false when resumed
 */

/**
 * @typedef {object} TopicCompleteResult
 * @property {string} topic
 * @property {string} phase
 * @property {string} status   always `completed`
 * @property {string[]} warnings non-blocking failures (knowledge-base index)
 */

/**
 * Start a phase item: create it with `status: in-progress` when absent
 * (init-phase semantics), or set an existing item back to `in-progress`.
 * A completed item is not startable — resuming is not starting — and a
 * cancelled item must go through reactivate. No git commit.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} phase
 * @param {string} topic
 * @returns {TopicStartResult}
 */
function startTopic(cwd, workUnit, phase, topic) {
  assertLegalWrite(phase, 'in-progress');
  const manifest = loadWorkUnitManifest(cwd, workUnit);
  if (!manifest.phases || typeof manifest.phases !== 'object') manifest.phases = {};
  if (!manifest.phases[phase] || typeof manifest.phases[phase] !== 'object') manifest.phases[phase] = {};
  const ph = manifest.phases[phase];
  if (!ph.items || typeof ph.items !== 'object') ph.items = {};

  const existing = ph.items[topic];
  let created = false;
  if (!existing || typeof existing !== 'object') {
    ph.items[topic] = { status: 'in-progress' };
    created = true;
  } else if (existing.status === 'completed') {
    throw new Error(`${phase} item "${topic}" is already completed — start cannot resume it`);
  } else if (existing.status === 'cancelled') {
    throw new Error(`${phase} item "${topic}" is cancelled — reactivate it instead`);
  } else {
    existing.status = 'in-progress';
  }

  saveWorkUnitManifest(cwd, workUnit, manifest);
  return { topic, phase, status: 'in-progress', created };
}

/**
 * Complete a phase item: set `status: completed` and, when the phase's
 * artifact is knowledge-base indexed, index it (warn-don't-block). The item
 * must exist; a cancelled item must go through reactivate first. No git
 * commit.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} phase
 * @param {string} topic
 * @returns {TopicCompleteResult}
 */
function completeTopic(cwd, workUnit, phase, topic) {
  assertLegalWrite(phase, 'completed');
  const manifest = loadWorkUnitManifest(cwd, workUnit);
  const item = phaseItem(manifest, phase, topic);
  if (item.status === 'cancelled') {
    throw new Error(`${phase} item "${topic}" is cancelled — reactivate it instead`);
  }
  item.status = 'completed';

  saveWorkUnitManifest(cwd, workUnit, manifest);

  /** @type {string[]} */
  const warnings = [];
  const artifact = INDEXED_ARTIFACTS[/** @type {keyof typeof INDEXED_ARTIFACTS} */ (phase)];
  if (artifact) {
    knowledge(cwd, ['index', artifact(workUnit, topic)], 'knowledge index', warnings);
  }

  return { topic, phase, status: 'completed', warnings };
}

/**
 * Cancel an epic topic: stash the current status into `previous_status`, set
 * `status: cancelled`, drop the topic's discovery-map `order`, remove its
 * knowledge-base chunks (warn-don't-block), commit scoped to the work unit.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} phase
 * @param {string} topic
 * @returns {TopicTransitionResult}
 */
function cancelTopic(cwd, workUnit, phase, topic) {
  const manifest = loadWorkUnitManifest(cwd, workUnit);
  const item = phaseItem(manifest, phase, topic);
  if (item.status === 'cancelled') {
    throw new Error(`${phase} item "${topic}" is already cancelled`);
  }
  item.previous_status = item.status;
  item.status = 'cancelled';

  const discovery = manifest.phases && manifest.phases.discovery;
  const mapItem = discovery && discovery.items ? discovery.items[topic] : undefined;
  if (mapItem && typeof mapItem === 'object' && 'order' in mapItem) delete mapItem.order;

  saveWorkUnitManifest(cwd, workUnit, manifest);

  /** @type {string[]} */
  const warnings = [];
  knowledge(cwd, ['remove', '--work-unit', workUnit, '--phase', phase, '--topic', topic], 'knowledge remove', warnings);

  const committed = commitScoped(cwd, `.workflows/${workUnit}`, `workflow(${workUnit}): cancel ${topic} (${phase})`);
  /** @type {TopicTransitionResult} */
  const result = { topic, phase, status: 'cancelled', committed, warnings };
  if (committed === null) result.note = 'nothing to commit';
  return result;
}

/**
 * Reactivate a cancelled epic topic: restore `previous_status` to `status`,
 * delete the stash, re-index the artifact when the restored status is
 * `completed` in an indexed phase (warn-don't-block), commit scoped to the
 * work unit.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} phase
 * @param {string} topic
 * @returns {TopicTransitionResult}
 */
function reactivateTopic(cwd, workUnit, phase, topic) {
  const manifest = loadWorkUnitManifest(cwd, workUnit);
  const item = phaseItem(manifest, phase, topic);
  if (item.status !== 'cancelled') {
    throw new Error(`${phase} item "${topic}" is not cancelled (status: ${item.status ?? 'none'})`);
  }
  const restored = item.previous_status;
  if (!restored) {
    throw new Error(`${phase} item "${topic}" has no previous_status to restore`);
  }
  assertLegalWrite(phase, restored);
  item.status = restored;
  delete item.previous_status;

  saveWorkUnitManifest(cwd, workUnit, manifest);

  /** @type {string[]} */
  const warnings = [];
  const artifact = INDEXED_ARTIFACTS[/** @type {keyof typeof INDEXED_ARTIFACTS} */ (phase)];
  if (restored === 'completed' && artifact) {
    knowledge(cwd, ['index', artifact(workUnit, topic)], 'knowledge index', warnings);
  }

  const committed = commitScoped(cwd, `.workflows/${workUnit}`, `workflow(${workUnit}): reactivate ${topic} (${phase})`);
  /** @type {TopicTransitionResult} */
  const result = { topic, phase, status: restored, committed, warnings };
  if (committed === null) result.note = 'nothing to commit';
  return result;
}

module.exports = { startTopic, completeTopic, cancelTopic, reactivateTopic };
