'use strict';

// ---------------------------------------------------------------------------
// Domain ring: implementation-task bookkeeping — format-blind, manifest-side
// only. The engine never reads or writes a task backend and knows nothing
// about plan formats; the session does the plan surgery, these transitions
// record its progress. Load → apply → save, one decision-ready result per
// call, each under the work unit's manifest lock (the same lock the manifest
// CLI honours). No git commits — the session's commit cadence picks the
// changes up. Validation throws loud and specific before anything is touched.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { loadWorkUnitManifest, saveWorkUnitManifest, withWorkUnitLock } = require('../kernel/manifest.cjs');

const FIX_THRESHOLD = 3;
const SESSION_CYCLE_LIMIT = 3;

/**
 * @typedef {object} GateModes
 * @property {string} task_gate_mode
 * @property {string} fix_gate_mode
 * @property {string} analysis_gate_mode
 */

/**
 * @typedef {object} InitResult
 * @property {'created'|'resumed'} mode
 * @property {GateModes} gates
 * @property {{fix_attempts: number, analysis_cycle_total: number, analysis_cycle_session: number}} counters
 */

/**
 * @typedef {object} StartResult
 * @property {string} task  the internal id
 * @property {{task_gate_mode: string, fix_gate_mode: string}} gates
 */

/**
 * @typedef {object} FixAttemptResult
 * @property {number} attempts
 * @property {boolean} threshold_reached
 * @property {string} fix_gate_mode
 */

/**
 * @typedef {object} CompleteResult
 * @property {string} internal_id
 * @property {Record<string, unknown>} recorded  exactly what was written
 */

/**
 * @typedef {object} AnalysisCycleResult
 * @property {number} cycle_total
 * @property {number} cycle_session
 * @property {boolean} over_session_limit
 * @property {string} analysis_gate_mode
 */

/**
 * The implementation item for `topic`, or a loud error.
 * @param {object} manifest @param {string} topic
 * @returns {Record<string, any>}
 */
function implementationItem(manifest, topic) {
  const phases = manifest && manifest.phases;
  const ph = phases && typeof phases === 'object' ? phases.implementation : undefined;
  const items = ph && typeof ph === 'object' ? ph.items : undefined;
  const item = items && typeof items === 'object' ? items[topic] : undefined;
  if (!item || typeof item !== 'object') {
    throw new Error(`no implementation item "${topic}" in the manifest (phases.implementation.items)`);
  }
  return item;
}

/**
 * Guard a name that lands in a filesystem path.
 * @param {string} value @param {string} label
 */
function safeName(value, label) {
  if (!value || typeof value !== 'string' || value.includes('/') || value.includes('..')) {
    throw new Error(`invalid ${label} "${value}"`);
  }
}

/** @param {string} cwd @param {string} workUnit @param {string} topic @param {string} internalId */
function fixTrackingPath(cwd, workUnit, topic, internalId) {
  return path.join(cwd, '.workflows', '.cache', workUnit, 'implementation', topic, `fix-tracking-${internalId}.md`);
}

/**
 * The item's gate mode, defaulting to `gated` when unset.
 * @param {Record<string, any>} item @param {string} field
 * @returns {string}
 */
function gateOf(item, field) {
  return typeof item[field] === 'string' ? item[field] : 'gated';
}

/** @param {Record<string, any>} item @param {string} field @returns {number} */
function counterOf(item, field) {
  return typeof item[field] === 'number' ? item[field] : 0;
}

/**
 * Create-or-resume the implementation item. Absent → init-phase semantics
 * (`{status: 'in-progress'}`) plus session defaults. Present → session reset
 * only: the three gate modes back to `gated`, `fix_attempts` and
 * `analysis_cycle_session` to 0 — `analysis_cycle_total`, `linters`,
 * `project_skills`, `current_phase`, `current_task`, `completed_tasks`, and
 * `completed_phases` are never touched.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} topic
 * @returns {InitResult}
 */
