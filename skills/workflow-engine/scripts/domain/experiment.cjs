'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the experiment series — the ordered run of experiments one
// topic holds (`phases.experiment.items.{topic}.experiments.{id}`), each a
// frozen design plus a report on disk under
// `.workflows/{wu}/experiment/{topic}/{id}-{slug}/`. The engine records the
// lifecycle; every document is model-authored — the engine never writes
// prose.
//
// The series lifecycle is the design-before-data invariant made mechanical:
// conceived → designed → approved (the confirm gate's freeze) → running →
// concluded (with its one-line verdict) | abandoned (with its reason, from
// any pre-terminal status). `advance` walks the mechanical steps; `approve`
// is deliberately its own verb — the user-confirmed freeze, never a step a
// loop drifts past. Concluding or abandoning an experiment releases any
// evidence wait the same-topic discussion holds on it (`await` records the
// wait) and flags the discussion for its next entry — the release edges live
// in transitions, the one home for the reconcile machinery.
//
// Judgment decides, code records. All errors throw loud and specific before
// anything is written; every load→mutate→save runs under the work unit's
// manifest lock. No git commit — the calling session's commit cadence picks
// the manifest change up (`commit --topic experiment/{topic}`).
// ---------------------------------------------------------------------------

const { loadWorkUnitManifest, saveWorkUnitManifest, withWorkUnitLock } = require('../kernel/manifest.cjs');
const { VALID_EXPERIMENT_STATUSES, EXPERIMENT_TERMINAL_STATUSES } = require('../kernel/manifest-schema.cjs');
const { awaitedExperiments } = require('./derivations.cjs');
const { flagDownstream, releaseExperimentWaits } = require('./transitions.cjs');

// The mechanical steps `advance` walks. designed → approved is missing on
// purpose: that transition is the briefing gate's freeze (`approve`).
const ADVANCE_STEPS = { conceived: 'designed', approved: 'running' };

/** @param {string} id */
function assertLegalId(id) {
  if (!/^E[1-9][0-9]*$/.test(id)) {
    throw new Error(`invalid experiment id "${id}" — ids are E1, E2, …`);
  }
}

/** One line, non-empty — the register's row form. @param {string} label @param {string|undefined} value */
function assertOneLine(label, value) {
  if (typeof value !== 'string' || value.trim() === '' || value.includes('\n')) {
    throw new Error(`${label} must be one non-empty line`);
  }
}

/**
 * The topic's experiment phase item, writable — a loud error when the topic
 * has no live experiment item to record against.
 * @param {object} manifest @param {string} topic
 * @returns {{status?: string, experiments?: Record<string, ExperimentRecord>}}
 */
function writableItem(manifest, topic) {
  const phases = manifest && manifest.phases;
  const ph = phases && typeof phases === 'object' ? phases.experiment : undefined;
  const items = ph && typeof ph === 'object' ? ph.items : undefined;
  const item = items && typeof items === 'object' ? items[topic] : undefined;
  if (!item || typeof item !== 'object') {
    throw new Error(`no experiment item "${topic}" in the manifest — start the topic first (topic start)`);
  }
  if (item.status === 'triaged') {
    throw new Error(`experiment item "${topic}" is triaged — parked concerns have never been worked; start the topic first`);
  }
  if (item.status === 'completed') {
    throw new Error(`experiment item "${topic}" is completed — reopen it to run another experiment`);
  }
  if (item.status === 'cancelled') {
    throw new Error(`experiment item "${topic}" is cancelled — reactivate it instead`);
  }
  return item;
}

/**
 * @typedef {object} ExperimentRecord
 * @property {string} slug
 * @property {string} status   one of VALID_EXPERIMENT_STATUSES
 * @property {string} [verdict]  one line, recorded at conclusion
 * @property {string} [reason]   one line, recorded at abandonment
 */

/**
 * The `id` record in the item's series, or a loud error.
 * @param {{experiments?: Record<string, ExperimentRecord>}} item @param {string} topic @param {string} id
 * @returns {ExperimentRecord}
 */
function seriesRecord(item, topic, id) {
  assertLegalId(id);
  const record = (item.experiments || {})[id];
  if (!record || typeof record !== 'object') {
    throw new Error(`no experiment ${id} in "${topic}"'s series`);
  }
  return record;
}

/** @param {ExperimentRecord} record @param {string} topic @param {string} id */
function assertNotTerminal(record, topic, id) {
  if (record.status === 'concluded') {
    throw new Error(`experiment ${id} ("${topic}") is concluded — its verdict stands; a flawed run triggers the next experiment, never a re-score`);
  }
  if (record.status === 'abandoned') {
    throw new Error(`experiment ${id} ("${topic}") is abandoned — abandonment is terminal; conceive a successor instead`);
  }
}

