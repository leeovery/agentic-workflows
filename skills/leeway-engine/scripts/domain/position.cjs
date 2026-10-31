'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the conversation's position — where in the workflows a
// conversation is working, kept as `position.json` in its folder
// (conversation.cjs) for whatever carries the conversation on: the tmux
// label's resume (session-label.cjs), the gate mod's spinner, and
// `conversation position`, the note the gate mod appends to a compaction,
// naming what to re-read to carry on there.
//
// Every place records itself on arrival, through the calls that label it,
// labels on or off: a phase's entry (`enter`, or `session label {wu}
// {phase} {topic}` inside a phase not yet entered through it),
// `session label {wu}` at a work unit's menu, `session label
// roadmap|baseline|product` at the project-level places — a place this project lacks is refused before
// anything is labelled or recorded. Inside implementation, `task start` adds
// the task in flight and that task's `task complete` takes it off; the
// tracker's `task start` does the same with the unit as the topic, its
// `task done` and `task close` taking it off (task-verbs.cjs); a
// re-label of the same implementation keeps it, and any other place leaves
// none. The gate mod's `conversation executor` adds the agent id of the
// executor it saw dispatched, only while a task is in flight: it rides with
// that task — a re-label of the same implementation and a `task start` re-run
// for the same task keep it — and goes with it. The start menu is no
// position: boot drops the calling conversation's own before anything else it
// does, and `session repair` drops it too.
//
// The engine is the file's one writer, and writes only for a conversation
// that runs the workflows: recording a position marks the conversation first
// (conversation.cjs — a session id, a call run in a workflows project), since
// a conversation a handoff began can arrive at its first place before any
// other engine call has marked it; an executor is recorded only on a position
// already there. A position that cannot be written costs the verb nothing.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { PRODUCT, PROJECT_IDENTITIES, TERMINAL_STATUSES, VALID_PHASES, illegalNameReason } = require('../kernel/manifest-schema.cjs');
const { isObject, writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { positionPath, isMarked, markConversation, runningTranscript } = require('./conversation.cjs');
const { loadManifest, loadProjectManifest } = require('./reads.cjs');
const { computeTopicLifecycle, itemOf, openRecords, phaseData, UNIT_PHASES } = require('./derivations.cjs');
const { recordDir } = require('./experiment-paths.cjs');
const { latestSessionLog, productSession } = require('./discovery-session.cjs');
const { PRODUCT_SESSIONS } = require('./layout.cjs');
const { phaseSkill } = require('./handoff.cjs');
const { stepOfId, shownTask } = require('./task-id.cjs');
const { INDEXED_ARTIFACTS } = require('./knowledge/artifacts.cjs');
const { section, dataSection, GATE_MOD_INSTRUCTION } = require('./projections/surfaces.cjs');
const { statePath } = require('../kernel/state-root.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { topicLog, recordCall, mapCall, owedHeader, namedConversations } = require('./topic-log.cjs');

const COMPACTED = 'The conversation was just compacted.';

const PLACE_SEPARATOR = ' › ';

// The phases under a topic on an epic's discovery map — the Discovery unit's,
// its experiment series riding along: a cancel or a postpone of the topic is
// recorded on its map row, whatever each item reads.
const MAP_PHASES = [...UNIT_PHASES.discovery, 'experiment'];

const ROADMAP = 'roadmap';

/**
 * @typedef {object} Position
 * @property {string} name   a work unit, or a project identity
 * @property {string} [phase]
 * @property {string} [topic]
 * @property {string} [task] the implementation task in flight, `{phase}.{task}`
 * @property {string} [executor] the agent id of the task's executor
 */

/** @typedef {Record<string, unknown>|null} Manifest  a work unit's manifest; null where the project has none */

/** Whether a place is a project-level one, named by its identity alone. @param {string} name @param {string} [phase] */
function isProjectPlace(name, phase) {
  return phase === undefined && PROJECT_IDENTITIES.includes(name);
}

/** Whether a value reads as an agent id. @param {unknown} value @returns {value is string} */
function isAgentId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value);
}

/**
 * The position recorded for the conversation `sessionId`; null where none
 * is, or it does not read as one.
 * @param {string} sessionId @returns {Position|null}
 */
