'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the experiment series — the ordered run of experiments a
// topic's discussion ever spawned (`phases.experiment.items.{topic}
// .experiments.{id}`), each a frozen design plus a report on disk in the
// topic's folder, `{wu}/topics/{topic}/experiments/{id}-{slug}/`, in the
// state (4.11.15). The engine records the lifecycle; every document is
// model-authored — the engine never writes prose.
//
// The record lifecycle is the design-before-data invariant made mechanical:
// conceived → designed → approved (the briefing's freeze) → running →
// concluded (with its one-line verdict) | abandoned (with its reason, from
// any pre-terminal status). `advance` walks the mechanical steps; `approve`
// is deliberately its own verb — the user-confirmed freeze, never a step a
// loop drifts past. The spawn (`create`) is the phase's one door: it
// allocates the id, installs the spawning session's problem statement
// (moved from a cache scratch — the engine still never writes prose),
// records the question on the topic's map it measures, required — every
// experiment measures a point on the map (9.1.11; experiment-question.cjs),
// and locks the spawning discussion
// (`awaiting_experiments`); a split creates sub-experiments (`E{n}.{m}`)
// under a running parent, and the lock stays on the parent — it releases
// once, when the parent concludes or is abandoned. The release edge lives in
// transitions.
//
// The question an experiment measures stays open on the map, waiting on it,
// until the discussion writes the result (9.1.11). A report concluding after
// that question closed reaches the topic as a message, through `topic send`,
// which reopens a decided topic and commits its own delivery. A report owed
// past the unit's spec is refused before the conclusion writes anything, as
// is a spawn from a discussion past it (4.11.2).
//
// While it runs, `runs` records the tally of its runs from Claude's payload,
// each condition with the runs its design gives it, those done and their
// median, which the engine works out (20.13.1) — the whole tally each time,
// so a later call stands over an earlier one.
//
// The phase item is derived bookkeeping over the records: the spawn opens it
// (and reopens a completed series), the last record's terminal transition
// closes it — the user never starts or completes it by hand.
//
// A top-level record's end in the laboratory answers the way on: the next
// experiment's gate where the series still holds a live record, else the
// laboratory left through the unit's Continue; a split's carries the
// parent's run on, as does an end from anywhere else — the spawning
// conversation abandoning one no one will run, or the laboratory ending
// another record than the live one it works. Whose call it is is told by the
// conversation's position, the experiment its entry named among it, never by
// a flag.
//
// Judgment decides, code records. All errors throw loud and specific before
// anything is written; every load→mutate→save runs under the work unit's
// manifest lock. Every verb commits what it wrote with the record's folder,
// the documents Claude wrote there since — its design, its report and its
// data — and, as every state commit does, the logs changed beside them: the
// spawn the problem statement it installed with the manifest that names it,
// the spawning topic's log among the logs; each step the manifest with the
// record's folder; and `amend`, which writes nothing itself, the record's
// design alone — an amendment to a frozen design, or its strike, standing.
// Since a step commits the record's folder, it refuses first a frozen design
// changed since its commit: the freeze held, never a silent edit riding a
// step's commit. Until results are visible — a run of the tally done — the
// refusal names `amend`; from then the design is frozen for good, `amend`
// refuses too, and a flaw goes in the report's Corrections. A commit git
// refuses leaves the write saved, with the retry in its note.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { loadWorkUnitManifest, saveWorkUnitManifest, withWorkUnitLock, ensureContainer } = require('../kernel/manifest.cjs');
const {
  VALID_EXPERIMENT_STATUSES,
  EXPERIMENT_TERMINAL_STATUSES,
  EXPERIMENT_FROZEN_STATUSES,
  EXPERIMENT_ID_PATTERN,
  isParentExperimentId,
  EXPERIMENT_SPAWN_PHASES,
  isTopicPhase,
} = require('../kernel/manifest-schema.cjs');
const { settleItemStatus, mailboxDir } = require('./derivations.cjs');
const { releaseExperimentWaits, assertLegalTopicName } = require('./transitions.cjs');
const { sendMessage } = require('./mail.cjs');
const { pastItsSpec, assertBeforeSpec } = require('./spec-standing.cjs');
const { commitStateTail, noteCommitOutcome } = require('./commit.cjs');
const { measuredQuestion, reportRoute } = require('./experiment-question.cjs');
const { rebaseLinks } = require('./markdown-links.cjs');
const { recordDir } = require('./experiment-paths.cjs');
const { statePath, stateRoot, cacheScratch } = require('../kernel/state-root.cjs');
const { hasChangesInPaths, literally } = require('../kernel/git.cjs');
const { shaped, listed, readPayload } = require('./staged-payload.cjs');
const { todayStamp } = require('./dates.cjs');
const { seatIn } = require('./topic-leave.cjs');

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
 * @property {string} [question] the full ledger id of the question on the topic's map it measures
 * @property {string} [approved] the day the person approved its design, `YYYY-MM-DD`
 * @property {ConditionRuns[]} [runs]  the tally of its runs, by condition
 */

