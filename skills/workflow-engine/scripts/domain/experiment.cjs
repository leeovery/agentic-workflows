'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the experiment series — the ordered run of experiments a
// topic's conversations ever spawned (`phases.experiment.items.{topic}
// .experiments.{id}`), each a frozen design plus a report on disk under
// `.workflows/{wu}/experiment/{topic}/{id}-{slug}/`. The engine records the
// lifecycle; every document is model-authored — the engine never writes
// prose.
//
// The record lifecycle is the design-before-data invariant made mechanical:
// conceived → designed → approved (the briefing's freeze) → running →
// concluded (with its one-line verdict) | abandoned (with its reason, from
// any pre-terminal status). `advance` walks the mechanical steps; `approve`
// is deliberately its own verb — the user-confirmed freeze, never a step a
// loop drifts past. The spawn (`create`) is the phase's one door: it
// allocates the id, installs the spawning session's problem statement
// (moved from a cache scratch — the engine still never writes prose), and
// locks the spawning research or discussion item
// (`awaiting_experiments`); a split creates sub-experiments (`E{n}.{m}`)
// under a running parent, and the lock stays on the parent — it releases
// once, when the parent concludes or is abandoned. The release edges live in
// transitions, the one home for the reconcile machinery.
//
// The phase item is derived bookkeeping over the records: the spawn opens it
// (and reopens a completed series), the last record's terminal transition
// closes it — the user never starts or completes it by hand.
//
// Judgment decides, code records. All errors throw loud and specific before
// anything is written; every load→mutate→save runs under the work unit's
// manifest lock. No git commit — the calling session's commit cadence picks
// the manifest change up (`commit --topic experiment/{topic}`).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { loadWorkUnitManifest, saveWorkUnitManifest, withWorkUnitLock, ensureContainer } = require('../kernel/manifest.cjs');
const {
  VALID_EXPERIMENT_STATUSES,
  EXPERIMENT_TERMINAL_STATUSES,
  EXPERIMENT_ID_PATTERN,
  isParentExperimentId,
  EXPERIMENT_SPAWN_PHASES,
} = require('../kernel/manifest-schema.cjs');
const { settleItemStatus } = require('./derivations.cjs');
const { flagDownstream, releaseExperimentWaits, assertLegalTopicName } = require('./transitions.cjs');

// The mechanical steps `advance` walks. designed → approved is missing on
// purpose: that transition is the briefing gate's freeze (`approve`).
const ADVANCE_STEPS = { conceived: 'designed', approved: 'running' };

/** @param {string} id */
function assertLegalId(id) {
  if (!EXPERIMENT_ID_PATTERN.test(id)) {
    throw new Error(`invalid experiment id "${id}" — ids are E1, E2, … (sub-experiments E1.1, E1.2, …)`);
  }
}

/** One line, non-empty — the register's row form. @param {string} label @param {string|undefined} value */
function assertOneLine(label, value) {
  if (typeof value !== 'string' || value.trim() === '' || value.includes('\n')) {
    throw new Error(`${label} must be one non-empty line`);
  }
}

/**
 * @typedef {object} ExperimentRecord
 * @property {string} slug
 * @property {string} status   one of VALID_EXPERIMENT_STATUSES
 * @property {string} [verdict]  one line, recorded at conclusion
 * @property {string} [reason]   one line, recorded at abandonment
 */

/**
 * The topic's experiment item, writable — a loud error when the topic holds
 * no series or the item is cancelled.
 * @param {object} manifest @param {string} topic
 * @returns {{status?: string, experiments?: Record<string, ExperimentRecord>}}
 */
function experimentItem(manifest, topic) {
  const phases = manifest && manifest.phases;
  const ph = phases && typeof phases === 'object' ? phases.experiment : undefined;
  const items = ph && typeof ph === 'object' ? ph.items : undefined;
  const item = items && typeof items === 'object' ? items[topic] : undefined;
  if (!item || typeof item !== 'object') {
    throw new Error(`no experiment series for "${topic}" — the spawn creates it (experiment create)`);
  }
  if (item.status === 'cancelled') {
    throw new Error(`experiment item "${topic}" is cancelled — its records are closed; a new spawn from the conversation (experiment create --from) revives the series`);
  }
  return item;
}

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

/**
 * A parent's live sub-experiments — the records its own terminal transition
 * must wait for: the parent's verdict synthesises them.
 * @param {{experiments?: Record<string, ExperimentRecord>}} item @param {string} parentId
 * @returns {[string, ExperimentRecord][]}
 */
