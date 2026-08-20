'use strict';

// ---------------------------------------------------------------------------
// Domain ring: background-agent lifecycle — `engine agent <verb>`.
//
// The one owner of the surfacing state machine that used to live as
// hand-edited cache-file frontmatter (design/analysis-state.md, S1/S2).
// State lives in an engine-owned store colocated with the topic's content
// files — `.workflows/.cache/{wu}/{phase}/{topic}/state.json` — validated
// vocabularies, locked atomic writes, gitignored. Deleting a topic's cache
// directory (restart) or the work unit's cache (close) removes state and
// content together: a cleanse is structural, never a second call. Content stays markdown:
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
const { loadWorkUnitManifest } = require('../kernel/manifest.cjs');
const { subtopicStatuses } = require('./discussion-map.cjs');

const AGENT_KINDS = [
  'review',
  'deep-dive',
  'perspective',
  'synthesis',
  'root-cause-validation',
  'fix-validation',
];

const AGENT_STATUSES = ['in-flight', 'pending', 'acknowledged', 'incorporated'];

// Review-arming backoff: review n+1 needs min(n, MOVEMENT_CAP) map moves
// since the last dispatch. The cap keeps late reviews permanently reachable
// on genuinely new ground instead of climbing toward a de-facto ceiling.
const MOVEMENT_CAP = 3;

// Forward rank for map movement — a transition counts only when it climbs.
// `deferred` ranks 0: the conclusion's deferral sweep is bookkeeping, never
// movement (its commit carries the `(deferral)` marker for the same reason),
// while reactivating a deferred thread onto live ground is new ground and
// counts.
const SUBTOPIC_RANK = { pending: 0, exploring: 1, converging: 2, decided: 3, deferred: 0 };

/** @param {string} cwd */
function workflowsDir(cwd) {
  return path.join(cwd, '.workflows');
}

/** @param {string} cwd @param {string} workUnit @param {string} phase @param {string} topic */
function statePath(cwd, workUnit, phase, topic) {
  return path.join(cwd, '.workflows', '.cache', workUnit, phase, topic, 'state.json');
}

/** @param {string} cwd @param {string} workUnit @param {string} phase @param {string} topic */
function agentDir(cwd, workUnit, phase, topic) {
  return path.join(cwd, '.workflows', '.cache', workUnit, phase, topic);
}

/** @param {string} cwd @param {string} workUnit */
function requireWorkUnit(cwd, workUnit) {
  validateSegment(workUnit, 'work unit');
  if (!fs.existsSync(io.workUnitManifestPath(workflowsDir(cwd), workUnit))) {
    throw new Error(`Work unit "${workUnit}" not found`);
  }
}