function initTasks(cwd, workUnit, topic) {
  return withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    if (!manifest.phases || typeof manifest.phases !== 'object') manifest.phases = {};
    const phases = manifest.phases;
    if (!phases.implementation || typeof phases.implementation !== 'object') phases.implementation = {};
    if (!phases.implementation.items || typeof phases.implementation.items !== 'object') phases.implementation.items = {};
    const items = phases.implementation.items;

    /** @type {'created'|'resumed'} */
    let mode;
    if (items[topic] && typeof items[topic] === 'object') {
      mode = 'resumed';
      const item = items[topic];
      item.task_gate_mode = 'gated';
      item.fix_gate_mode = 'gated';
      item.analysis_gate_mode = 'gated';
      item.fix_attempts = 0;
      item.analysis_cycle_session = 0;
    } else {
      mode = 'created';
      items[topic] = {
        status: 'in-progress',
        task_gate_mode: 'gated',
        fix_gate_mode: 'gated',
        analysis_gate_mode: 'gated',
        fix_attempts: 0,
        analysis_cycle_total: 0,
        analysis_cycle_session: 0,
        linters: [],
        project_skills: [],
        current_phase: 1,
        current_task: null,
      };
    }
    saveWorkUnitManifest(cwd, workUnit, manifest);

    const item = items[topic];
    return {
      mode,
      gates: {
        task_gate_mode: gateOf(item, 'task_gate_mode'),
        fix_gate_mode: gateOf(item, 'fix_gate_mode'),
        analysis_gate_mode: gateOf(item, 'analysis_gate_mode'),
      },
      counters: {
        fix_attempts: counterOf(item, 'fix_attempts'),
        analysis_cycle_total: counterOf(item, 'analysis_cycle_total'),
        analysis_cycle_session: counterOf(item, 'analysis_cycle_session'),
      },
    };
  });
}

/**
 * Start a task: reset `fix_attempts`, drop the task's fix-tracking cache file
 * (clean slate per task), report the gate modes the task loop branches on.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} topic
 * @param {string} internalId
 * @returns {StartResult}
 */
function startTask(cwd, workUnit, topic, internalId) {
  safeName(internalId, 'internal id');
  const item = withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const found = implementationItem(manifest, topic);
    found.fix_attempts = 0;
    saveWorkUnitManifest(cwd, workUnit, manifest);
    return found;
  });

  const file = fixTrackingPath(cwd, workUnit, topic, internalId);
  if (fs.existsSync(file)) fs.unlinkSync(file);

  return {
    task: internalId,
    gates: { task_gate_mode: gateOf(item, 'task_gate_mode'), fix_gate_mode: gateOf(item, 'fix_gate_mode') },
  };
}

/**
 * Record a fix attempt: increment `fix_attempts` and append the findings
 * file's content verbatim to the task's fix-tracking cache file under a
 * `## Attempt {N}` section (file and parent dirs created as needed).
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} topic
 * @param {string} internalId
 * @param {string} findingsFile  path to the findings written by the session
 * @returns {FixAttemptResult}
 */
function fixAttempt(cwd, workUnit, topic, internalId, findingsFile) {
  safeName(internalId, 'internal id');
  const { item, attempts, findings } = withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const found = implementationItem(manifest, topic);
    let content;
    try {
      content = fs.readFileSync(path.resolve(cwd, findingsFile), 'utf8');
    } catch {
      throw new Error(`findings file not found: ${findingsFile}`);
    }

    const n = counterOf(found, 'fix_attempts') + 1;
    found.fix_attempts = n;
    saveWorkUnitManifest(cwd, workUnit, manifest);
    return { item: found, attempts: n, findings: content };
  });

  const file = fixTrackingPath(cwd, workUnit, topic, internalId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const lead = existing === '' ? '' : existing.endsWith('\n') ? '\n' : '\n\n';
  const body = findings.endsWith('\n') ? findings : findings + '\n';
  fs.writeFileSync(file, `${existing}${lead}## Attempt ${attempts}\n\n${body}`);

  return { attempts, threshold_reached: attempts >= FIX_THRESHOLD, fix_gate_mode: gateOf(item, 'fix_gate_mode') };
}

/**
 * Mirror of manifest.cjs `key-of` over `phases.planning.items.{topic}.task_map`:
 * the internal id whose mapped external id matches, or a loud error.
 * @param {object} manifest @param {string} workUnit @param {string} topic @param {string} externalId
 * @returns {string}
 */