/**
 * A condition's runs as the record holds them: its name, the runs the
 * design gives it, those done, their median, null before the first, and
 * the unit they are measured in, where one is named.
 * @typedef {{condition: string, of: number, done: number, median: number|null, unit?: string}} ConditionRuns
 */

/**
 * The topic's experiment item, writable — a loud error when the topic holds
 * no series.
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
 * @property {string} [question]  the question the spawn measures, by its short id
 * @property {string|null} [committed]  the verb's commit — null where none landed
 * @property {string} [note]  a pending commit's retry
 * @property {import('./projections/surfaces.cjs').Next} [next]  the way on from a record's end
 * @property {import('./transitions.cjs').WaitRelease[]} [released_waits]
 * @property {ConditionRuns[]} [runs]  the tally `runs` recorded
 * @property {{topic: string, message_path: string, reopened: boolean, committed: string|null}} [report_sent]  the report sent as a message to the topic its question stands on now, the question no longer open on the spawning topic when it landed
 * @property {string[]} [warnings]
 */

/**
 * The spawn — the phase's one door. A top-level create (`from` names the
 * spawning phase) allocates `E{n}` (per-topic numbering — highest existing
 * plus one), records it `conceived`, installs the problem statement
 * (`problem` names a cache scratch file the spawning session wrote; the
 * create moves it in as `{dir}/problem.md`), opens the experiment item
 * (creating it, or setting a completed series back to in-progress — a new
 * spawn reopens the series), and locks the spawning item:
 * `awaiting_experiments` gains the id on the in-progress discussion the
 * question came from. `question`, required on a spawn, names by a prefix of
 * its ledger id the question open on the topic's map the experiment measures; the record keeps
 * its full id, and the map shows the question waiting on it. A split (`parent`
 * names a running experiment) allocates `E{n}.{m}` under it — no lock moves
 * (the wait stays on the parent and releases once, when the parent as a
 * whole ends), and no problem file or question: the sub-record's design
 * frames its question, and the parent measures the map's. The record's
 * directory is the response's `dir`, where the design is authored before
 * anything is measured. A spawn commits what it wrote (`committedSpawn`), as
 * a split does (`committedStep`).
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} topic
 * @param {{slug: string, from?: string, parent?: string, problem?: string, question?: string}} opts
 * @returns {ExperimentOpResult}
 */