// Work-unit and topic names become path segments and store keys — refuse
// anything that could traverse or alias (the colocation promise depends on it).
/** @param {string} name @param {string} what */
function validateSegment(name, what) {
  if (typeof name !== 'string' || name === '' || name === '.' || name === '..' || /[\/\\]/.test(name)) {
    throw new Error(`Invalid ${what} ${JSON.stringify(name)}: a slash-free name`);
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

/** @param {string} cwd @param {string} workUnit @param {string} phase @param {string} topic @returns {{agents: Record<string, any>}} */
function loadState(cwd, workUnit, phase, topic) {
  const file = statePath(cwd, workUnit, phase, topic);
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
  for (const [id, row] of Object.entries(parsed.agents)) {
    if (!row || typeof row !== 'object' || Array.isArray(row) || !AGENT_STATUSES.includes(row.status)
      || ('findings' in row && !Array.isArray(row.findings)) || ('surfaced' in row && !Array.isArray(row.surfaced))) {
      throw new Error(`Corrupt agent state at ${file}: row "${id}" is not a valid agent row`);
    }
  }
  return parsed;
}

/** @param {string} cwd @param {string} workUnit @param {string} phase @param {string} topic @param {object} state */
function saveState(cwd, workUnit, phase, topic, state) {
  const file = statePath(cwd, workUnit, phase, topic);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  io.writeJsonAtomic(file, state);
}

/**
 * The row addressed by id, or a loud miss naming what exists.
 * @param {{agents: Record<string, any>}} state
 * @param {string} phase @param {string} topic @param {string} id
 */
function requireRow(state, phase, topic, id) {
  const row = state.agents[id];
  if (!row) {
    const siblings = Object.keys(state.agents);
    const hint = siblings.length ? ` Known agents there: ${siblings.join(', ')}.` : ' No agents dispatched there.';
    throw new Error(`No agent "${id}" for ${phase}/${topic}.${hint}`);
  }
  return row;
}

/**
 * Tolerant row read for derivations — a corrupt store or malformed row must
 * never brick a display. Mutations go through `loadState`, which is loud.
 * @param {string} dir @returns {any[]}
 */
function derivationRows(dir) {
  try {
    const store = JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8'));
    const rows = store && typeof store === 'object' ? store.agents : null;
    return rows && typeof rows === 'object'
      ? Object.values(rows).filter((r) => r && typeof r === 'object' && typeof r.id === 'string')
      : [];
  } catch {
    return [];
  }
}

/**
 * A row that delivered — findings recorded, or its report on disk. An
 * abandoned row closed by the dead-session arm never produced one.
 * @param {any} row @param {string} dir
 */
function reportBacked(row, dir) {
  if (Array.isArray(row.findings) && row.findings.length > 0) return true;
  try {
    return fs.statSync(path.join(dir, `${row.id}.md`)).size > 0;
  } catch {
    return false;
  }
}

/**
 * Completed review cycles for a topic. The agent store is authoritative:
 * review rows past `in-flight` are cycles that happened, counted only when
 * a real report backs them; a finished-but-unscanned row counts — the
 * report landed, no scan has promoted it yet. Legacy review-*.md files with
 * no store row (pre-programme caches) count by existence alone. Tolerant
 * throughout — a derivation read must never brick a display.
 * @param {string} cwd @param {string} workUnit @param {string} phase @param {string} topic
 */
function completedReviewCycles(cwd, workUnit, phase, topic) {
  const dir = agentDir(cwd, workUnit, phase, topic);
  const rowIds = new Set();
  let fromRows = 0;
  for (const row of derivationRows(dir)) {
    if (row.kind !== 'review') continue;
    rowIds.add(`${row.id}.md`);
    if (row.status !== 'in-flight') {
      if (reportBacked(row, dir)) fromRows += 1;
    } else {
      try {
        if (fs.statSync(path.join(dir, `${row.id}.md`)).size > 0) fromRows += 1;
      } catch { /* still running */ }
    }
  }
  try {
    const legacy = fs.readdirSync(dir)
      .filter((f) => /^review-.*\.md$/.test(f))
      .filter((f) => !rowIds.has(f))
      .length;
    return fromRows + legacy;
  } catch {
    return fromRows;
  }
}

/**
 * Map movement between two subtopic→status snapshots: additions plus
 * forward transitions. Backward moves never count — a reopen re-arms
 * machinery elsewhere, and unwinding a decision is not new ground to review.
 * @param {Record<string, string>} before @param {Record<string, string>} after
 */
function mapMovement(before, after) {
  let n = 0;
  for (const [name, status] of Object.entries(after)) {
    if (!(name in before)) n += 1;
    else if ((SUBTOPIC_RANK[status] ?? 0) > (SUBTOPIC_RANK[before[name]] ?? 0)) n += 1;
  }
  return n;
}

/**
 * @typedef {object} ReviewArming
 * @property {boolean} armed
 * @property {number} cycles              completed (report-backed) review cycles
 * @property {number|null} map_moves_seen forward map movement since the anchor; null when nothing anchors the measure
 * @property {number} map_moves_needed    min(cycles, MOVEMENT_CAP)
 * @property {string} reason              one line, always present
 */

/**
 * The review-arming verdict for a discussion topic — is a background review
 * worth dispatching, measured by how far the Discussion Map has moved since
 * the last real review. The first review is free; review n+1 needs min(n,
 * MOVEMENT_CAP) moves since the anchor: the latest report-backed review row
 * carrying its dispatch-time snapshot. A row with no report is a killed
 * dispatch closed as bookkeeping, never a review — anchoring on it would
 * hide every map move between the real review and the kill. Rows with no
 * snapshot (dispatched before arming existed) arm permissively — the next
 * dispatch stamps one and the damping engages. Discussion only: research
 * has no map to measure against. Tolerant reads throughout — the verdict
 * rides displays and must never brick one.
 * @param {string} cwd @param {string} workUnit @param {string} topic
 * @returns {ReviewArming}
 */
function reviewArming(cwd, workUnit, topic) {
  requireWorkUnit(cwd, workUnit);
  validateSegment(topic, 'topic');
  const dir = agentDir(cwd, workUnit, 'discussion', topic);
  const cycles = completedReviewCycles(cwd, workUnit, 'discussion', topic);
  const needed = Math.min(cycles, MOVEMENT_CAP);
  if (needed === 0) {
    return { armed: true, cycles, map_moves_seen: null, map_moves_needed: 0, reason: 'no completed review cycle — the first review is free' };
  }
  const last = derivationRows(dir)
    .filter((r) => r.kind === 'review' && r.map_snapshot && typeof r.map_snapshot === 'object' && reportBacked(r, dir))
    .sort((a, b) => String(a.created).localeCompare(String(b.created)) || a.id.localeCompare(b.id))
    .pop();
  if (!last) {
    return { armed: true, cycles, map_moves_seen: null, map_moves_needed: needed, reason: 'no snapshot on record — armed; this dispatch stamps one' };
  }
  const current = subtopicStatuses(loadWorkUnitManifest(cwd, workUnit), topic);
  const moves = mapMovement(last.map_snapshot, current);
  return {
    armed: moves >= needed,
    cycles,
    map_moves_seen: moves,
    map_moves_needed: needed,
    reason: moves >= needed
      ? `armed on ${moves} map move(s) since ${last.id}`
      : `quiet — ${moves} of ${needed} map moves since ${last.id}`,
  };
}

/**
 * Dispatch: allocate the next id for this kind, record the row in-flight,
 * and answer with the content-file path the sub-agent must write. No file
 * is created — the content file's later existence is the completion signal.
 * A review dispatch refuses while the topic's triage queue holds entries —
 * a queued rerouted concern is a pending change to the document the review
 * would read, so the report would be stale on arrival. A discussion review
 * additionally refuses while unarmed (`reviewArming`) — `final: true`, the
 * mandatory closing pass, bypasses the movement gate; every discussion
 * review row is stamped with the map snapshot arming measures against.
 * Numbering starts after both existing rows AND any legacy files already in
 * the cache dir (pre-programme skeletons keep their names; ids never collide).
 * @param {string} cwd @param {string} workUnit @param {string} phase
 * @param {string} topic @param {{kind: string, labels?: string[], set?: string, final?: boolean}} opts
 */
function dispatchAgent(cwd, workUnit, phase, topic, { kind, labels = [], set, final = false }) {
  requireWorkUnit(cwd, workUnit);
  validatePhase(phase);
  validateSegment(topic, 'topic');
  validateKind(kind);
  for (const label of labels) {
    if (typeof label !== 'string' || label === '' || /[\/.]/.test(label)) {
      throw new Error(`Invalid label ${JSON.stringify(label)}: a short slash- and dot-free slug`);
    }
  }
  if (new Set(labels).size !== labels.length) {
    throw new Error('Invalid labels: duplicates in one dispatch');
  }
  if (set !== undefined && kind !== 'synthesis') {
    throw new Error('--set names the perspective set a synthesis consumes — legal only with --kind synthesis');
  }
  if (kind === 'synthesis' && set === undefined) {
    throw new Error('a synthesis always joins a perspective set — dispatch with --set <NNN>');
  }
  if (kind === 'synthesis' && labels.length) {
    throw new Error('a synthesis takes no --label — its identity is synthesis-{set}');
  }
  if (final && !(kind === 'review' && phase === 'discussion')) {
    throw new Error('--final bypasses a discussion review\'s movement gate — legal only with --kind review in the discussion phase');
  }
  return io.withWorkUnitLock(workflowsDir(cwd), workUnit, () => {
    if (kind === 'review' && (phase === 'research' || phase === 'discussion')) {
      const queueDir = path.join(cwd, '.workflows', workUnit, phase, '.triage', topic);
      let queued = 0;
      try {
        queued = fs.readdirSync(queueDir, { withFileTypes: true })
          .filter((e) => e.isFile() && e.name.endsWith('.md')).length;
      } catch { /* no queue — clear */ }
      if (queued > 0) {
        throw new Error(`review dispatch blocked: ${queued} rerouted concern(s) wait in the ${phase}/${topic} triage queue — absorb them (topic absorb) before dispatching a review`);
      }
    }
    /** @type {Record<string, string> | null} */
    let mapSnapshot = null;
    if (kind === 'review' && phase === 'discussion') {
      if (!final) {
        const arming = reviewArming(cwd, workUnit, topic);
        if (!arming.armed) {
          throw new Error(`review dispatch blocked: ${arming.reason} — the map must move before another review arms (--final bypasses the movement gate)`);
        }
      }
      mapSnapshot = subtopicStatuses(loadWorkUnitManifest(cwd, workUnit), topic);
    }
    const state = loadState(cwd, workUnit, phase, topic);
    const dir = agentDir(cwd, workUnit, phase, topic);
    const inTopic = Object.values(state.agents);

    let nnn;
    if (set !== undefined) {
      // A synthesis joins an existing perspective set: same number, one per set.
      if (!/^\d{3,}$/.test(set)) {
        throw new Error(`Invalid set ${JSON.stringify(set)}: the set number from the perspective dispatch`);
      }
      const members = inTopic.filter((r) => r.kind === 'perspective' && r.set === set);
      if (!members.length) {
        throw new Error(`No perspective set "${set}" for ${phase}/${topic} — dispatch the perspectives first`);
      }
      if (members.some((r) => r.status === 'in-flight')) {
        throw new Error(`Set "${set}" is not complete — a perspective is still in flight; synthesis reads the whole council`);
      }
      if (inTopic.some((r) => r.kind === 'synthesis' && r.set === set && r.status !== 'incorporated')) {
        throw new Error(`Set "${set}" already has a live synthesis — one per set (incorporate a dead one to re-dispatch)`);
      }
      const priorRow = inTopic.find((r) => r.id === `synthesis-${set}`);
      const priorFile = path.join(dir, `synthesis-${set}.md`);
      if (fs.existsSync(priorFile) && !priorRow) {
        throw new Error(`A legacy file synthesis-${set}.md already occupies that name — ids never collide with files`);
      }
      if (priorRow) {
        // Re-dispatch over a closed row: the old report must not become the
        // new agent's completion signal or content.
        fs.rmSync(priorFile, { force: true });
      }
      nnn = set;
    } else {
      let max = 0;
      for (const row of inTopic) {
        if (row.kind === kind) {
          const m = /-(\d{3,})(?:-|$)/.exec(row.id);
          if (m) max = Math.max(max, Number(m[1]));
        }
      }
      if (fs.existsSync(dir)) {
        for (const name of fs.readdirSync(dir)) {
          const m = new RegExp(`^${kind}-(\\d{3,})(?:-|\\.)`).exec(name);
          if (m) max = Math.max(max, Number(m[1]));
        }
      }
      nnn = String(max + 1).padStart(3, '0');
    }

    // Every row in one dispatch shares the number — that shared number IS the
    // set identity a perspective pair and its synthesis are joined by.
    const ids = labels.length
      ? labels.map((label) => `${kind}-${nnn}-${label}`)
      : [`${kind}-${nnn}`];
    const created = new Date().toISOString();
    const agents = ids.map((id, i) => {
      state.agents[id] = {
        id,
        kind,
        phase,
        topic,
        set: nnn,
        ...(labels.length ? { label: labels[i] } : {}),
        status: 'in-flight',
        announced: false,
        findings: [],
        surfaced: [],
        created,
        ...(mapSnapshot ? { map_snapshot: mapSnapshot } : {}),
      };
      return { id, file: path.relative(cwd, path.join(dir, `${id}.md`)) };
    });
    saveState(cwd, workUnit, phase, topic, state);
    if (agents.length === 1) {
      return { work_unit: workUnit, phase, topic, kind, set: nnn, ...agents[0] };
    }
    return { work_unit: workUnit, phase, topic, kind, set: nnn, agents };
  });
}

/** @param {any} row @param {string} cwd @param {string} workUnit */
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
    set: row.set,
    created: row.created,
    announced: row.announced,
    findings: row.findings,
    surfaced: row.surfaced,
    remaining: unsurfaced(row),
    ...(row.label ? { label: row.label } : {}),
  };
}