function resolveInternalId(manifest, workUnit, topic, externalId) {
  const phases = manifest && manifest.phases;
  const planning = phases && typeof phases === 'object' ? phases.planning : undefined;
  const items = planning && typeof planning === 'object' ? planning.items : undefined;
  const planItem = items && typeof items === 'object' ? items[topic] : undefined;
  const taskMap = planItem && typeof planItem === 'object' ? planItem.task_map : undefined;
  if (taskMap == null || typeof taskMap !== 'object') {
    throw new Error(`Path "phases.planning.items.${topic}.task_map" is not an object in "${workUnit}"`);
  }
  const key = Object.keys(taskMap).find((k) => String(taskMap[k]) === externalId);
  if (key === undefined) {
    throw new Error(`Value "${externalId}" not found in "phases.planning.items.${topic}.task_map"`);
  }
  return key;
}

/**
 * The phase number embedded in an internal id (`{topic}-{phase_id}-{task_id}`).
 * @param {string} internalId
 * @returns {number}
 */
function phaseOfInternalId(internalId) {
  const m = /-(\d+)-\d+$/.exec(internalId);
  if (!m) throw new Error(`cannot derive the phase from "${internalId}" — pass --phase <N>`);
  return parseInt(m[1], 10);
}

/**
 * Push onto an array field, creating it when absent — loud when the field
 * exists but is not an array.
 * @param {Record<string, any>} item @param {string} field @param {unknown} value
 */
function pushTo(item, field, value) {
  if (item[field] === undefined) item[field] = [];
  if (!Array.isArray(item[field])) throw new Error(`"${field}" is not an array`);
  item[field].push(value);
}

/**
 * Record a completed (or skipped) task: push its internal id to
 * `completed_tasks`, optionally set `current_phase` / `current_task`, and
 * push the phase to `completed_phases` when the caller reports the phase
 * complete. Skipped tasks are recorded in `completed_tasks` too — the plan
 * (the session's side) carries the skip distinction.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} topic
 * @param {object} opts
 * @param {string|null} [opts.internalId]     the internal id, or null when resolving via externalId
 * @param {string|null} [opts.externalId]     external id to resolve through the planning task_map
 * @param {boolean} [opts.skipped]            the task was skipped, not implemented
 * @param {string|null} [opts.nextTask]       new `current_task` (null clears it); undefined leaves it untouched
 * @param {number} [opts.phase]               new `current_phase`
 * @param {boolean} [opts.phaseComplete]      push the phase to `completed_phases`
 * @returns {CompleteResult}
 */
function completeTask(cwd, workUnit, topic, { internalId = null, externalId = null, skipped = false, nextTask = undefined, phase = undefined, phaseComplete = false } = {}) {
  if ((internalId === null) === (externalId === null)) {
    throw new Error('provide exactly one of <internal-id> or --external <external-id>');
  }
  return withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const item = implementationItem(manifest, topic);
    const id = externalId !== null ? resolveInternalId(manifest, workUnit, topic, externalId) : /** @type {string} */ (internalId);
    safeName(id, 'internal id');

    /** @type {Record<string, unknown>} */
    const recorded = { completed_task: id };
    if (skipped) recorded.skipped = true;
    pushTo(item, 'completed_tasks', id);
    if (phase !== undefined) {
      item.current_phase = phase;
      recorded.current_phase = phase;
    }
    if (nextTask !== undefined) {
      item.current_task = nextTask;
      recorded.current_task = nextTask;
    }
    if (phaseComplete) {
      const n = phase !== undefined ? phase : phaseOfInternalId(id);
      pushTo(item, 'completed_phases', n);
      recorded.completed_phase = n;
    }
    saveWorkUnitManifest(cwd, workUnit, manifest);

    return { internal_id: id, recorded };
  });
}

/**
 * Record an analysis cycle: increment both `analysis_cycle_total` (lifetime)
 * and `analysis_cycle_session` (this session).
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} topic
 * @returns {AnalysisCycleResult}
 */
function analysisCycle(cwd, workUnit, topic) {
  return withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const item = implementationItem(manifest, topic);
    const total = counterOf(item, 'analysis_cycle_total') + 1;
    const session = counterOf(item, 'analysis_cycle_session') + 1;
    item.analysis_cycle_total = total;
    item.analysis_cycle_session = session;
    saveWorkUnitManifest(cwd, workUnit, manifest);

    return {
      cycle_total: total,
      cycle_session: session,
      over_session_limit: session > SESSION_CYCLE_LIMIT,
      analysis_gate_mode: gateOf(item, 'analysis_gate_mode'),
    };
  });
}

module.exports = { initTasks, startTask, fixAttempt, completeTask, analysisCycle };
