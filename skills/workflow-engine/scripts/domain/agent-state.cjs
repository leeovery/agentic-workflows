'use strict';

// ---------------------------------------------------------------------------
// Domain ring: background-agent lifecycle — `engine agent <verb>`.
//
// The one owner of the surfacing state machine that used to live as
// hand-edited cache-file frontmatter (design/analysis-state.md, S1/S2).
// State lives in an engine-owned store at `.workflows/.cache/{wu}/state.json`
// — validated vocabularies, locked atomic writes, gitignored, purged with
// the rest of the cache when the work unit closes. Content stays markdown:
// an agent writes its findings file and nothing else; the file's existence
// IS its completion signal (no skeleton files, no frontmatter).
//
// Lifecycle per row: in-flight → pending → acknowledged → incorporated,
// with `announced` (user told the file exists) and `surfaced[]` (finding
// ids raised so far) tracked on acknowledged rows. `scan` is the one read
// the surfacing protocol and conclusion gates need: it promotes finished
// rows and answers with a decision-ready snapshot.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const io = require('../kernel/manifest-io.cjs');
const { VALID_PHASES } = require('../kernel/manifest-schema.cjs');

const AGENT_KINDS = [
  'review',
  'deep-dive',
  'perspective',
  'synthesis',
  'root-cause-validation',
  'fix-validation',
  'fix-exploration',
];

const AGENT_STATUSES = ['in-flight', 'pending', 'acknowledged', 'incorporated'];

/** @param {string} cwd */
function workflowsDir(cwd) {
  return path.join(cwd, '.workflows');
}

/** @param {string} cwd @param {string} workUnit */
function statePath(cwd, workUnit) {
  return path.join(cwd, '.workflows', '.cache', workUnit, 'state.json');
}

/** @param {string} cwd @param {string} workUnit @param {string} phase @param {string} topic */
function agentDir(cwd, workUnit, phase, topic) {
  return path.join(cwd, '.workflows', '.cache', workUnit, phase, topic);
}

/** @param {string} cwd @param {string} workUnit */
function requireWorkUnit(cwd, workUnit) {
  if (!fs.existsSync(io.workUnitManifestPath(workflowsDir(cwd), workUnit))) {
    throw new Error(`Work unit "${workUnit}" not found`);
  }
}

/** @param {string} phase */
function validatePhase(phase) {
  if (!VALID_PHASES.includes(phase)) {
    throw new Error(`Invalid phase "${phase}". Must be one of: ${VALID_PHASES.join(', ')}`);
  }
}

/** @param {string} kind */
function validateKind(kind) {
  if (!AGENT_KINDS.includes(kind)) {
    throw new Error(`Invalid agent kind "${kind}". Must be one of: ${AGENT_KINDS.join(', ')}`);
  }
}

/** @param {string} cwd @param {string} workUnit @returns {{agents: Record<string, any>}} */
function loadState(cwd, workUnit) {
  const file = statePath(cwd, workUnit);
  if (!fs.existsSync(file)) return { agents: {} };
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`Corrupt agent state at ${file}: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Corrupt agent state at ${file}: root must be an object`);
  }
  if (!parsed.agents || typeof parsed.agents !== 'object') parsed.agents = {};
  return parsed;
}

/** @param {string} cwd @param {string} workUnit @param {object} state */
function saveState(cwd, workUnit, state) {
  const file = statePath(cwd, workUnit);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  io.writeJsonAtomic(file, state);
}

/** @param {string} phase @param {string} topic @param {string} id */
function rowKey(phase, topic, id) {
  return `${phase}/${topic}/${id}`;
}

/**
 * The row addressed by phase/topic/id, or a loud miss naming what exists.
 * @param {{agents: Record<string, any>}} state
 * @param {string} phase @param {string} topic @param {string} id
 */
function requireRow(state, phase, topic, id) {
  const row = state.agents[rowKey(phase, topic, id)];
  if (!row) {
    const siblings = Object.keys(state.agents)
      .filter((k) => k.startsWith(`${phase}/${topic}/`))
      .map((k) => k.split('/')[2]);
    const hint = siblings.length ? ` Known agents there: ${siblings.join(', ')}.` : ' No agents dispatched there.';
    throw new Error(`No agent "${id}" for ${phase}/${topic}.${hint}`);
  }
  return row;
}

/**
 * Dispatch: allocate the next id for this kind, record the row in-flight,
 * and answer with the content-file path the sub-agent must write. No file
 * is created — the content file's later existence is the completion signal.
 * Numbering starts after both existing rows AND any legacy files already in
 * the cache dir (pre-programme skeletons keep their names; ids never collide).
 * @param {string} cwd @param {string} workUnit @param {string} phase
 * @param {string} topic @param {{kind: string, label?: string}} opts
 */