function liveSubs(item, parentId) {
  return Object.entries(item.experiments || {})
    .filter(([id, r]) => id.startsWith(`${parentId}.`)
      && r && typeof r === 'object' && !EXPERIMENT_TERMINAL_STATUSES.includes(/** @type {string} */ (r.status)));
}

/**
 * The record's on-disk home, project-relative. A sub-experiment's record
 * nests inside its parent's — the split is the laboratory's internal method,
 * so the parent directory holds the whole tree.
 * @param {string} workUnit @param {string} topic @param {string} id
 * @param {Record<string, ExperimentRecord>} experiments
 */
function recordDir(workUnit, topic, id, experiments) {
  const base = `.workflows/${workUnit}/experiment/${topic}`;
  if (isParentExperimentId(id)) return `${base}/${id}-${experiments[id].slug}`;
  const parentId = id.slice(0, id.indexOf('.'));
  return `${base}/${parentId}-${experiments[parentId].slug}/${id}-${experiments[id].slug}`;
}

/**
 * @typedef {object} ExperimentOpResult
 * @property {string} topic
 * @property {string} id
 * @property {string} slug
 * @property {string} status   the record's status after the op
 * @property {string} dir      the record's directory, project-relative
 * @property {string} [item_status]  the item's derived status after a terminal op
 * @property {string} [previous]  the status before the op (advance/approve)
 * @property {string} [verdict]
 * @property {string} [reason]
 * @property {string} [parent]   sub-experiment creation — the running parent
 * @property {{phase: string, ids: string[]}} [awaiting]  the lock the spawn placed
 * @property {import('./transitions.cjs').WaitRelease[]} [released_waits]
 * @property {{phase: string, topic: string}[]} [reconcile_flagged]
 */

/**
 * The spawn — the phase's one door. A top-level create (`from` names the
 * spawning phase) allocates `E{n}` (per-topic numbering — highest existing
 * plus one), records it `conceived`, installs the problem statement
 * (`problem` names a cache scratch file the spawning session wrote; the
 * create moves it in as `{dir}/problem.md`), opens the experiment item
 * (creating it, or setting a completed series back to in-progress — a new
 * spawn reopens the series), and locks the spawning item:
 * `awaiting_experiments` gains the id on the in-progress research or
 * discussion the question came from, identically for both. A split (`parent`
 * names a running experiment) allocates `E{n}.{m}` under it — no lock moves
 * (the wait stays on the parent and releases once, when the parent as a
 * whole ends), and no problem file: the sub-record's design frames its
 * question. The record's directory is the
 * response's `dir`, where the design is authored before anything is
 * measured.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} topic
 * @param {{slug: string, from?: string, parent?: string, problem?: string}} opts
 * @returns {ExperimentOpResult}
 */