/** The record's on-disk home, project-relative. @param {string} workUnit @param {string} topic @param {string} id @param {string} slug */
function recordDir(workUnit, topic, id, slug) {
  return `.workflows/${workUnit}/experiment/${topic}/${id}-${slug}`;
}

/**
 * @typedef {object} ExperimentOpResult
 * @property {string} topic
 * @property {string} id
 * @property {string} slug
 * @property {string} status   the record's status after the op
 * @property {string} dir      the record's directory, project-relative
 * @property {string} [previous]  the status before the op (advance/approve)
 * @property {string} [verdict]
 * @property {string} [reason]
 * @property {import('./transitions.cjs').WaitReleaseResult} [released_wait]
 * @property {{phase: string, topic: string}[]} [reconcile_flagged]
 */

/**
 * Conceive the next experiment in a topic's series: allocate `E{n}` (per-topic
 * numbering — highest existing plus one) and record it `conceived`. The item
 * must be in-progress; the record's directory is the response's `dir`, where
 * the design is authored before anything is measured.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} topic
 * @param {{slug: string}} opts
 * @returns {ExperimentOpResult}
 */
function createExperiment(cwd, workUnit, topic, { slug }) {
  if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`--slug must be kebab-case, got "${slug ?? ''}"`);
  }
  return withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const item = writableItem(manifest, topic);
    const experiments = item.experiments && typeof item.experiments === 'object' ? item.experiments : {};
    const n = Object.keys(experiments)
      .map((id) => (/^E([1-9][0-9]*)$/.exec(id) || [])[1])
      .filter(Boolean)
      .reduce((max, digits) => Math.max(max, Number(digits)), 0) + 1;
    const id = `E${n}`;
    experiments[id] = { slug, status: 'conceived' };
    item.experiments = experiments;
    saveWorkUnitManifest(cwd, workUnit, manifest);
    return { topic, id, slug, status: 'conceived', dir: recordDir(workUnit, topic, id, slug) };
  });
}

/**
 * One shared status write: load, guard, step, save, answer. The transition
 * itself is the caller's closure over the loaded record.
 * @param {string} cwd @param {string} workUnit @param {string} topic @param {string} id
 * @param {(record: ExperimentRecord, manifest: object) => Partial<ExperimentOpResult>} step
 * @returns {ExperimentOpResult}
 */
function recordTransition(cwd, workUnit, topic, id, step) {
  return withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const item = writableItem(manifest, topic);
    const record = seriesRecord(item, topic, id);
    const extra = step(record, manifest);
    saveWorkUnitManifest(cwd, workUnit, manifest);
    return { topic, id, slug: record.slug, status: record.status, dir: recordDir(workUnit, topic, id, record.slug), ...extra };
  });
}

/**
 * Advance an experiment one mechanical step: conceived → designed (the design
 * is written), approved → running (measurement begins). The freeze between
 * them is `approve`; past `running` the exits are conclude and abandon.
 * @param {string} cwd project root
 * @param {string} workUnit @param {string} topic @param {string} id
 * @returns {ExperimentOpResult}
 */
function advanceExperiment(cwd, workUnit, topic, id) {
  return recordTransition(cwd, workUnit, topic, id, (record) => {
    assertNotTerminal(record, topic, id);
    if (record.status === 'designed') {
      throw new Error(`experiment ${id} ("${topic}") is designed — the design freezes at the user-confirmed briefing; record it with experiment approve`);
    }
    if (record.status === 'running') {
      throw new Error(`experiment ${id} ("${topic}") is running — conclude it with its verdict, or abandon it with its reason`);
    }
    const next = ADVANCE_STEPS[/** @type {keyof typeof ADVANCE_STEPS} */ (record.status)];
    if (!next) {
      throw new Error(`experiment ${id} ("${topic}") has status "${record.status}" — expected one of: ${VALID_EXPERIMENT_STATUSES.join(', ')}`);
    }
    const previous = /** @type {string} */ (record.status);
    record.status = next;
    return { previous };
  });
}

/**
 * Record the briefing gate's freeze: designed → approved, and nothing else —
 * the one transition that requires the user's confirm, so it is never a step
 * `advance` can drift past. From `approved` the design is frozen: flaws found
 * after results are visible go in the report's corrections and trigger the
 * next experiment.
 * @param {string} cwd project root
 * @param {string} workUnit @param {string} topic @param {string} id
 * @returns {ExperimentOpResult}
 */
function approveExperiment(cwd, workUnit, topic, id) {
  return recordTransition(cwd, workUnit, topic, id, (record) => {
    if (record.status !== 'designed') {
      assertNotTerminal(record, topic, id);
      throw new Error(`experiment ${id} ("${topic}") is ${record.status} — only a designed experiment takes the approval freeze`);
    }
    record.status = 'approved';
    return { previous: 'designed' };
  });
}

