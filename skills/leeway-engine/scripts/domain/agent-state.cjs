'use strict';

// ---------------------------------------------------------------------------
// Domain ring: background-agent lifecycle — `engine agent <verb>`.
//
// The one owner of the surfacing state machine that used to live as
// hand-edited cache-file frontmatter (design/analysis-state.md, S1/S2).
// State lives in an engine-owned store colocated with the topic's content
// files — `.cache/{wu}/{phase}/{topic}/state.json` in the state — validated
// vocabularies, locked atomic writes, gitignored. Deleting a topic's cache
// directory (restart) or the work unit's cache (close) removes state and
// content together: a cleanse is structural, never a second call. Content stays markdown:
// an agent writes its findings file and nothing else; the file's existence
// IS its completion signal (no skeleton files, no frontmatter).
//
// Lifecycle per row: in-flight → pending → acknowledged → incorporated,
// with `surfaced[]` (finding ids raised so far) tracked on acknowledged
// rows. `scan` is the one read
// the surfacing protocol and conclusion gates need: it promotes finished
// rows and answers with a decision-ready snapshot. Each row names the
// Claude process and conversation that dispatched it, as a presence record
// names its owner, so the entry can tell the agents a topic was left with
// (`agentsLeft`): a report that landed since, or an agent lost with a
// process that no longer runs — a resumed conversation keeps its session id,
// never its process — and never re-dispatched by the engine.
//
// A discussion review or closing pass is stamped with the ledger's mark at
// its dispatch (ledger-moves.cjs), and so is an investigation's validation.
// The background review's back-off arms on the topic's moves since the last
// review's mark (9.8.14), and a gap review has run since the topic's last
// decision where a review or a closing pass dispatched after it has
// reported (9.9.6). A validation has been taken in for an entry where one
// of its kind dispatched after the entry was made reported and was
// incorporated (19.4.7): a root cause or a fix replaced since is validated
// afresh.
//
// A unit's own dispatches — the spec's, which is the unit's — keep their
// store at the unit's spec, `.cache/{wu}/specification/{wu}/`, the place the
// spec's entry reads for the agents it was left with. A spec review's row is
// bound, as its brief is issued, to the land of the spec it reviews
// (spec-passes.cjs), `land` on its row; one whose brief is refused before it
// is bound is closed, so no reader lists it in flight. Its report is taken
// in only as it reads (spec-report.cjs), the findings it read kept on its
// row, `report_findings`, which every later read takes in place of the
// report: one that does not read is refused where it would be taken in, the
// refusal on its row, `refused`, and the row closed, never reported. It is
// acknowledged with exactly the findings its report was taken in with, and
// never incorporated between its report and that acknowledgement, so a
// finding is declined only where its pass was acknowledged with it and then
// incorporated. Its rewrite findings go to the writer whole, never surfaced,
// so its row stays acknowledged while it holds any, and every answer shows
// them apart from the findings left to surface, which an incorporation
// declines. A row incorporated while in flight with no report is closed
// unread: a report landing after is never taken in, since only a row in
// flight is. A spec review an earlier conversation left in flight, its
// report not on disk, is closed so as the spec is entered: no notice of its
// report, or of its agent dying, reaches a later conversation, which would
// wait on it. A gap finding raised as the replacement of a decision is
// surfaced with that decision, the reason and the ledger's mark, `raised` on
// its row: no question stands for it on the ledger, so the spec's loop
// (spec-passes.cjs) holds the writer on it until the person's call lands.
// A gap finding asked as a question is surfaced with the question's entry,
// `asked` on its row, the link the board follows from the finding to its
// answer.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const io = require('../kernel/manifest-io.cjs');
const { VALID_PHASES } = require('../kernel/manifest-schema.cjs');
const { mailboxDepth } = require('./derivations.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { callerIdentity, handedSession, ownerAlive, ownsRow, startTimeReader } = require('../kernel/process.cjs');
const { ID_FACTS, foldLedger } = require('./ledger-fold.cjs');
const { markOf, lineOf, movesSince, lastDecisionLine } = require('./ledger-moves.cjs');
const { resolveId } = require('./ledger-ids.cjs');
const { REASONS } = require('./ledger-events.cjs');
const { pairProblem } = require('./lenses.cjs');
const { readReport } = require('./spec-report.cjs');

const AGENT_KINDS = [
  'review',
  'deep-dive',
  'perspective',
  'synthesis',
  'root-cause-validation',
  'fix-validation',
  'closing-pass',
  'spec-review',
];

const AGENT_STATUSES = ['in-flight', 'pending', 'acknowledged', 'incorporated'];

// Review-arming backoff: review n+1 needs min(n, MOVEMENT_CAP) of the
// topic's moves since the last review or closing pass. The cap keeps late reviews permanently reachable
// on genuinely new ground instead of climbing toward a de-facto ceiling.
const MOVEMENT_CAP = 3;

/** The discussion kinds that read the topic's record whole, each stamped with the ledger's mark at its dispatch. */
const REVIEWING_KINDS = ['review', 'closing-pass'];

/** An investigation's validations, each stamped with the ledger's mark at its dispatch. */
const VALIDATION_KINDS = ['root-cause-validation', 'fix-validation'];

/** Whether a dispatch of `kind` at `phase` is stamped with the ledger's mark. @param {string} phase @param {string} kind */
const markedAt = (phase, kind) => (phase === 'discussion' && REVIEWING_KINDS.includes(kind)) || (phase === 'investigation' && VALIDATION_KINDS.includes(kind));

/** @param {string} cwd @param {string} workUnit @param {string} phase @param {string} topic */
function statePath(cwd, workUnit, phase, topic) {
  return path.join(stateRoot(cwd), '.cache', workUnit, phase, topic, 'state.json');
}

/** @param {string} cwd @param {string} workUnit @param {string} phase @param {string} topic */
function agentDir(cwd, workUnit, phase, topic) {
  return path.join(stateRoot(cwd), '.cache', workUnit, phase, topic);
}

/** @param {string} cwd @param {string} workUnit */
function requireWorkUnit(cwd, workUnit) {
  validateSegment(workUnit, 'work unit');
  if (!fs.existsSync(io.workUnitManifestPath(stateRoot(cwd), workUnit))) {
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
      || ['findings', 'surfaced', 'report_findings', 'raised', 'asked'].some((list) => list in row && !Array.isArray(row[list]))) {
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
 * Completed review cycles for a discussion topic. The agent store is authoritative:
 * review rows past `in-flight` are cycles that happened, counted only when
 * a real report backs them; a finished-but-unscanned row counts — the
 * report landed, no scan has promoted it yet. Legacy review-*.md files with
 * no store row (pre-programme caches) count by existence alone. Tolerant
 * throughout — a derivation read must never brick a display.
 * @param {string} cwd @param {string} workUnit @param {string} topic
 */
function completedReviewCycles(cwd, workUnit, topic) {
  const dir = agentDir(cwd, workUnit, 'discussion', topic);
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
 * The arming anchor: the latest report-backed review or closing-pass row —
 * a closing pass read the record whole, so the moves before it are read
 * however the topic reopens. A row with no report is a killed dispatch
 * closed as bookkeeping, never a read — anchoring on it would hide every
 * move between the real read and the kill.
 * @param {string} dir
 */
function anchorReviewRow(dir) {
  return derivationRows(dir)
    .filter((r) => REVIEWING_KINDS.includes(r.kind) && reportBacked(r, dir))
    .sort((a, b) => String(a.created).localeCompare(String(b.created)) || a.id.localeCompare(b.id))
    .pop() || null;
}

/** The ledger's facts as they stand, what a landing its check finished said let go. @param {string} cwd */
function ledgerFacts(cwd) {
  return foldLedger(stateRoot(cwd), ID_FACTS, []);
}

/**
 * A replacement raised, as its surfacing keeps it: the decision by its full
 * id, the reason, and the ledger's mark. Refuses a reason a replacement
 * never gives, and an id no entry, or several, begin.
 * @param {string} cwd @param {{decision: string, reason: string}} replacing
 * @returns {{replaces: string, reason: string, mark: string|null}}
 */
function raisedAs(cwd, { decision, reason }) {
  if (!REASONS.includes(reason)) throw new Error(`Invalid reason: "${reason}" — a replacement's reason is one of ${REASONS.join(', ')}`);
  const facts = ledgerFacts(cwd);
  return { replaces: resolveId(decision, facts.keys()), reason, mark: markOf(facts) };
}

/**
 * @typedef {object} ReviewArming
 * @property {boolean} armed
 * @property {number} cycles              completed (report-backed) review cycles
 * @property {number|null} moves_seen the topic's moves since the anchor; null when no review has completed
 * @property {number} moves_needed    min(cycles, MOVEMENT_CAP)
 * @property {string} reason              one line, always present
 */

/**
 * The arming verdict over the ledger's facts as they stand.
 * @param {string} cwd @param {string} workUnit @param {string} topic
 * @param {import('./ledger-moves.cjs').Facts} facts
 * @returns {ReviewArming}
 */
function armingOf(cwd, workUnit, topic, facts) {
  const cycles = completedReviewCycles(cwd, workUnit, topic);
  const needed = Math.min(cycles, MOVEMENT_CAP);
  if (needed === 0) {
    return { armed: true, cycles, moves_seen: null, moves_needed: 0, reason: 'no completed review cycle — the first review is free' };
  }
  const anchor = anchorReviewRow(agentDir(cwd, workUnit, 'discussion', topic));
  const moves = movesSince(facts, workUnit, topic, anchor === null ? null : anchor.ledger_mark);
  const since = anchor === null ? 'the last review' : anchor.id;
  return {
    armed: moves >= needed,
    cycles,
    moves_seen: moves,
    moves_needed: needed,
    reason: moves >= needed
      ? `armed on ${moves} move(s) since ${since}`
      : `quiet — ${moves} of ${needed} moves since ${since}`,
  };
}

/**
 * The review-arming verdict for a discussion topic — is a background review
 * worth dispatching, measured by the topic's moves on the ledger since the
 * last real read (ledger-moves.cjs): the person's questions opened or
 * closed, and Claude's calls (9.8.14). The first review is free; review n+1
 * needs min(n, MOVEMENT_CAP) moves since the anchor's mark, the latest
 * report-backed review or closing-pass row's. Tolerant of the store — the verdict rides
 * displays and must never brick one.
 * @param {string} cwd @param {string} workUnit @param {string} topic
 * @returns {ReviewArming}
 */
function reviewArming(cwd, workUnit, topic) {
  requireWorkUnit(cwd, workUnit);
  validateSegment(topic, 'topic');
  return armingOf(cwd, workUnit, topic, ledgerFacts(cwd));
}

/**
 * The gap review that has run on a discussion topic since its last
 * decision (9.9.6): the arming anchor, where the topic's last decision does
 * not pass its mark; null where none has. Marks only grow with dispatch
 * order, so no earlier read can pass where the anchor does not. Read
 * without promoting or saving anything, tolerant of the store.
 * @param {string} cwd @param {string} workUnit @param {string} topic
 * @returns {string|null}
 */
function gapReviewSince(cwd, workUnit, topic) {
  const anchor = anchorReviewRow(agentDir(cwd, workUnit, 'discussion', topic));
  if (anchor === null) return null;
  const facts = ledgerFacts(cwd);
  return lineOf(facts, anchor.ledger_mark) >= lastDecisionLine(facts, workUnit, topic) ? anchor.id : null;
}

/**
 * Whether a validation of `kind` at the bugfix's investigation was taken in
 * for the entry at `line` of the ledger: one dispatched after it, its mark
 * at or past that line, reported and incorporated. Read without promoting or
 * saving anything, tolerant of the store.
 * @param {string} cwd @param {string} workUnit @param {string} kind
 * @param {import('./ledger-moves.cjs').Facts} facts @param {number} line
 */
function takenInFor(cwd, workUnit, kind, facts, line) {
  const dir = agentDir(cwd, workUnit, 'investigation', workUnit);
  return derivationRows(dir).some((row) => row.kind === kind && row.status === 'incorporated' && lineOf(facts, row.ledger_mark) >= line && reportBacked(row, dir));
}

/**
 * A topic's rows in scan's public shape, read without side effects — in the
 * order they were dispatched, so a pair keeps the order its labels were
 * given in. A render reads them to word a line or a gate; nothing is
 * promoted or saved.
 * @param {string} cwd @param {string} workUnit @param {string} phase @param {string} topic
 */
function agentRows(cwd, workUnit, phase, topic) {
  return Object.values(loadState(cwd, workUnit, phase, topic).agents).map(publicRow);
}

/**
 * A discussion topic's latest review row — the highest-numbered `review`
 * row in scan order, or null when no review has been dispatched.
 * @param {string} cwd @param {string} workUnit @param {string} topic
 */
function latestReview(cwd, workUnit, topic) {
  const rows = agentRows(cwd, workUnit, 'discussion', topic)
    .filter((r) => r.kind === 'review')
    .sort((a, b) => a.created.localeCompare(b.created) || a.id.localeCompare(b.id));
  return rows.length ? rows[rows.length - 1] : null;
}

/**
 * Dispatch: allocate the next id for this kind, record the row in-flight,
 * and answer with the content-file path the sub-agent must write. No file
 * is created — the content file's later existence is the completion signal.
 * A discussion review refuses while the topic's mailbox holds messages —
 * a waiting message is a pending change to the document the review
 * would read, so the report would be stale on arrival — and while unarmed
 * (`reviewArming`); `final: true` bypasses the movement gate. Every discussion review and closing pass row is stamped
 * with the ledger's mark, `ledger_mark`, which arming and the gap review
 * measure from, and every investigation's validation, which whether it was
 * taken in for an entry measures from.
 * Numbering starts after both existing rows AND any legacy files already in
 * the cache dir (pre-programme skeletons keep their names; ids never collide).
 * Each row names the dispatching process and conversation (`pid`,
 * `pid_start`, `session_id`), null where Claude Code handed none.
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
  const unpaired = kind === 'perspective' ? pairProblem(labels) : null;
  if (unpaired !== null) throw new Error(unpaired);
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
  return io.withWorkUnitLock(stateRoot(cwd), workUnit, () => {
    const facts = markedAt(phase, kind) ? ledgerFacts(cwd) : null;
    if (kind === 'review' && phase === 'discussion') {
      const waiting = mailboxDepth(stateRoot(cwd), workUnit, topic);
      if (waiting > 0) {
        throw new Error(`review dispatch blocked: ${waiting} message(s) wait in ${topic}'s mailbox — raise and answer them (topic answered) before dispatching a review`);
      }
      if (!final) {
        const arming = armingOf(cwd, workUnit, topic, /** @type {import('./ledger-moves.cjs').Facts} */ (facts));
        if (!arming.armed) {
          throw new Error(`review dispatch blocked: ${arming.reason} — the topic must move before another review arms (--final bypasses the movement gate)`);
        }
      }
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
    const dispatcher = callerIdentity();
    const agents = ids.map((id, i) => {
      state.agents[id] = {
        id,
        kind,
        phase,
        topic,
        set: nnn,
        ...(labels.length ? { label: labels[i] } : {}),
        status: 'in-flight',
        findings: [],
        surfaced: [],
        created,
        ...dispatcher,
        ...(facts === null ? {} : { ledger_mark: markOf(facts) }),
      };
      return { id, file: path.join(dir, `${id}.md`) };
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

/**
 * Take a spec review's report in, its row in flight and its report on
 * disk: where it reads, the findings it holds kept on its row and the row
 * pending; where it does not, what does not read kept on its row and the
 * row closed. Answers the refusal, said with its way on, null where it
 * reads.
 * @param {any} row @param {string} cwd @param {string} workUnit @returns {string|null}
 */
function takeInReport(row, cwd, workUnit) {
  const read = readReport(fs.readFileSync(path.join(agentDir(cwd, workUnit, row.phase, row.topic), `${row.id}.md`), 'utf8'));
  if ('findings' in read) {
    row.report_findings = read.findings;
    row.status = 'pending';
    return null;
  }
  row.refused = read.fault;
  row.status = 'incorporated';
  return `${row.id}'s report does not read as a spec review: ${read.fault} — it is set aside unread; dispatch another pass, and its brief carries this refusal`;
}

/** @param {any} row */
function unsurfaced(row) {
  return row.findings.filter((/** @type {string} */ f) => !row.surfaced.includes(f));
}

/** A spec review's findings handed to the writer whole, never surfaced: its report's rewrite findings. @param {any} row @returns {string[]} */
function forWriter(row) {
  if (row.kind !== 'spec-review' || !Array.isArray(row.report_findings)) return [];
  return row.report_findings.filter((/** @type {{lane: string}} */ { lane }) => lane === 'rewrite').map((/** @type {{id: string}} */ { id }) => id);
}

/**
 * A row as every answer shows it: `remaining` its findings left to surface
 * — declined where it is incorporated — and, for a spec review, the rewrite
 * findings handed to the writer instead, `for_writer`, never among them.
 * @param {any} row
 */
function publicRow(row) {
  const writer = forWriter(row);
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    set: row.set,
    created: row.created,
    findings: row.findings,
    surfaced: row.surfaced,
    remaining: unsurfaced(row).filter((/** @type {string} */ f) => !writer.includes(f)),
    ...(writer.length > 0 ? { for_writer: writer } : {}),
    ...(row.label ? { label: row.label } : {}),
    ...(row.question ? { question: row.question } : {}),
  };
}

// Kinds that are consumed by another agent, never surfaced to the user.
const NEVER_SURFACED = ['perspective'];

/**
 * The agents a topic was left with, untaken, in dispatch order — never a
 * peer's whose process still runs, which stay that peer's: `landed`, each with
 * its report's path, where the report is on disk and not yet read in; `lost`
 * where it is not and the process that dispatched it no longer runs — a
 * conversation resumed after a crash keeps its session id, never its
 * process, and a row naming no process is never verified alive. One of the
 * caller's own still running is neither. Read without promoting or saving
 * anything, and a store that does not read answers none, as a derivation's
 * read does.
 * @param {string} cwd @param {string} workUnit @param {string} phase @param {string} topic
 * @returns {{landed: {id: string, file: string}[], lost: string[]}}
 */
function agentsLeft(cwd, workUnit, phase, topic) {
  const dir = agentDir(cwd, workUnit, phase, topic);
  const startOf = startTimeReader();
  /** @type {{landed: {id: string, file: string}[], lost: string[]}} */
  const left = { landed: [], lost: [] };
  const untaken = derivationRows(dir)
    .filter((row) => row.status === 'in-flight' || row.status === 'pending')
    .sort((a, b) => String(a.created).localeCompare(String(b.created)) || a.id.localeCompare(b.id));
  for (const row of untaken) {
    const alive = ownerAlive(row, startOf);
    if (alive && !ownsRow(row)) continue;
    if (contentFileExists(row, cwd, workUnit)) left.landed.push({ id: row.id, file: path.join(dir, `${row.id}.md`) });
    else if (!alive) left.lost.push(row.id);
  }
  return left;
}

/**
 * The agents still running on a topic, in dispatch order: dispatched, their
 * report not on disk, and the process that dispatched them alive — a peer's
 * among them, since a report lands in the topic whoever waits for it. Read
 * as `agentsLeft` reads, promoting and saving nothing.
 * @param {string} cwd @param {string} workUnit @param {string} phase @param {string} topic
 * @returns {{id: string, kind: string}[]}
 */
function runningAgents(cwd, workUnit, phase, topic) {
  const standing = inFlightStanding(cwd, workUnit);
  return derivationRows(agentDir(cwd, workUnit, phase, topic))
    .filter((row) => row.status === 'in-flight' && standing(row) === 'running')
    .sort((a, b) => String(a.created).localeCompare(String(b.created)) || a.id.localeCompare(b.id))
    .map(({ id, kind }) => ({ id, kind }));
}

/**
 * Where an agent in flight stands, as one read of the processes running
 * answers it: its report on disk for a scan to take in, its agent running
 * while the process that dispatched it is alive, else lost with it.
 * @param {string} cwd @param {string} workUnit @returns {(row: any) => 'landed'|'running'|'lost'}
 */
function inFlightStanding(cwd, workUnit) {
  const startOf = startTimeReader();
  return (row) => (contentFileExists(row, cwd, workUnit) ? 'landed' : ownerAlive(row, startOf) ? 'running' : 'lost');
}

/**
 * Where each agent in flight on a topic stands (`inFlightStanding`), by id,
 * read promoting and saving nothing.
 * @param {string} cwd @param {string} workUnit @param {string} phase @param {string} topic
 * @returns {Map<string, 'landed'|'running'|'lost'>}
 */
function inFlightStandings(cwd, workUnit, phase, topic) {
  const standing = inFlightStanding(cwd, workUnit);
  return new Map(derivationRows(agentDir(cwd, workUnit, phase, topic)).filter((row) => row.status === 'in-flight').map((row) => [row.id, standing(row)]));
}

/**
 * Scan: promote every in-flight row whose content file now exists, then
 * answer with the snapshot the surfacing protocol reads — the rows grouped
 * by state. Which row and which finding to take next is the protocol's
 * judgment, made from lane order and what the conversation just touched.
 * A spec review's report is taken in as it reads; one that does not is
 * closed instead, with the refusal, answered under `refused` with the way
 * on: another pass, its brief carrying the refusal.
 * @param {string} cwd @param {string} workUnit @param {string} phase @param {string} topic
 */
function scanAgents(cwd, workUnit, phase, topic) {
  requireWorkUnit(cwd, workUnit);
  validatePhase(phase);
  validateSegment(topic, 'topic');
  return io.withWorkUnitLock(stateRoot(cwd), workUnit, () => {
    const state = loadState(cwd, workUnit, phase, topic);
    const rows = Object.values(state.agents)
      .sort((a, b) => a.created.localeCompare(b.created) || a.id.localeCompare(b.id));

    let promoted = false;
    /** @type {{id: string, refusal: string}[]} */
    const refused = [];
    for (const row of rows) {
      if (row.status !== 'in-flight' || !contentFileExists(row, cwd, workUnit)) continue;
      promoted = true;
      if (row.kind !== 'spec-review') {
        row.status = 'pending';
        continue;
      }
      const refusal = takeInReport(row, cwd, workUnit);
      if (refusal !== null) refused.push({ id: row.id, refusal });
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
      ...(refused.length > 0 ? { refused } : {}),
      // The dispatch check reads drained state and the arming verdict from
      // this one scan.
      ...(phase === 'discussion' ? { review_arming: reviewArming(cwd, workUnit, topic) } : {}),
    };
  });
}

/**
 * Acknowledge a pending row: record the finding ids read from the content
 * file. An empty list is legal — a clean report incorporates immediately. A
 * spec review is acknowledged with exactly the findings its report was
 * taken in with, so `--clean` is refused while it holds any.
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
  return io.withWorkUnitLock(stateRoot(cwd), workUnit, () => {
    const state = loadState(cwd, workUnit, phase, topic);
    const row = requireRow(state, phase, topic, id);
    if (NEVER_SURFACED.includes(row.kind)) {
      throw new Error(`Agent "${id}" is a ${row.kind} — a synthesis input, never acknowledged; incorporate it when its synthesis is dispatched`);
    }
    if (row.status !== 'pending') {
      throw new Error(`Agent "${id}" is ${row.status} — only a pending row acknowledges (run \`agent scan\` to promote a finished agent)`);
    }
    if (row.kind === 'spec-review') requireReportFindings(row, findings);
    row.findings = findings;
    row.status = findings.length === 0 ? 'incorporated' : 'acknowledged';
    saveState(cwd, workUnit, phase, topic, state);
    return { work_unit: workUnit, phase, topic, ...publicRow(row) };
  });
}

/**
 * Refused unless `findings` are exactly the findings the spec review's
 * report was taken in with, in any order.
 * @param {any} row @param {string[]} findings
 */
function requireReportFindings(row, findings) {
  const held = row.report_findings.map((/** @type {{id: string}} */ { id }) => id);
  if (held.length === findings.length && held.every((id) => findings.includes(id))) return;
  const holds = held.length === 0 ? 'no finding' : held.join(', ');
  throw new Error(`Agent "${row.id}" is a spec review whose report holds ${holds} — it is acknowledged with exactly its report's findings${held.length === 0 ? ', with --clean' : ''}`);
}

/**
 * The question a spec review's finding was asked as, by its full id:
 * refused for an id no entry, or several, begin, and for an entry that is
 * no question asked at the unit's spec.
 * @param {string} cwd @param {string} workUnit @param {string} question
 */
function askedAs(cwd, workUnit, question) {
  const facts = ledgerFacts(cwd);
  const entry = resolveId(question, facts.keys());
  const made = /** @type {Record<string, any>} */ (facts.get(entry));
  if (made.kind !== 'question' || made.unit !== workUnit || made.topic !== null || made.phase !== UNIT_PHASE) {
    throw new Error(`--question names a question asked at ${workUnit}.specification, and ${question} is none`);
  }
  return entry;
}

/**
 * Surface one finding, or a comma-separated batch of them — a lane's whole
 * screen lands in one call. Every id is validated before any is recorded, so
 * a bad entry fails the batch whole. When the last unsurfaced finding is
 * raised the row incorporates automatically — the response's `status` says so.
 * One finding raised as the replacement of a decision is surfaced with it,
 * `replacing`: the decision by a prefix of its id and the reason, kept with
 * the ledger's mark. One finding asked as a question is surfaced with it,
 * `question`: the question by a prefix of its id, kept by its full id on the
 * row's `asked`, so the board follows the finding to its answer.
 * @param {string} cwd @param {string} workUnit @param {string} phase
 * @param {string} topic @param {string} id @param {string} finding
 * @param {{decision: string, reason: string}} [replacing] @param {string} [question]
 */
function surfaceFinding(cwd, workUnit, phase, topic, id, finding, replacing, question) {
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
  if (replacing !== undefined && question !== undefined) throw new Error('a finding is raised as a replacement with --replaces, or asked as a question with --question, never both');
  if (replacing !== undefined && batch.length > 1) throw new Error('--replaces surfaces one finding, raised as the replacement of that decision');
  if (question !== undefined && batch.length > 1) throw new Error('--question surfaces one finding, asked as that question');
  const raised = replacing === undefined ? null : raisedAs(cwd, replacing);
  const asked = question === undefined ? null : askedAs(cwd, workUnit, question);
  return io.withWorkUnitLock(stateRoot(cwd), workUnit, () => {
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
    if (raised !== null) row.raised = [...(Array.isArray(row.raised) ? row.raised : []), { finding: batch[0], ...raised }];
    if (asked !== null) row.asked = [...(Array.isArray(row.asked) ? row.asked : []), { finding: batch[0], entry: asked }];
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
 * in-flight it abandons a row whose session died before the agent returned,
 * so a report landing after is never taken in. A spec review whose report
 * is in is refused until it is acknowledged, its findings read before any
 * is declined: pending, or in flight with a report that reads; one in
 * flight whose report does not read is refused as a scan refuses it, the
 * refusal answered under `refusal`. A row closed already — by this, by its
 * acknowledgement as clean, or by its last finding surfaced — is answered as
 * that close left it, nothing written, so a caller closes every pass the same
 * way whatever closed it first.
 * @param {string} cwd @param {string} workUnit @param {string} phase
 * @param {string} topic @param {string} id
 */
function incorporateAgent(cwd, workUnit, phase, topic, id) {
  requireWorkUnit(cwd, workUnit);
  validatePhase(phase);
  validateSegment(topic, 'topic');
  return io.withWorkUnitLock(stateRoot(cwd), workUnit, () => {
    const state = loadState(cwd, workUnit, phase, topic);
    const row = requireRow(state, phase, topic, id);
    if (row.status === 'incorporated') return { work_unit: workUnit, phase, topic, ...publicRow(row) };
    const refusal = row.kind === 'spec-review' && row.status === 'in-flight' && contentFileExists(row, cwd, workUnit) ? takeInReport(row, cwd, workUnit) : null;
    if (row.kind === 'spec-review' && row.status === 'pending') {
      throw new Error(`Agent "${id}" is a spec review whose report is in, not yet acknowledged — agent ack records its findings first (agent scan takes the report in)`);
    }
    row.status = 'incorporated';
    saveState(cwd, workUnit, phase, topic, state);
    return { work_unit: workUnit, phase, topic, ...publicRow(row), ...(refusal === null ? {} : { refusal }) };
  });
}

/**
 * The agents a topic leaving the board takes with it — cancelled or
 * postponed: each row of the phase still in flight, its report not on disk,
 * closed as incorporated, so a report landing after is never taken in. A row
 * whose report landed stays, for the topic's return. Answers the ids closed.
 * @param {string} cwd @param {string} workUnit @param {string} phase @param {string} topic
 * @returns {string[]}
 */
function closeInFlight(cwd, workUnit, phase, topic) {
  return io.withWorkUnitLock(stateRoot(cwd), workUnit, () => {
    const state = loadState(cwd, workUnit, phase, topic);
    const closing = Object.values(state.agents).filter((row) => row.status === 'in-flight' && !contentFileExists(row, cwd, workUnit));
    for (const row of closing) row.status = 'incorporated';
    if (closing.length > 0) saveState(cwd, workUnit, phase, topic, state);
    return closing.map((row) => row.id);
  });
}

/** The phase whose store keeps a unit's own dispatches, at the unit as its topic. */
const UNIT_PHASE = 'specification';

/**
 * A store's rows as a brief reads them, in the order they were dispatched:
 * each in scan's public shape, with the report its agent writes.
 * @param {string} cwd @param {string} workUnit @param {string} phase @param {string} topic
 */
function dispatchedRows(cwd, workUnit, phase, topic) {
  const dir = agentDir(cwd, workUnit, phase, topic);
  return agentRows(cwd, workUnit, phase, topic).map((row) => ({ ...row, file: path.join(dir, `${row.id}.md`) }));
}

/**
 * A discussion dispatch bound to the question its brief argues, by the
 * question's first wording, `question` on its row: what a synthesis reads
 * back from its set, so it is briefed on the question its pair argued.
 * Refused where the row is bound to another.
 * @param {string} cwd @param {string} workUnit @param {string} topic @param {string} id @param {string} question
 */
function bindQuestion(cwd, workUnit, topic, id, question) {
  io.withWorkUnitLock(stateRoot(cwd), workUnit, () => {
    const state = loadState(cwd, workUnit, 'discussion', topic);
    const row = requireRow(state, 'discussion', topic, id);
    if (row.question !== undefined && row.question !== question) {
      throw new Error(`brief: ${id} was briefed on another question — a dispatch argues the one question it was first briefed on`);
    }
    row.question = question;
    saveState(cwd, workUnit, 'discussion', topic, state);
  });
}

/** @typedef {import('./spec-passes.cjs').Landed} Landed */

/**
 * A spec review's dispatch bound to the land of the spec its brief is
 * issued on. Refused where the row was bound to a land of another print: a
 * pass reviews the spec it was first briefed on.
 * @param {string} cwd @param {string} workUnit @param {string} id @param {Landed} land
 */
function bindSpec(cwd, workUnit, id, land) {
  io.withWorkUnitLock(stateRoot(cwd), workUnit, () => {
    const state = loadState(cwd, workUnit, UNIT_PHASE, workUnit);
    const row = requireRow(state, UNIT_PHASE, workUnit, id);
    if (row.land !== undefined) {
      if (row.land.digest === land.digest) return;
      throw new Error(`brief: ${id} was briefed on another landing of the spec — a pass reviews the spec it was first briefed on, so dispatch another`);
    }
    row.land = land;
    saveState(cwd, workUnit, UNIT_PHASE, workUnit, state);
  });
}

/**
 * Close the unit's spec review `id` where its brief was refused before it
 * was bound to a land: no agent was sent on it, so no reader of the store
 * lists it in flight. One bound to a land, of another kind or no longer in
 * flight is left as it is.
 * @param {string} cwd @param {string} workUnit @param {string} id
 */
function closeUnbriefed(cwd, workUnit, id) {
  io.withWorkUnitLock(stateRoot(cwd), workUnit, () => {
    const state = loadState(cwd, workUnit, UNIT_PHASE, workUnit);
    const row = state.agents[id];
    if (row?.kind !== 'spec-review' || row.status !== 'in-flight' || row.land !== undefined) return;
    row.status = 'incorporated';
    saveState(cwd, workUnit, UNIT_PHASE, workUnit, state);
  });
}

/**
 * Close the unit's spec reviews another conversation left in flight, their
 * reports not on disk, as `incorporate` abandons one in flight: a report
 * landing after is never taken in. Another conversation's is a row whose
 * session id is not the caller's; a row with none, or a caller handed none,
 * is left as it is, judged by the process that dispatched it. Answers the
 * ids closed.
 * @param {string} cwd @param {string} workUnit @returns {string[]}
 */
function abandonEarlierPasses(cwd, workUnit) {
  const session = handedSession();
  if (session === null) return [];
  return io.withWorkUnitLock(stateRoot(cwd), workUnit, () => {
    const state = loadState(cwd, workUnit, UNIT_PHASE, workUnit);
    const earlier = Object.values(state.agents).filter((row) => row.kind === 'spec-review' && row.status === 'in-flight'
      && typeof row.session_id === 'string' && row.session_id !== session && !contentFileExists(row, cwd, workUnit));
    for (const row of earlier) row.status = 'incorporated';
    if (earlier.length > 0) saveState(cwd, workUnit, UNIT_PHASE, workUnit, state);
    return earlier.map((row) => row.id);
  });
}

/** @typedef {import('./spec-report.cjs').ReportFinding} ReportFinding */

/** Whether a spec review's report was taken in. @param {any} row */
const takenIn = (row) => Array.isArray(row.report_findings);

/** A unit's spec reviews, in dispatch order. @param {string} cwd @param {string} workUnit */
const specReviewRows = (cwd, workUnit) => derivationRows(agentDir(cwd, workUnit, UNIT_PHASE, workUnit))
  .filter((row) => row.kind === 'spec-review')
  .sort((a, b) => String(a.created).localeCompare(String(b.created)) || a.id.localeCompare(b.id));

/**
 * The unit's review passes whose report was taken in, in the order they
 * were dispatched, each bound to a land: when it was dispatched, its
 * report's file, the findings it was taken in with, its status, and the
 * findings it was acknowledged with and surfaced, and those raised as a
 * replacement or asked as a question, each with what it was raised or asked
 * as. A pass refused, or closed in flight, is never taken in. Read as a derivation reads, tolerant of the store.
 * @param {string} cwd @param {string} workUnit
 * @returns {{
 *   id: string, created: string, land: Landed, file: string, findings: ReportFinding[], status: string, acknowledged: string[], surfaced: string[],
 *   raised: {finding: string, replaces: string, reason: string, mark: string|null}[], asked: {finding: string, entry: string}[],
 * }[]}
 */
function reportedPasses(cwd, workUnit) {
  const dir = agentDir(cwd, workUnit, UNIT_PHASE, workUnit);
  return specReviewRows(cwd, workUnit)
    .filter((row) => row.land !== undefined && takenIn(row))
    .map((row) => ({
      id: row.id,
      created: String(row.created),
      land: row.land,
      file: path.join(dir, `${row.id}.md`),
      findings: row.report_findings,
      status: row.status,
      acknowledged: Array.isArray(row.findings) ? row.findings : [],
      surfaced: Array.isArray(row.surfaced) ? row.surfaced : [],
      raised: Array.isArray(row.raised) ? row.raised : [],
      asked: Array.isArray(row.asked) ? row.asked : [],
    }));
}

/**
 * The unit's review passes still in flight, bound to a land, in the order
 * they were dispatched: each with the digest of the land it reviews, and
 * its report on disk for a scan to take in, its agent running, or lost with
 * the process that dispatched it. A dispatch bound to none has had no
 * brief, its own among them while it is drawn, so no agent was sent on it.
 * Each says when it was dispatched.
 * @param {string} cwd @param {string} workUnit @returns {{id: string, created: string, digest: string, stands: 'landed'|'running'|'lost'}[]}
 */
function passesInFlight(cwd, workUnit) {
  const standing = inFlightStanding(cwd, workUnit);
  return specReviewRows(cwd, workUnit)
    .filter((row) => row.status === 'in-flight' && row.land !== undefined)
    .map((row) => ({ id: row.id, created: String(row.created), digest: row.land.digest, stands: standing(row) }));
}

/**
 * The refusals of the unit's spec reviews refused since the last one whose
 * report was taken in, each `{id}: {what does not read}`, in dispatch order.
 * @param {string} cwd @param {string} workUnit @returns {string[]}
 */
function refusedReports(cwd, workUnit) {
  const rows = specReviewRows(cwd, workUnit);
  const since = rows.reduce((last, row, at) => (takenIn(row) ? at : last), -1);
  return rows.slice(since + 1).flatMap((row) => (typeof row.refused === 'string' ? [`${row.id}: ${row.refused}`] : []));
}

module.exports = {
  AGENT_KINDS,
  UNIT_PHASE,
  AGENT_STATUSES,
  dispatchAgent,
  scanAgents,
  ackAgent,
  surfaceFinding,
  incorporateAgent,
  closeInFlight,
  abandonEarlierPasses,
  completedReviewCycles,
  reviewArming,
  agentDir,
  agentRows,
  agentsLeft,
  runningAgents,
  inFlightStandings,
  latestReview,
  gapReviewSince,
  takenInFor,
  dispatchedRows,
  bindQuestion,
  bindSpec,
  closeUnbriefed,
  reportedPasses,
  passesInFlight,
  refusedReports,
};