function readPosition(sessionId) {
  try {
    const parsed = JSON.parse(fs.readFileSync(positionPath(sessionId), 'utf8'));
    if (isObject(parsed) && typeof parsed.name === 'string') {
      const { executor, ...rest } = parsed;
      return /** @type {Position} */ (isAgentId(executor) ? parsed : rest);
    }
  } catch { /* none recorded, or unreadable */ }
  return null;
}

/** The calling conversation where the engine has marked it, else null. @returns {string|null} */
function ownConversation() {
  const sessionId = handedSession();
  return sessionId !== null && isMarked(sessionId) ? sessionId : null;
}

/**
 * The calling conversation, marked first: arriving at a place is running the
 * workflows. Null where no mark stands — no session id, a call run outside a
 * workflows project, a mark that could not be written.
 * @param {string} cwd @returns {string|null}
 */
function arrivingConversation(cwd) {
  markConversation(cwd);
  return ownConversation();
}

/** Whether the position was written. @param {string} sessionId @param {Position} position @returns {boolean} */
function writePosition(sessionId, position) {
  try {
    writeJsonAtomic(positionPath(sessionId), position);
    return true;
  } catch {
    return false;
  }
}

/**
 * Why the arguments name no place this project has, or null where they do:
 * a work unit, a phase and legal topic in one, or a project identity, which
 * has no phase.
 * @param {string} cwd @param {string} name @param {string} [phase] @param {string} [topic]
 * @returns {string|null}
 */
function placeError(cwd, name, phase, topic) {
  if (isProjectPlace(name, phase)) return null;
  if (phase !== undefined && !VALID_PHASES.includes(phase)) return `unknown phase "${phase}" — one of ${VALID_PHASES.join('|')}`;
  const illegal = (phase === undefined ? null : illegalNameReason('topic', topic)) ?? illegalNameReason('work unit', name);
  if (illegal !== null) return illegal;
  return fs.existsSync(statePath(cwd, name)) ? null : `no work unit directory: ${statePath(cwd, name)}`;
}

/**
 * Refuses arguments that name no place this project has — before anything
 * is labelled or recorded, whatever the opt-in: an authoring bug.
 * @param {string} cwd @param {string} name @param {string} [phase] @param {string} [topic]
 */
function assertPlace(cwd, name, phase, topic) {
  const error = placeError(cwd, name, phase, topic);
  if (error !== null) throw new Error(error);
}

/** @param {string} cwd @param {string} name @param {string} [phase] @param {string} [topic] */
function isPlace(cwd, name, phase, topic) {
  return placeError(cwd, name, phase, topic) === null;
}

/** @param {Position|null} a @param {Position} b */
function samePlace(a, b) {
  return a !== null && a.name === b.name && a.phase === b.phase && a.topic === b.topic;
}

/** The plan step an internal id ends in, `{phase}.{task}`. @param {string} internalId @returns {string|null} */
function taskStep(internalId) {
  const step = stepOfId(internalId);
  return step === null ? null : shownTask(step);
}

/**
 * Record the calling conversation's arrival at a place `assertPlace` passed.
 * @param {string} cwd @param {string} name @param {string} [phase] @param {string} [topic]
 */
function recordPosition(cwd, name, phase, topic) {
  const own = arrivingConversation(cwd);
  if (!own) return;
  /** @type {Position} */
  const position = phase === undefined ? { name } : { name, phase, topic };
  const prior = readPosition(own);
  if (phase === 'implementation' && samePlace(prior, position) && prior?.task) {
    position.task = prior.task;
    if (prior.executor !== undefined) position.executor = prior.executor;
  }
  writePosition(own, position);
}

/**
 * Record the task `task start` put in flight.
 * @param {string} cwd @param {string} workUnit @param {string} topic @param {string} internalId
 */
function recordTask(cwd, workUnit, topic, internalId) {
  const own = arrivingConversation(cwd);
  const step = taskStep(internalId);
  if (!own || step === null || !isPlace(cwd, workUnit, 'implementation', topic)) return;
  /** @type {Position} */
  const position = { name: workUnit, phase: 'implementation', topic, task: step };
  const prior = readPosition(own);
  if (samePlace(prior, position) && prior?.task === step && prior.executor !== undefined) position.executor = prior.executor;
  writePosition(own, position);
}