function dispatchAgent(cwd, workUnit, phase, topic, { kind, label }) {
  requireWorkUnit(cwd, workUnit);
  validatePhase(phase);
  validateKind(kind);
  if (label !== undefined && (typeof label !== 'string' || label === '' || /[\/.]/.test(label))) {
    throw new Error(`Invalid label ${JSON.stringify(label)}: a short slash- and dot-free slug`);
  }
  return io.withWorkUnitLock(workflowsDir(cwd), workUnit, () => {
    const state = loadState(cwd, workUnit);
    const dir = agentDir(cwd, workUnit, phase, topic);

    let max = 0;
    for (const key of Object.keys(state.agents)) {
      const row = state.agents[key];
      if (key.startsWith(`${phase}/${topic}/`) && row.kind === kind) {
        const m = /-(\d{3})(?:-|$)/.exec(row.id);
        if (m) max = Math.max(max, Number(m[1]));
      }
    }
    if (fs.existsSync(dir)) {
      for (const name of fs.readdirSync(dir)) {
        const m = new RegExp(`^${kind}-(\\d{3})(?:-|\\.)`).exec(name);
        if (m) max = Math.max(max, Number(m[1]));
      }
    }

    const nnn = String(max + 1).padStart(3, '0');
    const id = label ? `${kind}-${nnn}-${label}` : `${kind}-${nnn}`;
    const file = path.join(dir, `${id}.md`);

    state.agents[rowKey(phase, topic, id)] = {
      id,
      kind,
      phase,
      topic,
      ...(label ? { label } : {}),
      status: 'in-flight',
      announced: false,
      findings: [],
      surfaced: [],
      created: new Date().toISOString(),
    };
    fs.mkdirSync(dir, { recursive: true });
    saveState(cwd, workUnit, state);
    return { work_unit: workUnit, phase, topic, id, kind, file: path.relative(cwd, file) };
  });
}

/** @param {any} row @param {string} cwd */
function contentFileExists(row, cwd, workUnit) {
  const file = path.join(agentDir(cwd, workUnit, row.phase, row.topic), `${row.id}.md`);
  try {
    return fs.statSync(file).size > 0;
  } catch {
    return false;
  }
}

/** @param {any} row */
function unsurfaced(row) {
  return row.findings.filter((/** @type {string} */ f) => !row.surfaced.includes(f));
}

/** @param {any} row */
function publicRow(row) {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    announced: row.announced,
    findings: row.findings,
    surfaced: row.surfaced,
    remaining: unsurfaced(row),
    ...(row.label ? { label: row.label } : {}),
  };
}

/**
 * Scan: promote every in-flight row whose content file now exists, then
 * answer with the snapshot the surfacing protocol reads — counts per state,
 * the rows themselves, and `next`: the one thing to do now (surface the next
 * finding of a partially-surfaced row, else acknowledge the oldest pending
 * row), or null when there is nothing actionable.
 * @param {string} cwd @param {string} workUnit @param {string} phase @param {string} topic
 */
function scanAgents(cwd, workUnit, phase, topic) {
  requireWorkUnit(cwd, workUnit);
  validatePhase(phase);
  return io.withWorkUnitLock(workflowsDir(cwd), workUnit, () => {
    const state = loadState(cwd, workUnit);
    const rows = Object.entries(state.agents)
      .filter(([k]) => k.startsWith(`${phase}/${topic}/`))
      .map(([, r]) => r)
      .sort((a, b) => a.created.localeCompare(b.created) || a.id.localeCompare(b.id));

    let promoted = false;
    for (const row of rows) {
      if (row.status === 'in-flight' && contentFileExists(row, cwd, workUnit)) {
        row.status = 'pending';
        promoted = true;
      }
    }
    if (promoted) saveState(cwd, workUnit, state);

    const byStatus = (/** @type {string} */ s) => rows.filter((r) => r.status === s);
    const acked = byStatus('acknowledged');
    const surfacing = acked.find((r) => unsurfaced(r).length > 0);
    const pending = byStatus('pending');

    /** @type {null | {action: string, id: string, finding?: string}} */
    let next = null;
    if (surfacing) next = { action: 'surface', id: surfacing.id, finding: unsurfaced(surfacing)[0] };
    else if (pending.length) next = { action: 'acknowledge', id: pending[0].id };

    return {
      work_unit: workUnit,
      phase,
      topic,
      in_flight: byStatus('in-flight').map((r) => r.id),
      pending: pending.map(publicRow),
      acknowledged: acked.map(publicRow),
      incorporated: byStatus('incorporated').map((r) => r.id),
      next,
    };
  });
}