// Kinds that are consumed by another agent, never surfaced to the user.
const NEVER_SURFACED = ['perspective'];

/**
 * Scan: promote every in-flight row whose content file now exists, then
 * answer with the snapshot the surfacing protocol reads — the rows grouped
 * by state. Which row and which finding to take next is the protocol's
 * judgment, made from lane order and what the conversation just touched.
 * @param {string} cwd @param {string} workUnit @param {string} phase @param {string} topic
 */
function scanAgents(cwd, workUnit, phase, topic) {
  requireWorkUnit(cwd, workUnit);
  validatePhase(phase);
  validateSegment(topic, 'topic');
  return io.withWorkUnitLock(workflowsDir(cwd), workUnit, () => {
    const state = loadState(cwd, workUnit, phase, topic);
    const rows = Object.values(state.agents)
      .sort((a, b) => a.created.localeCompare(b.created) || a.id.localeCompare(b.id));

    let promoted = false;
    for (const row of rows) {
      if (row.status === 'in-flight' && contentFileExists(row, cwd, workUnit)) {
        row.status = 'pending';
        promoted = true;
      }
    }
    if (promoted) saveState(cwd, workUnit, phase, topic, state);

    const byStatus = (/** @type {string} */ s) => rows.filter((r) => r.status === s);

    return {
      work_unit: workUnit,
      phase,
      topic,
      in_flight: byStatus('in-flight').map(publicRow),
      pending: byStatus('pending').map(publicRow),
      acknowledged: byStatus('acknowledged').map(publicRow),
      incorporated: byStatus('incorporated').map(publicRow),
      // The dispatch check reads drained state and the arming verdict from
      // this one scan — discussion only; research has no map to measure.
      ...(phase === 'discussion' ? { review_arming: reviewArming(cwd, workUnit, topic) } : {}),
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
  validateSegment(topic, 'topic');
  if (!Array.isArray(findings) || findings.some((f) => typeof f !== 'string' || f === '')) {
    throw new Error('Invalid findings: a list of non-empty finding ids (may be empty for a clean report)');
  }
  if (new Set(findings).size !== findings.length) {
    throw new Error('Invalid findings: duplicate ids');
  }
  return io.withWorkUnitLock(workflowsDir(cwd), workUnit, () => {
    const state = loadState(cwd, workUnit, phase, topic);
    const row = requireRow(state, phase, topic, id);
    if (NEVER_SURFACED.includes(row.kind)) {
      throw new Error(`Agent "${id}" is a ${row.kind} — a synthesis input, never acknowledged; incorporate it when its synthesis is dispatched`);
    }
    if (row.status !== 'pending') {
      throw new Error(`Agent "${id}" is ${row.status} — only a pending row acknowledges (run \`agent scan\` to promote a finished agent)`);
    }
    row.findings = findings;
    row.status = findings.length === 0 ? 'incorporated' : 'acknowledged';
    saveState(cwd, workUnit, phase, topic, state);
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
  validateSegment(topic, 'topic');
  return io.withWorkUnitLock(workflowsDir(cwd), workUnit, () => {
    const state = loadState(cwd, workUnit, phase, topic);
    const row = requireRow(state, phase, topic, id);
    if (row.status !== 'acknowledged') {
      throw new Error(`Agent "${id}" is ${row.status} — only an acknowledged row announces`);
    }
    row.announced = true;
    saveState(cwd, workUnit, phase, topic, state);
    return { work_unit: workUnit, phase, topic, ...publicRow(row) };
  });
}

/**
 * Surface one finding, or a comma-separated batch of them — a lane's whole
 * screen lands in one call. Every id is validated before any is recorded, so
 * a bad entry fails the batch whole. When the last unsurfaced finding is
 * raised the row incorporates automatically — the response's `status` says so.
 * @param {string} cwd @param {string} workUnit @param {string} phase
 * @param {string} topic @param {string} id @param {string} finding
 */
function surfaceFinding(cwd, workUnit, phase, topic, id, finding) {
  requireWorkUnit(cwd, workUnit);
  validatePhase(phase);
  validateSegment(topic, 'topic');
  const batch = String(finding).split(',').map((f) => f.trim());
  if (batch.some((f) => f === '')) {
    throw new Error('Invalid findings: a finding id, or a comma-separated list of them, with no empty entries');
  }
  if (new Set(batch).size !== batch.length) {
    throw new Error('Invalid findings: duplicate ids');
  }
  return io.withWorkUnitLock(workflowsDir(cwd), workUnit, () => {
    const state = loadState(cwd, workUnit, phase, topic);
    const row = requireRow(state, phase, topic, id);
    if (row.status !== 'acknowledged') {
      throw new Error(`Agent "${id}" is ${row.status} — only an acknowledged row surfaces findings`);
    }
    for (const f of batch) {
      if (!row.findings.includes(f)) {
        throw new Error(`Agent "${id}" has no finding "${f}". Findings: ${row.findings.join(', ')}`);
      }
      if (row.surfaced.includes(f)) {
        throw new Error(`Finding "${f}" is already surfaced on "${id}"`);
      }
    }
    row.surfaced.push(...batch);
    if (unsurfaced(row).length === 0) row.status = 'incorporated';
    saveState(cwd, workUnit, phase, topic, state);
    return { work_unit: workUnit, phase, topic, ...publicRow(row) };
  });
}

/**
 * Incorporate a row wholesale — the terminal close from any live state.
 * From acknowledged it is the skip-all exit (declined ids stay unsurfaced,
 * a true record of what was offered); from pending it marks a report
 * consumed without surfacing (a perspective feeding synthesis); from
 * in-flight it abandons a row whose session died before the agent returned.
 * @param {string} cwd @param {string} workUnit @param {string} phase
 * @param {string} topic @param {string} id
 */
function incorporateAgent(cwd, workUnit, phase, topic, id) {
  requireWorkUnit(cwd, workUnit);
  validatePhase(phase);
  validateSegment(topic, 'topic');
  return io.withWorkUnitLock(workflowsDir(cwd), workUnit, () => {
    const state = loadState(cwd, workUnit, phase, topic);
    const row = requireRow(state, phase, topic, id);
    if (row.status === 'incorporated') {
      throw new Error(`Agent "${id}" is already incorporated`);
    }
    row.status = 'incorporated';
    saveState(cwd, workUnit, phase, topic, state);
    return { work_unit: workUnit, phase, topic, ...publicRow(row) };
  });
}

module.exports = {
  AGENT_KINDS,
  AGENT_STATUSES,
  SUBTOPIC_RANK,
  dispatchAgent,
  scanAgents,
  ackAgent,
  announceAgent,
  surfaceFinding,
  incorporateAgent,
  completedReviewCycles,
  reviewArming,
};