/**
 * Record the executor dispatched for the conversation `sessionId`'s task in
 * flight — only where its position holds one.
 * @param {string} sessionId @param {string} agentId @returns {{recorded: boolean}}
 */
function recordExecutor(sessionId, agentId) {
  const position = readPosition(sessionId);
  if (position?.phase !== 'implementation' || !position.task) return { recorded: false };
  return { recorded: writePosition(sessionId, { ...position, executor: agentId }) };
}

/**
 * Take a completed task off the position, its executor with it — only the
 * one it names, in that topic's implementation.
 * @param {string} workUnit @param {string} topic @param {string} internalId
 */
function clearTask(workUnit, topic, internalId) {
  const own = ownConversation();
  if (!own) return;
  /** @type {Position} */
  const place = { name: workUnit, phase: 'implementation', topic };
  const prior = readPosition(own);
  if (!samePlace(prior, place) || prior?.task !== taskStep(internalId)) return;
  writePosition(own, place);
}

/** @param {string|null|undefined} sessionId */
function dropPosition(sessionId) {
  if (!sessionId) return;
  try { fs.unlinkSync(positionPath(sessionId)); } catch { /* none recorded */ }
}

// ---------------------------------------------------------------------------
// What a conversation re-reads to carry on from its position: the skill that
// runs the work there, then the topic's documents. A work unit's menu carries
// nothing on, so it names neither; nor does a place this project no longer
// has open — the work unit gone or closed, the item closed, a topic on the
// map cancelled or postponed — nor one whose skill this project lacks. A
// phase whose skill carries no recovery section of its own has the note
// carry it whole (24.2.6), naming the engine calls it re-reads beside its
// documents and the log its conversation keeps, which is caught up from the
// conversation's transcript (8.14.9): discussion's names the topic's record
// and its log (24.2.1–24.2.3); discovery's, at an epic, the unit's map and
// the open log, and at the product's conversation its open log (24.2.8,
// 8.14.6) — the latest on disk where none is open. Every other phase's note
// sends Claude to its skill's own steps.
// ---------------------------------------------------------------------------

/**
 * The skill that runs the work at a place — a phase's own, discovery's,
 * which the product's conversation is too, or a project place's; null at a
 * work unit's menu.
 * @param {string} name @param {string} [phase] @returns {string|null}
 */
function skillAt(name, phase) {
  if (phase === undefined) {
    if (!PROJECT_IDENTITIES.includes(name)) return null;
    return name === PRODUCT ? 'leeway-discovery' : `leeway-${name}`;
  }
  return phase === 'discovery' ? 'leeway-discovery' : phaseSkill(phase);
}

/** @param {string} skill */
const skillFile = (skill) => `.claude/skills/${skill}/SKILL.md`;

/**
 * The session log a place's session writes: the open one the marker names,
 * else the latest on disk.
 * @param {string} dir absolute @param {unknown} active
 * @returns {string[]}
 */
function sessionLog(dir, active) {
  if (typeof active === 'string' && /^\d+$/.test(active)) return [path.join(dir, `session-${active}.md`)];
  const latest = latestSessionLog(dir);
  return latest === null ? [] : [path.join(dir, latest.file)];
}

/** The plan's phase task files, in phase order. @param {string} dir absolute @returns {string[]} */
function phaseTaskFiles(dir) {
  /** @type {string[]} */
  let names = [];
  try { names = fs.readdirSync(dir).filter((f) => /^phase-\d+-tasks\.md$/.test(f)); } catch { return []; }
  return names.sort((a, b) => parseInt(a.slice(6), 10) - parseInt(b.slice(6), 10)).map((f) => path.join(dir, f));
}

/**
 * The file named for the task in the plan's directory or a folder in it —
 * where a plan format that keeps its tasks as files keeps them.
 * @param {string} dir absolute @param {string} internalId
 * @returns {string[]}
 */
function taskFile(dir, internalId) {
  const name = `${internalId}.md`;
  /** @type {string[]} */
  const found = [];
  /** @param {string} at @param {boolean} descend */
  const walk = (at, descend) => {
    let entries;
    try { entries = fs.readdirSync(at, { withFileTypes: true }); } catch { return; }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isFile() && entry.name === name) found.push(path.join(at, name));
      else if (entry.isDirectory() && descend) walk(path.join(at, entry.name), false);
    }
  };
  walk(dir, true);
  return found;
}