function createExperiment(cwd, workUnit, topic, { slug, from, parent, problem, question }) {
  assertLegalTopicName(topic);
  if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`--slug must be kebab-case, got "${slug ?? ''}"`);
  }
  if ((from === undefined) === (parent === undefined)) {
    throw new Error(`exactly one of --from <${EXPERIMENT_SPAWN_PHASES.join('|')}> (a spawn) or --parent <E{n}> (a split) is required`);
  }
  if (from !== undefined && !(isTopicPhase(from) && EXPERIMENT_SPAWN_PHASES.includes(from))) {
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
    if (question !== undefined) {
      throw new Error('--question is refused with --parent — the parent measures the map\'s question; the sub-record\'s design frames its own');
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
    if (question === undefined) {
      throw new Error('--question <id> is required on a spawn — an experiment measures an open question on the topic\'s map, and its report reaches the topic through it');
    }
    scratchAbs = cacheScratch(cwd, problem, '--problem');
    try {
      problemBody = fs.readFileSync(scratchAbs, 'utf8');
    } catch {
      throw new Error(`problem file not found: ${problem}`);
    }
    if (problemBody.trim() === '') throw new Error(`problem file is empty: ${problem}`);
  }
  /** @type {string[]} */
  const warnings = [];
  const measured = question === undefined ? null : measuredQuestion(cwd, workUnit, topic, question, warnings);
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
      return { topic, id, slug, status: 'conceived', parent, dir: statePath(cwd, recordDir(workUnit, topic, id, experiments)) };
    }

    // The spawn is recorded mid-conversation, from the session that raised
    // the question — the spawning item must be open to hold the lock, and its
    // topic still before the spec (4.11.2).
    if (from === 'discussion') assertBeforeSpec(cwd, manifest, 'change');
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
    const item = ensureContainer(items, topic, `phases.experiment.items.${topic}`);
    item.status = 'in-progress';
    const experiments = ensureContainer(item, 'experiments', `phases.experiment.items.${topic}.experiments`);
    const n = Object.keys(experiments)
      .map((id) => (/^E([1-9][0-9]*)$/.exec(id) || [])[1])
      .filter(Boolean)
      .reduce((max, digits) => Math.max(max, Number(digits)), 0) + 1;
    const id = `E${n}`;
    experiments[id] = { slug, status: 'conceived', ...(measured === null ? {} : { question: measured.id }) };
    const awaiting = Array.isArray(spawner.awaiting_experiments) ? spawner.awaiting_experiments : [];
    spawner.awaiting_experiments = [...awaiting, id];
    const dir = statePath(cwd, recordDir(workUnit, topic, id, experiments));
    // The problem file lands before the manifest names the record — a crash
    // between the two writes must never leave a conceived record with no
    // problem statement.
    fs.mkdirSync(dir, { recursive: true });
    const body = /** @type {string} */ (problemBody);
    fs.writeFileSync(path.join(dir, 'problem.md'), body.endsWith('\n') ? body : body + '\n');
    saveWorkUnitManifest(cwd, workUnit, manifest);
    return {
      topic, id, slug, status: 'conceived',
      dir,
      awaiting: { phase: /** @type {string} */ (from), ids: spawner.awaiting_experiments },
      ...(measured === null ? {} : { question: measured.short }),
    };
  });
  if (scratchAbs !== null) {
    try { fs.unlinkSync(scratchAbs); } catch { /* scratch already gone */ }
  }
  return from === undefined
    ? committedStep(cwd, workUnit, result, `split ${result.id} ${slug} from ${parent}`, warnings)
    : committed(cwd, [`${workUnit}/manifest.json`, path.join(result.dir, 'problem.md')], `experiment(${workUnit}/${topic}): spawn ${result.id} ${slug}`,
      result, `${workUnit} --topic experiment/${topic} --sweep`, warnings);
}

/**
 * `paths` committed under `message`, any log changed beside them riding
 * along, the outcome stamped on `result` with the warnings raised: a commit
 * git refuses leaves the write saved, with the retry, `retry`, in its note.
 * The spawn's retry marks the topic as one its conversation is not working.
 * @param {string} cwd @param {string[]} paths @param {string} message @param {ExperimentOpResult} result @param {string} retry @param {string[]} warnings
 * @returns {ExperimentOpResult}
 */