/**
 * Conclude a running experiment with its one-line verdict — the decision
 * rule's outcome, recorded on the register row. Releases the same-topic
 * discussion's evidence wait on this id (flagging the discussion for its next
 * entry) and runs the one-hop flag on a completed same-topic discussion —
 * evidence arriving after a decision must surface before the record is
 * trusted.
 * @param {string} cwd project root
 * @param {string} workUnit @param {string} topic @param {string} id
 * @param {{verdict: string}} opts
 * @returns {ExperimentOpResult}
 */
function concludeExperiment(cwd, workUnit, topic, id, { verdict }) {
  assertOneLine('--verdict', verdict);
  return recordTransition(cwd, workUnit, topic, id, (record, manifest) => {
    assertNotTerminal(record, topic, id);
    if (record.status !== 'running') {
      throw new Error(`experiment ${id} ("${topic}") is ${record.status} — only a running experiment concludes; the design exists before the data, and the data before the verdict`);
    }
    record.status = 'concluded';
    record.verdict = verdict.trim();
    /** @type {Partial<ExperimentOpResult>} */
    const extra = { verdict: record.verdict };
    const fd = flagDownstream(manifest, /** @type {{work_type: string}} */ (manifest).work_type, 'experiment', topic);
    if (fd.flagged.length > 0) extra.reconcile_flagged = fd.flagged;
    const release = releaseExperimentWaits(manifest, topic, { ids: [id] });
    if (release) extra.released_wait = release;
    return extra;
  });
}

/**
 * Abandon an experiment from any pre-terminal status, with its one-line
 * reason — a first-class terminal: the register keeps the row. Releases the
 * same-topic discussion's evidence wait on this id; the release flags the
 * discussion so its next entry surfaces the abandonment, and the waiting
 * point reverts to open.
 * @param {string} cwd project root
 * @param {string} workUnit @param {string} topic @param {string} id
 * @param {{reason: string}} opts
 * @returns {ExperimentOpResult}
 */
function abandonExperiment(cwd, workUnit, topic, id, { reason }) {
  assertOneLine('--reason', reason);
  return recordTransition(cwd, workUnit, topic, id, (record, manifest) => {
    assertNotTerminal(record, topic, id);
    record.status = 'abandoned';
    record.reason = reason.trim();
    /** @type {Partial<ExperimentOpResult>} */
    const extra = { reason: record.reason };
    const release = releaseExperimentWaits(manifest, topic, { ids: [id] });
    if (release) extra.released_wait = release;
    return extra;
  });
}

/**
 * Record an evidence wait: the same-topic in-progress discussion is blocked
 * pending this experiment's outcome (`awaiting_experiments` on the discussion
 * item — engine-owned, released only by conclude/abandon/cancel). Written by
 * the mid-discussion exit flow; a discussion holding a wait cannot conclude.
 * @param {string} cwd project root
 * @param {string} workUnit @param {string} topic @param {string} id
 * @returns {{topic: string, id: string, discussion: string, awaiting: string[]}}
 */
function awaitExperiment(cwd, workUnit, topic, id) {
  assertLegalId(id);
  return withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const item = writableItem(manifest, topic);
    const record = seriesRecord(item, topic, id);
    if (EXPERIMENT_TERMINAL_STATUSES.includes(/** @type {string} */ (record.status))) {
      throw new Error(`experiment ${id} ("${topic}") is ${record.status} — there is nothing to wait for; read the register`);
    }
    const phases = /** @type {{phases?: {discussion?: {items?: Record<string, {status?: string}>}}}} */ (manifest).phases;
    const discussion = ((phases && phases.discussion && phases.discussion.items) || {})[topic];
    if (!discussion || typeof discussion !== 'object') {
      throw new Error(`no discussion item "${topic}" to hold the wait — the evidence wait lives on the same-topic discussion`);
    }
    if (discussion.status !== 'in-progress') {
      throw new Error(`discussion "${topic}" is ${discussion.status ?? 'not started'} — an evidence wait is placed mid-discussion, on an in-progress item`);
    }
    const awaiting = awaitedExperiments(manifest, topic);
    if (awaiting.includes(id)) {
      throw new Error(`discussion "${topic}" already awaits experiment ${id}`);
    }
    /** @type {{awaiting_experiments?: string[]}} */ (discussion).awaiting_experiments = [...awaiting, id];
    saveWorkUnitManifest(cwd, workUnit, manifest);
    return { topic, id, discussion: topic, awaiting: [...awaiting, id] };
  });
}

module.exports = { createExperiment, advanceExperiment, approveExperiment, concludeExperiment, abandonExperiment, awaitExperiment };