/** @param {Position} position @returns {string|null} */
function internalIdOf(position) {
  return position.task && position.topic ? `${position.topic}-${position.task.replace('.', '-')}` : null;
}

/**
 * Each live experiment record's files, in register order; none from a
 * series whose records do not resolve to their directories.
 * @param {string} cwd @param {string} workUnit @param {string} topic @param {Record<string, unknown>} manifest
 * @returns {string[]}
 */
function experimentFiles(cwd, workUnit, topic, manifest) {
  const experiments = itemOf(manifest, 'experiment', topic)?.experiments;
  try {
    return openRecords(manifest, topic).flatMap((id) => {
      const dir = statePath(cwd, recordDir(workUnit, topic, id, experiments));
      return ['problem.md', 'design.md', 'report.md'].map((f) => path.join(dir, f));
    });
  } catch {
    return [];
  }
}

/**
 * The product's session the project manifest marks open, or null.
 * @param {string} cwd @returns {string|null}
 */
function productActive(cwd) {
  const project = loadProjectManifest(cwd);
  return isObject(project) ? productSession(project) : null;
}

/**
 * The log of the product's open session; none where no session is open.
 * @param {string} cwd @returns {string[]}
 */
function productSessionLog(cwd) {
  const active = productActive(cwd);
  return active === null ? [] : sessionLog(statePath(cwd, PRODUCT_SESSIONS), active);
}

/**
 * What carries the work on at a position: the skill that runs it, and the
 * topic's documents, whether or not they exist — neither at a work unit's
 * menu; and, for a phase whose note carries its recovery whole, the engine
 * calls it re-reads and the log its conversation keeps, where it keeps one.
 * @typedef {{skill: string|null, documents: string[], whole?: {calls: string[], log: string|null}}} Work
 */

/**
 * A discovery home's note, carried whole: its calls, and its log — the open
 * one, else the latest on disk — read and caught up.
 * @param {string} skill @param {string[]} calls @param {string[]} log
 * @returns {Work}
 */
function discoveryWork(skill, calls, log) {
  return { skill, documents: log, whole: { calls, log: log[0] ?? null } };
}

/**
 * @param {string} cwd @param {Position} position @param {Manifest} manifest
 * @returns {Work}
 */
function workAt(cwd, position, manifest) {
  const { name, phase } = position;
  const skill = skillAt(name, phase);
  if (skill === null) return { skill: null, documents: [] };
  if (phase === undefined) {
    if (name === PRODUCT) return discoveryWork(skill, [], sessionLog(statePath(cwd, PRODUCT_SESSIONS), productActive(cwd)));
    return { skill, documents: name === ROADMAP ? productSessionLog(cwd) : [] };
  }
  if (manifest === null) return { skill: null, documents: [] };
  const wu = statePath(cwd, name);
  const topic = /** @type {string} */ (position.topic);
  const plan = path.join(wu, 'planning', topic);
  switch (phase) {
    case 'discovery':
      return discoveryWork(skill, [mapCall(name)], sessionLog(path.join(wu, 'discovery'), phaseData(manifest, 'discovery').active_session));
    case 'discussion': {
      const log = statePath(cwd, topicLog(name, topic));
      return { skill, documents: [log], whole: { calls: [recordCall(name, topic)], log } };
    }
    case 'investigation':
    case 'specification':
      return { skill, documents: [statePath(cwd, INDEXED_ARTIFACTS[phase](name, topic))] };
    case 'experiment':
      return { skill, documents: experimentFiles(cwd, name, topic, manifest) };
    case 'scoping':
      return { skill, documents: [statePath(cwd, INDEXED_ARTIFACTS.specification(name, topic)), path.join(plan, 'planning.md')] };
    case 'planning':
      return { skill, documents: [path.join(plan, 'planning.md'), ...phaseTaskFiles(plan)] };
    case 'implementation': {
      const internalId = internalIdOf(position);
      if (internalId === null) return { skill, documents: [] };
      const format = itemOf(manifest, 'planning', topic)?.format;
      const reading = typeof format === 'string' && illegalNameReason('format', format) === null
        ? [`.claude/skills/leeway-planning-process/references/output-formats/${format}/reading.md`]
        : [];
      return { skill, documents: [...reading, ...taskFile(plan, internalId)] };
    }
    case 'review':
      return { skill, documents: [path.join(wu, 'review', topic, 'report.md')] };
    default:
      return { skill: null, documents: [] };
  }
}