function committed(cwd, paths, message, result, retry, warnings) {
  const outcome = commitStateTail(cwd, paths, message, warnings);
  /** @type {ExperimentOpResult & Record<string, unknown>} */
  const answer = { ...result, committed: outcome.committed };
  noteCommitOutcome(answer, outcome, retry);
  return warnings.length > 0 ? { ...answer, warnings } : answer;
}

/**
 * A laboratory step's commit: the manifest and the record's folder, under
 * `what` the step did.
 * @param {string} cwd @param {string} workUnit @param {ExperimentOpResult} result @param {string} what @param {string[]} [warnings]
 * @returns {ExperimentOpResult}
 */
function committedStep(cwd, workUnit, result, what, warnings = []) {
  const { topic, dir } = result;
  return committed(cwd, [`${workUnit}/manifest.json`, dir], `experiment(${workUnit}/${topic}): ${what}`, result, `${workUnit} --topic experiment/${topic}`, warnings);
}

/**
 * Refuses a step over a frozen design changed since it was committed: from
 * its approval a design changes only by a recorded amendment, `amend`'s
 * (4.11.15), never folded silently into a step's commit. Held for each
 * record the step's commit takes, the record's own and its splits', which
 * nest in its folder.
 * @param {string} cwd @param {string} workUnit @param {string} topic @param {string} id
 * @param {Record<string, ExperimentRecord>} experiments
 */
function assertFrozenDesigns(cwd, workUnit, topic, id, experiments) {
  const changed = Object.keys(experiments)
    .filter((other) => (other === id || other.startsWith(`${id}.`)) && EXPERIMENT_FROZEN_STATUSES.includes(experiments[other].status))
    .find((other) => hasChangesInPaths(stateRoot(cwd), literally([designOf(workUnit, topic, other, experiments)])));
  if (changed === undefined) return;
  throw new Error(resultsVisible(experiments[changed])
    ? `experiment ${changed} ("${topic}")'s design changed after its results were visible — ${FROZEN_FOR_GOOD}`
    : `experiment ${changed} ("${topic}")'s design changed after its approval — record the change with experiment amend ${workUnit} ${topic} ${changed} first, or put the design back`);
}

/** What a design frozen for good allows. */
const FROZEN_FOR_GOOD = 'the design is frozen for good: put it back, and record a flaw in the report\'s ## Corrections';

/** Whether a record's results are visible: a run of its tally done. @param {ExperimentRecord} record */
const resultsVisible = (record) => (record.runs ?? []).some(({ done }) => done > 0);

/**
 * A record's design, from the state root.
 * @param {string} workUnit @param {string} topic @param {string} id @param {Record<string, ExperimentRecord>} experiments
 */
const designOf = (workUnit, topic, id, experiments) => path.join(recordDir(workUnit, topic, id, experiments), 'design.md');

/**
 * One shared status write: load, guard, step, save, answer. The transition
 * itself is the caller's closure over the loaded record; a frozen design
 * changed since its commit refuses it first (`assertFrozenDesigns`).
 * @param {string} cwd @param {string} workUnit @param {string} topic @param {string} id
 * @param {(record: ExperimentRecord, item: {experiments?: Record<string, ExperimentRecord>}, manifest: object) => Partial<ExperimentOpResult>} step
 * @returns {ExperimentOpResult}
 */
function recordTransition(cwd, workUnit, topic, id, step) {
  return withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const item = experimentItem(manifest, topic);
    const record = seriesRecord(item, topic, id);
    assertFrozenDesigns(cwd, workUnit, topic, id, /** @type {Record<string, ExperimentRecord>} */ (item.experiments));
    const extra = step(record, item, manifest);
    saveWorkUnitManifest(cwd, workUnit, manifest);
    return {
      topic, id, slug: record.slug, status: /** @type {string} */ (record.status),
      dir: statePath(cwd, recordDir(workUnit, topic, id, /** @type {Record<string, ExperimentRecord>} */ (item.experiments))),
      ...extra,
    };
  });
}

