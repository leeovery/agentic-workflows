'use strict';

// ---------------------------------------------------------------------------
// Domain ring: epic topic transitions — cancel and reactivate as single
// transactions. Each call is one atomic state change from the caller's
// perspective: manifest write, knowledge-base sync, scoped git commit.
//
// The manifest write is the source of truth and lands first; the knowledge
// base is a derived index, so its failures are recorded as warnings, never
// blocks. Validation throws loud and specific before anything is touched.
// ---------------------------------------------------------------------------

const path = require('path');
const { spawnSync } = require('child_process');
const { loadWorkUnitManifest, saveWorkUnitManifest } = require('../kernel/manifest.cjs');
const { commitScoped } = require('../kernel/git.cjs');

// Resolved against this file so it works wherever the skill tree is installed.
const KNOWLEDGE_CLI = path.resolve(__dirname, '..', '..', '..', 'workflow-knowledge', 'scripts', 'knowledge.cjs');

const PHASES = ['discovery', 'research', 'discussion', 'investigation', 'scoping', 'specification', 'planning', 'implementation', 'review'];

/** Phases whose completed artifact is knowledge-base indexed, with the artifact path per topic. */
const INDEXED_ARTIFACTS = {
  research: (wu, topic) => `.workflows/${wu}/research/${topic}.md`,
  discussion: (wu, topic) => `.workflows/${wu}/discussion/${topic}.md`,
  investigation: (wu, topic) => `.workflows/${wu}/investigation/${topic}.md`,
  specification: (wu, topic) => `.workflows/${wu}/specification/${topic}/specification.md`,
};

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
  if (!PHASES.includes(phase)) {
    throw new Error(`unknown phase "${phase}" (${PHASES.join('|')})`);
  }
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
 * Spawn the knowledge CLI; on failure push a warning instead of throwing.
 * @param {string} cwd @param {string[]} args @param {string} label @param {string[]} warnings
 */
function knowledge(cwd, args, label, warnings) {
  const res = spawnSync('node', [KNOWLEDGE_CLI, ...args], { cwd, encoding: 'utf8' });
  const failed = res.error || res.status !== 0;
  if (failed) {
    const detail = res.error
      ? res.error.message
      : (res.stderr || res.stdout || `exit ${res.status}`).trim();
    warnings.push(`${label} failed: ${detail}`);
  }
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

module.exports = { cancelTopic, reactivateTopic };