/**
 * Where the position is, named for the conversation — the work unit by its
 * work type where the project has it.
 * @param {Position} position @param {Manifest} manifest
 */
function placeName(position, manifest) {
  const { name, phase, topic } = position;
  if (isProjectPlace(name, phase)) return name === PRODUCT ? 'the product\'s conversation' : `the project's ${name}`;
  const unit = typeof manifest?.work_type === 'string' ? `the ${manifest.work_type} "${name}"` : `"${name}"`;
  if (phase === undefined) return unit;
  const at = topic === name ? `the ${phase} of ${unit}` : `the ${phase} of "${topic}" in ${unit}`;
  const internalId = internalIdOf(position);
  if (internalId === null) return at;
  const onTask = `${at}, on task ${position.task} (internal id \`${internalId}\`)`;
  return position.executor === undefined ? onTask : `${onTask}, its executor agent \`${position.executor}\``;
}

/**
 * A position as one line — the work unit, its phase and its topic, the topic
 * left out where it is the work unit.
 * @param {Position} position @param {string} separator @returns {string}
 */
function placeLine({ name, phase, topic }, separator) {
  return [name, phase, topic === name ? undefined : topic]
    .filter(/** @returns {word is string} */ (word) => typeof word === 'string')
    .join(separator);
}

/**
 * Why a work unit's place is no longer open to carry on from, or null where
 * it is: the work unit gone from this project or closed, the place's item
 * closed, or — in a phase a topic on the map holds — the topic cancelled or
 * postponed.
 * @param {Position} position @param {Manifest} manifest
 * @returns {string|null}
 */
function closedReason(position, manifest) {
  const { name, phase, topic } = position;
  if (isProjectPlace(name, phase)) return null;
  if (manifest === null) return `this project has no work unit "${name}"`;
  if (manifest.status !== 'in-progress') return `"${name}" is ${typeof manifest.status === 'string' ? manifest.status : 'not in progress'}`;
  if (phase === undefined || typeof topic !== 'string') return null;
  const status = itemOf(manifest, phase, topic)?.status;
  if (typeof status === 'string' && TERMINAL_STATUSES.includes(status)) return `the ${phase} is ${status}`;
  if (!MAP_PHASES.includes(phase)) return null;
  const { lifecycle } = computeTopicLifecycle(manifest, topic);
  return lifecycle === 'cancelled' || lifecycle === 'postponed' ? `the topic is ${lifecycle}` : null;
}

/**
 * The note naming where the conversation is working and what to re-read
 * there, in full, before anything else — the skill's own recovery steps.
 * @param {string} where @param {string} skillName @param {string} skill @param {string[]} files
 */
function carryOnText(where, skillName, skill, files) {
  const follow = `${COMPACTED} This conversation is working in ${where}. Follow the ${skillName} skill's "Resuming After Context Refresh" steps now, before anything else: re-read ${skill} and its framework in full`;
  return files.length > 0 ? [`${follow}, then re-read these in full:`, ...files.map((f) => `- ${f}`)].join('\n') : `${follow}.`;
}

/**
 * The lines a whole note gives the log its conversation keeps: caught up
 * from the conversation's transcript, or the transcript's loss said in one
 * line; and the line the conversation's next write to it opens with, where
 * it has not written there yet or another conversation has since.
 * @param {string} log absolute @param {string} sessionId
 */
function logLines(log, sessionId) {
  const transcript = runningTranscript(sessionId);
  const header = owedHeader(log, sessionId, transcript);
  const written = namedConversations(log).some((conversation) => conversation.session === sessionId);
  return [
    transcript === null
      ? 'This conversation\'s transcript cannot be found: say so in one line, and carry on from the log.'
      : `Catch the log, ${log}, up from this conversation's transcript, ${transcript}, from the log's last write onward.`,
    ...(header === null ? [] : [written
      ? `Another conversation has written to the log since this one did: its next write opens with this line again: \`${header}\``
      : `This conversation has not written to the log yet: its first write opens with this line: \`${header}\``]),
  ];
}