function createExperiment(cwd, workUnit, topic, { slug, from, parent, problem }) {
  assertLegalTopicName(topic);
  if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`--slug must be kebab-case, got "${slug ?? ''}"`);
  }
  if ((from === undefined) === (parent === undefined)) {
    throw new Error('exactly one of --from <research|discussion> (a spawn) or --parent <E{n}> (a split) is required');
  }
  if (from !== undefined && !EXPERIMENT_SPAWN_PHASES.includes(from)) {
    throw new Error(`--from must be one of ${EXPERIMENT_SPAWN_PHASES.join('|')} — the phases whose sessions spawn experiments; got "${from}"`);
  }
  if (parent !== undefined) {
    assertLegalId(parent);
    if (!isParentExperimentId(parent)) {
      throw new Error(`--parent must be a top-level experiment id, got "${parent}" — a split never splits again`);
    }
    if (problem !== undefined) {
      throw new Error('--problem is refused with --parent — a split carries no spawn-side problem statement; the sub-record\'s design frames its question');
    }
  }
  /** @type {string|null} */
  let problemBody = null;
  /** @type {string|null} */
  let scratchAbs = null;
  if (from !== undefined) {
    if (problem === undefined) {
      throw new Error('--problem <file> is required on a spawn — no record is conceived without its problem statement');
    }
    // The scratch is consumed after the create — confine it to the cache so
    // a mis-passed path can never read (and delete) a live artifact.
    scratchAbs = path.resolve(cwd, problem);
    const cacheRoot = path.join(cwd, '.workflows', '.cache') + path.sep;
    if (!scratchAbs.startsWith(cacheRoot)) {
      throw new Error(`--problem must point inside .workflows/.cache/ — got "${problem}"`);
    }
    try {
      problemBody = fs.readFileSync(scratchAbs, 'utf8');
    } catch {
      throw new Error(`problem file not found: ${problem}`);
    }
    if (problemBody.trim() === '') throw new Error(`problem file is empty: ${problem}`);
  }
  const result = withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);

    if (parent !== undefined) {
      const item = experimentItem(manifest, topic);
      const record = seriesRecord(item, topic, parent);
      if (record.status !== 'running') {
        throw new Error(`experiment ${parent} ("${topic}") is ${record.status} — only a running experiment discovers its question decomposes; a split waits for the run`);
      }
      const experiments = /** @type {Record<string, ExperimentRecord>} */ (item.experiments);
      const subPattern = new RegExp(`^${parent}\\.([1-9][0-9]*)$`);
      const m = Object.keys(experiments)
        .map((id) => (subPattern.exec(id) || [])[1])
        .filter(Boolean)
        .reduce((max, digits) => Math.max(max, Number(digits)), 0) + 1;
      const id = `${parent}.${m}`;
      experiments[id] = { slug, status: 'conceived' };
      saveWorkUnitManifest(cwd, workUnit, manifest);
      return { topic, id, slug, status: 'conceived', parent, dir: recordDir(workUnit, topic, id, experiments) };
    }

    // The spawn is recorded mid-conversation, from the session that raised
    // the question — the spawning item must be open to hold the lock.
    const phases = manifest && typeof manifest.phases === 'object' ? manifest.phases : {};
    const spawnItems = phases[/** @type {string} */ (from)] && typeof phases[/** @type {string} */ (from)] === 'object'
      ? phases[/** @type {string} */ (from)].items : undefined;
    const spawner = spawnItems && typeof spawnItems === 'object' ? spawnItems[topic] : undefined;
    if (!spawner || typeof spawner !== 'object') {
      throw new Error(`no ${from} item "${topic}" to spawn from — the spawn is recorded mid-conversation, by the session that raised the question`);
    }
    if (spawner.status !== 'in-progress') {
      throw new Error(`${from} "${topic}" is ${spawner.status ?? 'not started'} — only an in-progress ${from} spawns an experiment`);
    }

    const ph = ensureContainer(ensureContainer(manifest, 'phases', 'phases'), 'experiment', 'phases.experiment');
    const items = ensureContainer(ph, 'items', 'phases.experiment.items');
    let item = items[topic];
    if (!item || typeof item !== 'object') {
      item = items[topic] = { status: 'in-progress' };
    } else {
      // A completed series reopens at the next spawn, and a cancelled one
      // revives the same way — post-cancel every record is terminal by
      // construction, so the new record is the only live one. The item is
      // derived bookkeeping, and a live record makes it live again.
      item.status = 'in-progress';
      delete item.previous_status;
    }
    const experiments = ensureContainer(item, 'experiments', `phases.experiment.items.${topic}.experiments`);
    const n = Object.keys(experiments)
      .map((id) => (/^E([1-9][0-9]*)$/.exec(id) || [])[1])
      .filter(Boolean)
      .reduce((max, digits) => Math.max(max, Number(digits)), 0) + 1;
    const id = `E${n}`;
    experiments[id] = { slug, status: 'conceived' };
    const awaiting = Array.isArray(spawner.awaiting_experiments) ? spawner.awaiting_experiments : [];
    spawner.awaiting_experiments = [...awaiting, id];
    const dir = recordDir(workUnit, topic, id, experiments);
    // The problem file lands before the manifest names the record — a crash
    // between the two writes must never leave a conceived record with no
    // problem statement.
    fs.mkdirSync(path.join(cwd, dir), { recursive: true });
    const body = /** @type {string} */ (problemBody);
    fs.writeFileSync(path.join(cwd, dir, 'problem.md'), body.endsWith('\n') ? body : body + '\n');
    saveWorkUnitManifest(cwd, workUnit, manifest);
    return {
      topic, id, slug, status: 'conceived',
      dir,
      awaiting: { phase: /** @type {string} */ (from), ids: spawner.awaiting_experiments },
    };
  });
  if (scratchAbs !== null) {
    try { fs.unlinkSync(scratchAbs); } catch { /* scratch already gone */ }
  }
  return result;
}

/**
 * One shared status write: load, guard, step, save, answer. The transition
 * itself is the caller's closure over the loaded record.
 * @param {string} cwd @param {string} workUnit @param {string} topic @param {string} id
 * @param {(record: ExperimentRecord, item: {experiments?: Record<string, ExperimentRecord>}, manifest: object) => Partial<ExperimentOpResult>} step
 * @returns {ExperimentOpResult}
 */
