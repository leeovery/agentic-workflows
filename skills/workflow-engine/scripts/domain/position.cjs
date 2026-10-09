'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the conversation's position — where in the workflows a
// conversation is working, kept as `position.json` in its folder
// (conversation.cjs) for whatever carries the conversation on: the tmux
// label's resume (session-label.cjs), and `conversation position`, the note
// the gate mod appends to a compaction, naming what to re-read to carry on
// there.
//
// Every place records itself on arrival, through the calls that label it,
// labels on or off: `session label {wu} {phase} {topic}` inside a phase,
// `session label {wu}` at a work unit's menu, `session label roadmap|baseline`
// at the project-level places — a place this project lacks is refused before
// anything is labelled or recorded. Inside implementation, `task start` adds
// the task in flight and that task's `task complete` takes it off; a
// re-label of the same implementation keeps it, and any other place leaves
// none. The start menu is no position: boot drops the calling conversation's
// own before anything else it does, and `session repair` drops it too.
//
// The engine is the file's one writer, and writes only for a conversation
// that runs the workflows: recording a position marks the conversation first
// (conversation.cjs — a session id, a call run in a workflows project), since
// a conversation a handoff began can arrive at its first place before any
// other engine call has marked it. A position that cannot be written costs
// the verb nothing.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { PROJECT_IDENTITIES, TERMINAL_STATUSES, VALID_PHASES, illegalNameReason } = require('../kernel/manifest-schema.cjs');
const { isObject, writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { conversationDir, isMarked, markConversation } = require('./conversation.cjs');
const { loadManifest, loadProjectManifest } = require('./reads.cjs');
const { computeTopicLifecycle, itemOf, openRecords, phaseData } = require('./derivations.cjs');
const { recordDir } = require('./experiment.cjs');
const { latestSessionLog } = require('./discovery-session.cjs');
const { phaseSkill } = require('./handoff.cjs');
const { stepOfInternalId } = require('./tasks.cjs');
const { INDEXED_ARTIFACTS } = require('./knowledge/artifacts.cjs');
const { section, dataSection, GATE_MOD_INSTRUCTION } = require('./projections/surfaces.cjs');

const FILE = 'position.json';

const COMPACTED = 'The conversation was just compacted.';

const PLACE_SEPARATOR = ' › ';

// The phases a topic on an epic's discovery map holds: a cancel or a postpone
// of the topic is recorded on its map row, whatever each item reads.
const MAP_PHASES = ['research', 'experiment', 'discussion'];

/**
 * @typedef {object} Position
 * @property {string} name   a work unit, or a project identity
 * @property {string} [phase]
 * @property {string} [topic]
 * @property {string} [task] the implementation task in flight, `{phase}.{task}`
 */

/** @typedef {Record<string, unknown>|null} Manifest  a work unit's manifest; null where the project has none */

/** Whether a place is a project-level one, named by its identity alone. @param {string} name @param {string} [phase] */
function isProjectPlace(name, phase) {
  return phase === undefined && PROJECT_IDENTITIES.includes(name);
}

/** @param {string} sessionId */
function positionPath(sessionId) {
  return path.join(conversationDir(sessionId), FILE);
}

/**
 * The position recorded for the conversation `sessionId`; null where none
 * is, or it does not read as one.
 * @param {string} sessionId @returns {Position|null}
 */
function readPosition(sessionId) {
  try {
    const parsed = JSON.parse(fs.readFileSync(positionPath(sessionId), 'utf8'));
    if (isObject(parsed) && typeof parsed.name === 'string') return /** @type {Position} */ (parsed);
  } catch { /* none recorded, or unreadable */ }
  return null;
}

/** The calling conversation where the engine has marked it, else null. @returns {string|null} */
function ownConversation() {
  const sessionId = process.env.CLAUDE_CODE_SESSION_ID;
  return sessionId && isMarked(sessionId) ? sessionId : null;
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

/** @param {string} sessionId @param {Position} position */
function writePosition(sessionId, position) {
  try { writeJsonAtomic(positionPath(sessionId), position); } catch { /* a courtesy, never a failure */ }
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
  return fs.existsSync(path.join(cwd, '.workflows', name)) ? null : `no work unit directory: .workflows/${name}`;
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
  const step = stepOfInternalId(internalId);
  return step === null ? null : `${step.phase}.${step.task}`;
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
  if (phase === 'implementation' && samePlace(prior, position) && prior?.task) position.task = prior.task;
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
  writePosition(own, { name: workUnit, phase: 'implementation', topic, task: step });
}

/**
 * Take a completed task off the position — only the one it names, in that
 * topic's implementation.
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
// map cancelled or postponed — nor one whose skill this project lacks.
// ---------------------------------------------------------------------------

/**
 * The skill that runs the work at a place — a phase's own, discovery's, or a
 * project place's; null at a work unit's menu.
 * @param {string} name @param {string} [phase] @returns {string|null}
 */
function skillAt(name, phase) {
  if (phase === undefined) return PROJECT_IDENTITIES.includes(name) ? `workflow-${name}` : null;
  return phase === 'discovery' ? 'workflow-discovery' : phaseSkill(phase);
}

/** @param {string} skill */
const skillFile = (skill) => `.claude/skills/${skill}/SKILL.md`;

/**
 * The session log a place's session writes: the open one the marker names,
 * else the latest on disk.
 * @param {string} cwd @param {string} dir project-relative @param {unknown} active
 * @returns {string[]}
 */
function sessionLog(cwd, dir, active) {
  if (typeof active === 'string' && /^\d+$/.test(active)) return [`${dir}/session-${active}.md`];
  const latest = latestSessionLog(path.join(cwd, dir));
  return latest === null ? [] : [`${dir}/${latest.file}`];
}

/** The plan's phase task files, in phase order. @param {string} cwd @param {string} dir project-relative @returns {string[]} */
function phaseTaskFiles(cwd, dir) {
  /** @type {string[]} */
  let names = [];
  try { names = fs.readdirSync(path.join(cwd, dir)).filter((f) => /^phase-\d+-tasks\.md$/.test(f)); } catch { return []; }
  return names.sort((a, b) => parseInt(a.slice(6), 10) - parseInt(b.slice(6), 10)).map((f) => `${dir}/${f}`);
}

/**
 * The file named for the task in the plan's directory or a folder in it —
 * where a plan format that keeps its tasks as files keeps them.
 * @param {string} cwd @param {string} dir project-relative @param {string} internalId
 * @returns {string[]}
 */
function taskFile(cwd, dir, internalId) {
  const name = `${internalId}.md`;
  /** @type {string[]} */
  const found = [];
  /** @param {string} rel @param {boolean} descend */
  const walk = (rel, descend) => {
    let entries;
    try { entries = fs.readdirSync(path.join(cwd, rel), { withFileTypes: true }); } catch { return; }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isFile() && entry.name === name) found.push(`${rel}/${name}`);
      else if (entry.isDirectory() && descend) walk(`${rel}/${entry.name}`, false);
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
 * @param {string} workUnit @param {string} topic @param {Record<string, unknown>} manifest
 * @returns {string[]}
 */
function experimentFiles(workUnit, topic, manifest) {
  const experiments = itemOf(manifest, 'experiment', topic)?.experiments;
  try {
    return openRecords(manifest, topic).flatMap((id) => {
      const dir = recordDir(workUnit, topic, id, experiments);
      return ['problem.md', 'design.md', 'report.md'].map((f) => `${dir}/${f}`);
    });
  } catch {
    return [];
  }
}

/**
 * The log of a project place's open session — the one its node on the
 * project manifest marks open; none where no session is open.
 * @param {string} cwd @param {string} identity @returns {string[]}
 */
function projectSessionLog(cwd, identity) {
  const node = loadProjectManifest(cwd)?.[identity];
  const active = isObject(node) ? node.active_session : undefined;
  return typeof active === 'string' ? sessionLog(cwd, `.workflows/.${identity}/sessions`, active) : [];
}

/**
 * The skill that runs the work at a position and the topic's documents,
 * whether or not they exist; neither at a work unit's menu.
 * @param {string} cwd @param {Position} position @param {Manifest} manifest
 * @returns {{skill: string|null, documents: string[]}}
 */
function workAt(cwd, position, manifest) {
  const { name, phase } = position;
  const skill = skillAt(name, phase);
  if (skill === null) return { skill: null, documents: [] };
  if (phase === undefined) return { skill, documents: projectSessionLog(cwd, name) };
  if (manifest === null) return { skill: null, documents: [] };
  const wu = `.workflows/${name}`;
  const topic = /** @type {string} */ (position.topic);
  switch (phase) {
    case 'discovery':
      return { skill, documents: sessionLog(cwd, `${wu}/discovery/sessions`, phaseData(manifest, 'discovery').active_session) };
    case 'research':
    case 'discussion':
    case 'investigation':
    case 'specification':
      return { skill, documents: [INDEXED_ARTIFACTS[phase](name, topic)] };
    case 'experiment':
      return { skill, documents: experimentFiles(name, topic, manifest) };
    case 'scoping':
      return { skill, documents: [INDEXED_ARTIFACTS.specification(name, topic), `${wu}/planning/${topic}/planning.md`] };
    case 'planning':
      return { skill, documents: [`${wu}/planning/${topic}/planning.md`, ...phaseTaskFiles(cwd, `${wu}/planning/${topic}`)] };
    case 'implementation': {
      const internalId = internalIdOf(position);
      if (internalId === null) return { skill, documents: [] };
      const format = itemOf(manifest, 'planning', topic)?.format;
      const reading = typeof format === 'string' && illegalNameReason('format', format) === null
        ? [`.claude/skills/workflow-planning-process/references/output-formats/${format}/reading.md`]
        : [];
      return { skill, documents: [...reading, ...taskFile(cwd, `${wu}/planning/${topic}`, internalId)] };
    }
    case 'review':
      return { skill, documents: [`${wu}/review/${topic}/report.md`] };
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
  if (isProjectPlace(name, phase)) return `the project's ${name}`;
  const unit = typeof manifest?.work_type === 'string' ? `the ${manifest.work_type} "${name}"` : `"${name}"`;
  if (phase === undefined) return unit;
  const at = topic === name ? `the ${phase} of ${unit}` : `the ${phase} of "${topic}" in ${unit}`;
  const internalId = internalIdOf(position);
  return internalId === null ? at : `${at}, on task ${position.task} (internal id \`${internalId}\`)`;
}

/**
 * A position as one line — the work unit, its phase and its topic, the topic
 * left out where it is the work unit.
 * @param {Position} position @returns {string}
 */
function placeLine({ name, phase, topic }) {
  return [name, phase, topic === name ? undefined : topic]
    .filter(/** @returns {word is string} */ (word) => typeof word === 'string')
    .join(PLACE_SEPARATOR);
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
  const place = position === null ? null : placeLine(position);
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
  const absolute = (/** @type {string} */ f) => path.resolve(cwd, f);
  const skill = absolute(skillFile(work.skill));
  if (!fs.existsSync(skill)) return nothing(`This conversation was working in ${where}, but this project has no ${work.skill} skill, so there is nothing to carry on from.`);
  const files = [...new Set(work.documents)].map(absolute).filter((f) => fs.existsSync(f));
  return { session_id: sessionId, position, place, skill, files, text: carryOnText(where, work.skill, skill, files) };
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
  readPosition, assertPlace, isPlace, recordPosition, recordTask, clearTask, dropPosition,
  skillAt, positionReads, positionSections,
};