/**
 * The note for a phase that carries its recovery whole: the skill and its
 * framework re-read, then its engine calls and its documents; its log, where
 * it keeps one, caught up (`logLines`); and the conversation carried on.
 * @param {string} where @param {string} skill absolute @param {string[]} calls @param {string[]} files absolute
 * @param {string|null} log absolute @param {string} sessionId
 */
function wholeNote(where, skill, calls, files, log, sessionId) {
  return [
    `${COMPACTED} This conversation is working in ${where}. Before anything else, re-read these in full, running each engine call:`,
    `- ${skill} and its framework`,
    ...calls.map((c) => `- \`${c}\``),
    ...files.map((f) => `- ${f}`),
    ...(log === null ? [] : logLines(log, sessionId)),
    'Then carry on from where the conversation was, as if the break never happened — no recap and no announcement.',
  ].join('\n');
}

/**
 * @typedef {object} PositionReads
 * @property {string} session_id
 * @property {Position|null} position
 * @property {string|null} place  the position as one line; null where there is none
 * @property {string|null} skill  the skill that runs the work there, by absolute path; null where nothing carries on
 * @property {string[]} files     the topic's documents this project has, by absolute path, read after the skill
 * @property {string} text        the note naming where the conversation is and what to re-read
 */

/**
 * What the conversation `sessionId` re-reads to carry on from its position —
 * only what this project has of it, each file by its absolute path under the
 * project root, so a conversation with nothing else in context never guesses
 * the root — and the note the gate mod appends to the conversation's
 * compaction, composed here so the mod hands it on unchanged. No position, a
 * work unit's menu, and a place no longer open carry nothing on.
 * @param {string} cwd @param {string} sessionId @returns {PositionReads}
 */
function positionReads(cwd, sessionId) {
  const position = readPosition(sessionId);
  const place = position === null ? null : placeLine(position, PLACE_SEPARATOR);
  /** @param {string} text @returns {PositionReads} */
  const nothing = (text) => ({ session_id: sessionId, position, place, skill: null, files: [], text });
  if (position === null) return nothing('This conversation holds no workflow position, so there is nothing to carry on from.');
  const isUnit = !isProjectPlace(position.name, position.phase) && illegalNameReason('work unit', position.name) === null;
  /** @type {Manifest} */
  const manifest = isUnit ? loadManifest(cwd, position.name) : null;
  const where = placeName(position, manifest);
  const closed = closedReason(position, manifest);
  if (closed !== null) return nothing(`This conversation was working in ${where}, but ${closed}, so there is nothing to carry on from.`);
  const work = workAt(cwd, position, manifest);
  if (work.skill === null) return nothing(`This conversation is at ${where}, outside any phase, so there is nothing to carry on from.`);
  const root = codeRoot(cwd);
  const absolute = (/** @type {string} */ f) => path.resolve(root, f);
  const skill = absolute(skillFile(work.skill));
  if (!fs.existsSync(skill)) return nothing(`This conversation was working in ${where}, but this project has no ${work.skill} skill, so there is nothing to carry on from.`);
  const files = [...new Set(work.documents)].map(absolute).filter((f) => fs.existsSync(f));
  const text = work.whole === undefined
    ? carryOnText(where, work.skill, skill, files)
    : wholeNote(where, skill, work.whole.calls, files, work.whole.log, sessionId);
  return { session_id: sessionId, position, place, skill, files, text };
}

/**
 * `conversation position`'s answer: the note, and all of it as one line of
 * JSON for the gate mod.
 * @param {PositionReads} reads @returns {string}
 */
function positionSections(reads) {
  return dataSection([reads.text]) + section('POSITION', GATE_MOD_INSTRUCTION, JSON.stringify(reads));
}

module.exports = {
  readPosition, assertPlace, isPlace, recordPosition, recordTask, recordExecutor, clearTask, dropPosition,
  isAgentId, placeLine, skillAt, positionReads, positionSections,
};