function recordTransition(cwd, workUnit, topic, id, step) {
  return withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const item = experimentItem(manifest, topic);
    const record = seriesRecord(item, topic, id);
    const extra = step(record, item, manifest);
    saveWorkUnitManifest(cwd, workUnit, manifest);
    return {
      topic, id, slug: record.slug, status: /** @type {string} */ (record.status),
      dir: recordDir(workUnit, topic, id, /** @type {Record<string, ExperimentRecord>} */ (item.experiments)),
      ...extra,
    };
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
 * rule's mechanical outcome, recorded on the register row. A parent whose
 * sub-experiments are still live refuses: its verdict synthesises them. A
 * top-level conclusion releases the spawning item's evidence wait on this id
 * (flagging that conversation for its next entry) and runs the one-hop flag
 * on the topic's completed downstream neighbour — evidence arriving after a
 * decision must surface before the record is trusted; a sub-experiment's
 * conclusion moves neither — the parent's carries them. The item's derived
 * status settles after every terminal transition.
 * @param {string} cwd project root
 * @param {string} workUnit @param {string} topic @param {string} id
 * @param {{verdict: string}} opts
 * @returns {ExperimentOpResult}
 */
function concludeExperiment(cwd, workUnit, topic, id, { verdict }) {
  assertOneLine('--verdict', verdict);
  return recordTransition(cwd, workUnit, topic, id, (record, item, manifest) => {
    assertNotTerminal(record, topic, id);
    if (record.status !== 'running') {
      throw new Error(`experiment ${id} ("${topic}") is ${record.status} — only a running experiment concludes; the design exists before the data, and the data before the verdict`);
    }
    if (isParentExperimentId(id)) {
      const open = liveSubs(item, id).map(([subId, r]) => `${subId}: ${r.status}`);
      if (open.length > 0) {
        throw new Error(`experiment ${id} ("${topic}") has live sub-experiments (${open.join(', ')}) — its verdict synthesises them; conclude or abandon each first`);
      }
    }
    record.status = 'concluded';
    record.verdict = verdict.trim();
    /** @type {Partial<ExperimentOpResult>} */
    const extra = { verdict: record.verdict };
    if (isParentExperimentId(id)) {
      const fd = flagDownstream(manifest, /** @type {{work_type: string}} */ (manifest).work_type, 'experiment', topic);
      if (fd.flagged.length > 0) extra.reconcile_flagged = fd.flagged;
      const released = releaseExperimentWaits(manifest, topic, { ids: [id] });
      if (released.length > 0) extra.released_waits = released;
    }
    extra.item_status = settleItemStatus(item);
    return extra;
  });
}

/**
 * Abandon an experiment from any pre-terminal status, with its one-line
 * reason — a first-class terminal: the register keeps the row. A parent with
 * live sub-experiments refuses — each ends on its own row first. A top-level
 * abandonment releases the spawning item's evidence wait on this id and
 * flags that conversation, whose waiting point reverts to open — no
 * downstream hop: there is no evidence to reconcile a decided record
 * against. The item's derived status settles after every terminal
 * transition.
 * @param {string} cwd project root
 * @param {string} workUnit @param {string} topic @param {string} id
 * @param {{reason: string}} opts
 * @returns {ExperimentOpResult}
 */
function abandonExperiment(cwd, workUnit, topic, id, { reason }) {
  assertOneLine('--reason', reason);
  return recordTransition(cwd, workUnit, topic, id, (record, item, manifest) => {
    assertNotTerminal(record, topic, id);
    if (isParentExperimentId(id)) {
      const open = liveSubs(item, id).map(([subId, r]) => `${subId}: ${r.status}`);
      if (open.length > 0) {
        throw new Error(`experiment ${id} ("${topic}") has live sub-experiments (${open.join(', ')}) — conclude or abandon each before abandoning the parent`);
      }
    }
    record.status = 'abandoned';
    record.reason = reason.trim();
    /** @type {Partial<ExperimentOpResult>} */
    const extra = { reason: record.reason };
    if (isParentExperimentId(id)) {
      const released = releaseExperimentWaits(manifest, topic, { ids: [id] });
      if (released.length > 0) extra.released_waits = released;
    }
    extra.item_status = settleItemStatus(item);
    return extra;
  });
}

module.exports = { createExperiment, advanceExperiment, approveExperiment, concludeExperiment, abandonExperiment };
