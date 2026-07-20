'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the discussion map — typed subtopic state under a discussion
// item (`phases.discussion.items.{topic}.subtopics`).
//
// Judgment decides, code records: the conversation makes every state call;
// these transitions validate and write it. Two levels max — a subtopic's
// `parent` names another subtopic that is itself top-level. Subtopic keys are
// kebab-case slugs (display titlecases them); insertion order is render
// order. All errors throw loud and specific. The CLI transactions
// (recordSubtopicAdd / recordSubtopicState) run load→apply→save under the
// work unit's manifest lock (the same lock every manifest writer honours)
// with NO git commit — the calling session's commit cadence picks the
// manifest change up.
// ---------------------------------------------------------------------------

const { loadWorkUnitManifest, saveWorkUnitManifest, withWorkUnitLock } = require('../kernel/manifest.cjs');

const SUBTOPIC_STATES = ['pending', 'exploring', 'converging', 'decided', 'deferred'];

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * @typedef {object} Subtopic
 * @property {string} status       `pending` | `exploring` | `converging` | `decided` | `deferred`
 * @property {string|null} parent  another subtopic's key (itself top-level), or null
 */

/**
 * @typedef {object} SubtopicCounts
 * @property {number} pending
 * @property {number} exploring
 * @property {number} converging
 * @property {number} decided
 * @property {number} deferred
 */

/**
 * @typedef {object} MapState
 * @property {SubtopicCounts} counts
 * @property {number} total
 * @property {boolean} all_decided  every subtopic `decided` or `deferred`; false when zero subtopics
 * @property {string[]} unresolved  names not `decided`/`deferred`, insertion order
 */

/**
 * @typedef {object} SubtopicWriteResult
 * @property {string} subtopic         the subtopic written
 * @property {string} status           its status after the write
 * @property {boolean} all_decided     from mapState after the write
 * @property {number} unresolved_count from mapState after the write
 */

/**
 * The discussion item for `topic`, or a loud error.
 * @param {object} manifest @param {string} topic
 * @returns {{status?: string, subtopics?: Record<string, Subtopic>}}
 */
function discussionItem(manifest, topic) {
  const items = manifest && manifest.phases && manifest.phases.discussion && manifest.phases.discussion.items;
  const item = items && typeof items === 'object' ? items[topic] : undefined;
  if (!item || typeof item !== 'object') {
    throw new Error(`no discussion item "${topic}" in the manifest (phases.discussion.items)`);
  }
  return item;
}

/**
 * The subtopics record of a discussion item ({} when none yet).
 * @param {object} manifest @param {string} topic
 * @returns {Record<string, Subtopic>}
 */
function subtopicsOf(manifest, topic) {
  const item = discussionItem(manifest, topic);
  return item.subtopics && typeof item.subtopics === 'object' ? item.subtopics : {};
}

/**
 * Add a subtopic to a discussion item's map. New subtopics start `pending`.
 * @param {object} manifest
 * @param {string} topic
 * @param {string} name           kebab-case slug
 * @param {{parent?: string|null}} [opts]  nest under this top-level subtopic
 * @returns {Subtopic} the new subtopic
 */
function addSubtopic(manifest, topic, name, { parent = null } = {}) {
  const item = discussionItem(manifest, topic);
  if (!name || !SLUG_RE.test(name)) {
    throw new Error(`subtopic name must be a kebab-case slug (got "${name}")`);
  }
  if (!item.subtopics || typeof item.subtopics !== 'object') item.subtopics = {};
  const subtopics = item.subtopics;
  if (subtopics[name]) {
    throw new Error(`subtopic "${name}" already exists under "${topic}"`);
  }
  if (parent !== null) {
    const parentSub = subtopics[parent];
    if (!parentSub) {
      throw new Error(`parent subtopic "${parent}" not found under "${topic}"`);
    }
    if (parentSub.parent !== null) {
      throw new Error(`"${parent}" is itself a child of "${parentSub.parent}" — the map is two levels max`);
    }
  }
  subtopics[name] = { status: 'pending', parent };
  return subtopics[name];
}