/**
 * Advance an experiment one mechanical step: conceived → designed (the design
 * is written), approved → running (measurement begins), committed. The
 * freeze between them is `approve`; past `running` the exits are conclude
 * and abandon.
 * @param {string} cwd project root
 * @param {string} workUnit @param {string} topic @param {string} id
 * @returns {ExperimentOpResult}
 */
function advanceExperiment(cwd, workUnit, topic, id) {
  const advanced = recordTransition(cwd, workUnit, topic, id, (record) => {
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
  return committedStep(cwd, workUnit, advanced, `${id} ${advanced.status}`);
}

/**
 * Record the briefing gate's freeze: designed → approved, the day of it held
 * on the record, and nothing else — the one transition that requires the
 * user's confirm, so it is never a step `advance` can drift past — committed
 * with the design it froze. From `approved` the design changes only by a
 * recorded amendment (`amend`); flaws found after results are visible go in
 * the report's corrections and trigger the next experiment.
 * @param {string} cwd project root
 * @param {string} workUnit @param {string} topic @param {string} id
 * @returns {ExperimentOpResult}
 */
function approveExperiment(cwd, workUnit, topic, id) {
  const approved = recordTransition(cwd, workUnit, topic, id, (record) => {
    if (record.status !== 'designed') {
      assertNotTerminal(record, topic, id);
      throw new Error(`experiment ${id} ("${topic}") is ${record.status} — only a designed experiment takes the approval freeze`);
    }
    record.status = 'approved';
    record.approved = todayStamp();
    return { previous: 'designed' };
  });
  return committedStep(cwd, workUnit, approved, `${id} approved — design frozen`);
}

/**
 * Record an amendment to a frozen design, or its strike, as standing: the
 * record's design committed, the amendment dated beneath what was approved.
 * Refused, writing nothing, for a design not yet frozen, which changes
 * freely until its approval; for one frozen for good, its results visible;
 * and for an experiment ended. `struck` names the commit a strike's.
 * @param {string} cwd project root
 * @param {string} workUnit @param {string} topic @param {string} id @param {{struck?: boolean}} [opts]
 * @returns {ExperimentOpResult}
 */
function amendExperiment(cwd, workUnit, topic, id, { struck = false } = {}) {
  const manifest = loadWorkUnitManifest(cwd, workUnit);
  const item = experimentItem(manifest, topic);
  const record = seriesRecord(item, topic, id);
  assertNotTerminal(record, topic, id);
  if (!EXPERIMENT_FROZEN_STATUSES.includes(record.status)) {
    throw new Error(`experiment ${id} ("${topic}") is ${record.status} — its design changes freely until the approval freezes it; an amendment is to a frozen design`);
  }
  if (resultsVisible(record)) throw new Error(`experiment ${id} ("${topic}") has results visible — ${FROZEN_FOR_GOOD}`);
  const experiments = /** @type {Record<string, ExperimentRecord>} */ (item.experiments);
  /** @type {ExperimentOpResult} */
  const result = { topic, id, slug: record.slug, status: record.status, dir: statePath(cwd, recordDir(workUnit, topic, id, experiments)) };
  return committed(cwd, [statePath(cwd, designOf(workUnit, topic, id, experiments))], `experiment(${workUnit}/${topic}): ${id} ${struck ? 'amendment struck' : 'design amended'}`, result, `${workUnit} --topic experiment/${topic}`, []);
}

/**
 * The report a top-level conclusion owes as a message: its record's folder
 * and the topic it goes to. Owed where the running record measures a
 * question that no longer stands open on the spawning topic's map — the
 * person closed or moved it while the experiment ran — to the topic the
 * question stands on now (`reportRoute`). Null where none is owed; refused
 * where one is owed and the record holds no report to send, or the unit is
 * past its spec, where no topic takes a message (4.11.2) — each before the
 * conclusion writes anything, so no report is lost.
 * @param {string} cwd @param {string} workUnit @param {string} topic @param {string} id @param {string[]} warnings
 * @returns {{record: string, to: string}|null}
 */
function reportOwed(cwd, workUnit, topic, id, warnings) {
  if (!isParentExperimentId(id)) return null;
  const item = experimentItem(loadWorkUnitManifest(cwd, workUnit), topic);
  const record = seriesRecord(item, topic, id);
  if (record.status !== 'running' || record.question === undefined) return null;
  const to = reportRoute(cwd, workUnit, topic, record.question, warnings);
  if (to === null) return null;
  if (pastItsSpec(cwd, loadWorkUnitManifest(cwd, workUnit))) {
    throw new Error(`experiment ${id} ("${topic}") owes its report to "${to}" as a message, and ${workUnit} has its spec — a topic exists only before it: abandon the experiment, and settle what it found in the spec`);
  }
  const dir = recordDir(workUnit, topic, id, /** @type {Record<string, ExperimentRecord>} */ (item.experiments));
  if (!fs.existsSync(statePath(cwd, `${dir}/report.md`))) {
    throw new Error(`experiment ${id} ("${topic}") has no report.md — its question left the topic's open questions while it ran, so the report reaches "${to}" as a message; write the report first`);
  }
  return { record: dir, to };
}

/**
 * Send the report to the topic it is owed to as a message is sent (9.1.11,
 * 10.2.7), through `topic send`, from the experiment — `E{n}` where the
 * topic is its own, `{topic}/E{n}` where the person moved its question to
 * another: copied to a cache scratch, which the send consumes, each
 * relative link rebased to resolve from the topic's mailbox, and delivered
 * there — a decided topic reopened, the delivery committed.
 * @param {string} cwd @param {string} workUnit @param {string} topic @param {string} id @param {{record: string, to: string}} owed
 * @returns {NonNullable<ExperimentOpResult['report_sent']>}
 */
function sendReport(cwd, workUnit, topic, id, { record, to }) {
  const scratch = statePath(cwd, `.cache/${workUnit}/experiment/${topic}/${id}-report.md`);
  fs.mkdirSync(path.dirname(scratch), { recursive: true });
  const report = fs.readFileSync(statePath(cwd, `${record}/report.md`), 'utf8');
  fs.writeFileSync(scratch, rebaseLinks(report, record, mailboxDir(workUnit, to)));
  const sent = /** @type {{message_path: string, reopened?: true, committed: string|null}} */ (sendMessage(cwd, workUnit, to, {
    from: to === topic ? id : `${topic}/${id}`,
    contentFile: scratch,
    slug: `${id.toLowerCase()}-report`,
  }));
  return { topic: to, message_path: sent.message_path, reopened: sent.reopened === true, committed: sent.committed };
}

/**
 * Conclude a running experiment with its one-line verdict — the decision
 * rule's mechanical outcome, recorded on the register row. A parent whose
 * sub-experiments are still live refuses: its verdict synthesises them. A
 * top-level conclusion releases the spawning item's evidence wait on this
 * id; a sub-experiment's conclusion releases nothing — the parent's carries
 * them. The item's derived
 * status settles after every terminal transition, and the end answers its
 * way on (`afterEnd`). Committed with its report; where the question the
 * experiment measures left the open questions of the spawning topic while
 * it ran, the report then reaches as a message the topic the question
 * stands on now (`reportOwed`, `sendReport`).
 * @param {string} cwd project root
 * @param {string} workUnit @param {string} topic @param {string} id
 * @param {{verdict: string}} opts
 * @returns {ExperimentOpResult}
 */
function concludeExperiment(cwd, workUnit, topic, id, { verdict }) {
  assertOneLine('--verdict', verdict);
  /** @type {string[]} */
  const warnings = [];
  const report = reportOwed(cwd, workUnit, topic, id, warnings);
  const concluded = recordTransition(cwd, workUnit, topic, id, (record, item, manifest) => {
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
    return { verdict: record.verdict, ...ended(workUnit, topic, id, item, manifest) };
  });
  const result = committedStep(cwd, workUnit, concluded, `${id} concluded`, warnings);
  return report === null ? result : { ...result, report_sent: sendReport(cwd, workUnit, topic, id, report) };
}

/**
 * What a record's end writes beside its own row, and answers: a top-level
 * end releases the spawning item's wait on it; the series' item settles;
 * and its way on (`afterEnd`).
 * @param {string} workUnit @param {string} topic @param {string} id
 * @param {{experiments?: Record<string, ExperimentRecord>}} item @param {object} manifest
 * @returns {Partial<ExperimentOpResult>}
 */
function ended(workUnit, topic, id, item, manifest) {
  const released = isParentExperimentId(id) ? releaseExperimentWaits(manifest, topic, { ids: [id] }) : [];
  return {
    ...(released.length > 0 ? { released_waits: released } : {}),
    item_status: settleItemStatus(item),
    next: afterEnd(workUnit, topic, id, item),
  };
}

/**
 * Whether a record's end is the laboratory's own: the calling conversation
 * sits in the laboratory at the topic working this record, one ended
 * already, or none named. A laboratory working another live record ends
 * this one as any other caller does.
 * @param {string} workUnit @param {string} topic @param {string} id
 * @param {Record<string, ExperimentRecord>} experiments
 */
function endedInTheLab(workUnit, topic, id, experiments) {
  const seat = seatIn(workUnit, topic);
  if (seat === null || seat.phase !== 'experiment') return false;
  const worked = seat.record === undefined || seat.record === id ? undefined : experiments[seat.record];
  return worked === undefined || EXPERIMENT_TERMINAL_STATUSES.includes(worked.status);
}

/**
 * The way on once a record ended, the laboratory's alone (`endedInTheLab`):
 * a split's carries its parent's run on; a top-level record's leads to the
 * next experiment's gate where the series still holds a live one, else out
 * of the laboratory through the unit's Continue. Ended by anyone else, the
 * calling flow carries on.
 * @param {string} workUnit @param {string} topic @param {string} id
 * @param {{experiments?: Record<string, ExperimentRecord>}} item
 * @returns {import('./projections/surfaces.cjs').Next}
 */
function afterEnd(workUnit, topic, id, item) {
  if (!isParentExperimentId(id) || !endedInTheLab(workUnit, topic, id, item.experiments || {})) return { kind: 'continue' };
  const live = Object.entries(item.experiments || {})
    .some(([other, r]) => isParentExperimentId(other) && !EXPERIMENT_TERMINAL_STATUSES.includes(/** @type {string} */ (r.status)));
  return live
    ? { kind: 'engine', argv: ['render', 'experiment-next-gate', `${workUnit}.experiment.${topic}`] }
    : { kind: 'engine', argv: ['handoff', 'unit', workUnit] };
}

/**
 * Abandon an experiment from any pre-terminal status, with its one-line
 * reason — a first-class terminal: the register keeps the row. A parent with
 * live sub-experiments refuses — each ends on its own row first. A top-level
 * abandonment releases the spawning item's evidence wait on this id, and
 * the question it measured stands open again. The item's derived status
 * settles after every terminal transition, the end answers its way on
 * (`afterEnd`), and the record's folder is committed with it.
 * @param {string} cwd project root
 * @param {string} workUnit @param {string} topic @param {string} id
 * @param {{reason: string}} opts
 * @returns {ExperimentOpResult}
 */
function abandonExperiment(cwd, workUnit, topic, id, { reason }) {
  assertOneLine('--reason', reason);
  const abandoned = recordTransition(cwd, workUnit, topic, id, (record, item, manifest) => {
    assertNotTerminal(record, topic, id);
    if (isParentExperimentId(id)) {
      const open = liveSubs(item, id).map(([subId, r]) => `${subId}: ${r.status}`);
      if (open.length > 0) {
        throw new Error(`experiment ${id} ("${topic}") has live sub-experiments (${open.join(', ')}) — conclude or abandon each before abandoning the parent`);
      }
    }
    record.status = 'abandoned';
    record.reason = reason.trim();
    return { reason: record.reason, ...ended(workUnit, topic, id, item, manifest) };
  });
  return committedStep(cwd, workUnit, abandoned, `${id} abandoned`);
}

/** The median of measured values, null for none, to twelve significant figures. @param {number[]} values */
function medianOf(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Number(median.toPrecision(12));
}

/**
 * A condition of Claude's tally checked and recorded: refused where its
 * name is not one line, its runs are not a whole number above nought, a
 * value is no finite number, or more are done than it has runs.
 * @param {unknown} given @param {number} at its place in the tally, from 1 @returns {ConditionRuns}
 */
function conditionRuns(given, at) {
  const what = `condition ${at}`;
  const { condition, of, values, unit } = shaped(given, what, ['condition', 'of', 'values'], ['unit']);
  assertOneLine(`${what}'s condition`, /** @type {string|undefined} */ (condition));
  if (!Number.isInteger(of) || /** @type {number} */ (of) < 1) throw new Error(`${what}'s of is the runs its design gives it, a whole number above nought`);
  const measured = listed(values, `${what}'s values`);
  if (!measured.every((value) => typeof value === 'number' && Number.isFinite(value))) throw new Error(`${what}'s values are the runs measured, each a number`);
  if (measured.length > /** @type {number} */ (of)) throw new Error(`${what} has ${measured.length} runs measured of the ${of} its design gives it`);
  if (unit !== undefined) assertOneLine(`${what}'s unit`, /** @type {string|undefined} */ (unit));
  return {
    condition: /** @type {string} */ (condition).trim(),
    of: /** @type {number} */ (of),
    done: measured.length,
    median: medianOf(/** @type {number[]} */ (measured)),
    ...(unit === undefined ? {} : { unit: /** @type {string} */ (unit).trim() }),
  };
}

/**
 * Record a running experiment's runs: Claude's tally at `file`, a cache
 * scratch, `[{"condition", "of", "values", "unit"?}]` — each condition's
 * name, the runs its design gives it, the values measured so far and the
 * unit they are in — kept on the record with the runs done and their
 * median in place of the values, the whole tally standing over any
 * before. Refused before anything is written for a tally that is no list,
 * empty, names a condition twice or holds a condition that does not check
 * (`conditionRuns`), and for an experiment not running. Committed with the
 * record's folder: the report and the data the runs wrote.
 * @param {string} cwd project root
 * @param {string} workUnit @param {string} topic @param {string} id
 * @param {{file: string}} opts
 * @returns {ExperimentOpResult}
 */
function recordRuns(cwd, workUnit, topic, id, { file }) {
  const tally = listed(readPayload(cwd, cacheScratch(cwd, file, '--file')), 'the tally').map((given, at) => conditionRuns(given, at + 1));
  if (tally.length === 0) throw new Error('the tally names no condition — it holds each condition the design runs');
  const twice = tally.find(({ condition }, at) => tally.findIndex((held) => held.condition === condition) !== at);
  if (twice !== undefined) throw new Error(`the tally names the condition "${twice.condition}" twice`);
  const recorded = recordTransition(cwd, workUnit, topic, id, (record) => {
    assertNotTerminal(record, topic, id);
    if (record.status !== 'running') {
      throw new Error(`experiment ${id} ("${topic}") is ${record.status} — runs are recorded while it runs`);
    }
    record.runs = tally;
    return { runs: tally };
  });
  return committedStep(cwd, workUnit, recorded, `${id} runs recorded`);
}

module.exports = { createExperiment, advanceExperiment, approveExperiment, amendExperiment, recordRuns, concludeExperiment, abandonExperiment };