/**
 * Acknowledge a pending row: record the finding ids read from the content
 * file. An empty list is legal — a clean report incorporates immediately.
 * @param {string} cwd @param {string} workUnit @param {string} phase
 * @param {string} topic @param {string} id @param {{findings: string[]}} opts
 */
function ackAgent(cwd, workUnit, phase, topic, id, { findings }) {
  requireWorkUnit(cwd, workUnit);
  validatePhase(phase);
  if (!Array.isArray(findings) || findings.some((f) => typeof f !== 'string' || f === '')) {
    throw new Error('Invalid findings: a list of non-empty finding ids (may be empty for a clean report)');
  }
  if (new Set(findings).size !== findings.length) {
    throw new Error('Invalid findings: duplicate ids');
  }
  return io.withWorkUnitLock(workflowsDir(cwd), workUnit, () => {
    const state = loadState(cwd, workUnit);
    const row = requireRow(state, phase, topic, id);
    if (row.status !== 'pending') {
      throw new Error(`Agent "${id}" is ${row.status} — only a pending row acknowledges (run \`agent scan\` to promote a finished agent)`);
    }
    row.findings = findings;
    row.status = findings.length === 0 ? 'incorporated' : 'acknowledged';
    saveState(cwd, workUnit, state);
    return { work_unit: workUnit, phase, topic, ...publicRow(row) };
  });
}

/**
 * Mark the row announced — the user has been told the report exists.
 * @param {string} cwd @param {string} workUnit @param {string} phase
 * @param {string} topic @param {string} id
 */
function announceAgent(cwd, workUnit, phase, topic, id) {
  requireWorkUnit(cwd, workUnit);
  validatePhase(phase);
  return io.withWorkUnitLock(workflowsDir(cwd), workUnit, () => {
    const state = loadState(cwd, workUnit);
    const row = requireRow(state, phase, topic, id);
    if (row.status !== 'acknowledged') {
      throw new Error(`Agent "${id}" is ${row.status} — only an acknowledged row announces`);
    }
    row.announced = true;
    saveState(cwd, workUnit, state);
    return { work_unit: workUnit, phase, topic, ...publicRow(row) };
  });
}

/**
 * Surface one finding. When the last unsurfaced finding is raised the row
 * incorporates automatically — the response's `status` says so.
 * @param {string} cwd @param {string} workUnit @param {string} phase
 * @param {string} topic @param {string} id @param {string} finding
 */
function surfaceFinding(cwd, workUnit, phase, topic, id, finding) {
  requireWorkUnit(cwd, workUnit);
  validatePhase(phase);
  return io.withWorkUnitLock(workflowsDir(cwd), workUnit, () => {
    const state = loadState(cwd, workUnit);
    const row = requireRow(state, phase, topic, id);
    if (row.status !== 'acknowledged') {
      throw new Error(`Agent "${id}" is ${row.status} — only an acknowledged row surfaces findings`);
    }
    if (!row.findings.includes(finding)) {
      throw new Error(`Agent "${id}" has no finding "${finding}". Findings: ${row.findings.join(', ')}`);
    }
    if (row.surfaced.includes(finding)) {
      throw new Error(`Finding "${finding}" is already surfaced on "${id}"`);
    }
    row.surfaced.push(finding);
    if (unsurfaced(row).length === 0) row.status = 'incorporated';
    saveState(cwd, workUnit, state);
    return { work_unit: workUnit, phase, topic, ...publicRow(row) };
  });
}

/**
 * Incorporate an acknowledged row wholesale — the user declined the
 * remaining findings (skip-all). Remaining ids stay unsurfaced on the row,
 * a true record of what was offered but never raised.
 * @param {string} cwd @param {string} workUnit @param {string} phase
 * @param {string} topic @param {string} id
 */
function incorporateAgent(cwd, workUnit, phase, topic, id) {
  requireWorkUnit(cwd, workUnit);
  validatePhase(phase);
  return io.withWorkUnitLock(workflowsDir(cwd), workUnit, () => {
    const state = loadState(cwd, workUnit);
    const row = requireRow(state, phase, topic, id);
    if (row.status !== 'acknowledged') {
      throw new Error(`Agent "${id}" is ${row.status} — only an acknowledged row incorporates`);
    }
    row.status = 'incorporated';
    saveState(cwd, workUnit, state);
    return { work_unit: workUnit, phase, topic, ...publicRow(row) };
  });
}

module.exports = {
  AGENT_KINDS,
  AGENT_STATUSES,
  dispatchAgent,
  scanAgents,
  ackAgent,
  announceAgent,
  surfaceFinding,
  incorporateAgent,
};