/**
 * Record a subtopic state. Any state → any state is legal (judgment may
 * revisit); the enum is the only constraint.
 * @param {object} manifest
 * @param {string} topic
 * @param {string} name
 * @param {string} state  one of SUBTOPIC_STATES
 * @returns {Subtopic} the updated subtopic
 */
function setSubtopicState(manifest, topic, name, state) {
  if (!SUBTOPIC_STATES.includes(state)) {
    throw new Error(`unknown subtopic state "${state}" (${SUBTOPIC_STATES.join('|')})`);
  }
  const subtopics = subtopicsOf(manifest, topic);
  const sub = subtopics[name];
  if (!sub) {
    throw new Error(`subtopic "${name}" not found under "${topic}"`);
  }
  sub.status = state;
  return sub;
}

/**
 * Derived, decision-ready state of one discussion item's map.
 * @param {object} manifest @param {string} topic
 * @returns {MapState}
 */
function mapState(manifest, topic) {
  const subtopics = subtopicsOf(manifest, topic);
  /** @type {SubtopicCounts} */
  const counts = { pending: 0, exploring: 0, converging: 0, decided: 0, deferred: 0 };
  /** @type {string[]} */
  const unresolved = [];
  let total = 0;
  for (const [name, sub] of Object.entries(subtopics)) {
    const status = sub && sub.status;
    if (!SUBTOPIC_STATES.includes(/** @type {string} */ (status))) {
      throw new Error(`subtopic "${name}" under "${topic}" has unknown state "${status}"`);
    }
    counts[/** @type {keyof SubtopicCounts} */ (status)] += 1;
    total += 1;
    if (status !== 'decided' && status !== 'deferred') unresolved.push(name);
  }
  return {
    counts,
    total,
    all_decided: total > 0 && unresolved.length === 0,
    unresolved,
  };
}

/**
 * Decision-ready body of a subtopic write: the subtopic written plus the
 * map's derived convergence state.
 * @param {object} manifest @param {string} topic @param {string} name @param {string} status
 * @returns {SubtopicWriteResult}
 */
function subtopicWriteResult(manifest, topic, name, status) {
  const state = mapState(manifest, topic);
  return {
    subtopic: name,
    status,
    all_decided: state.all_decided,
    unresolved_count: state.unresolved.length,
  };
}

/**
 * The `discussion-map add` transaction: load → addSubtopic → save under the
 * work unit's manifest lock. No git commit.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} topic
 * @param {string} name           kebab-case slug
 * @param {{parent?: string|null}} [opts]  nest under this top-level subtopic
 * @returns {SubtopicWriteResult}
 */
function recordSubtopicAdd(cwd, workUnit, topic, name, { parent = null } = {}) {
  const { manifest, sub } = withWorkUnitLock(cwd, workUnit, () => {
    const loaded = loadWorkUnitManifest(cwd, workUnit);
    const applied = addSubtopic(loaded, topic, name, { parent });
    saveWorkUnitManifest(cwd, workUnit, loaded);
    return { manifest: loaded, sub: applied };
  });
  return subtopicWriteResult(manifest, topic, name, sub.status);
}

/**
 * The `discussion-map set` transaction: load → setSubtopicState → save under
 * the work unit's manifest lock. No git commit.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} topic
 * @param {string} name
 * @param {string} state  one of SUBTOPIC_STATES
 * @returns {SubtopicWriteResult}
 */
function recordSubtopicState(cwd, workUnit, topic, name, state) {
  const { manifest, sub } = withWorkUnitLock(cwd, workUnit, () => {
    const loaded = loadWorkUnitManifest(cwd, workUnit);
    const applied = setSubtopicState(loaded, topic, name, state);
    saveWorkUnitManifest(cwd, workUnit, loaded);
    return { manifest: loaded, sub: applied };
  });
  return subtopicWriteResult(manifest, topic, name, sub.status);
}

module.exports = { SUBTOPIC_STATES, addSubtopic, setSubtopicState, mapState, subtopicsOf, recordSubtopicAdd, recordSubtopicState };
