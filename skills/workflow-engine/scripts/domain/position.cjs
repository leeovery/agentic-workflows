'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the conversation's position — where in the workflows a
// conversation is working, kept as `position.json` in its folder
// (conversation.cjs) for whatever carries the conversation on there: the
// tmux label's resume (session-label.cjs).
//
// Every place records itself on arrival, through the calls that label it,
// labels on or off: `session label {wu} {phase} {topic}` inside a phase,
// `session label {wu}` at a work unit's menu, `session label roadmap|baseline`
// at the project-level places. Inside implementation, `task start` adds the
// task in flight and that task's `task complete` takes it off; a re-label
// of the same implementation keeps it, and any other place leaves none. The
// start menu is no position: `session repair` drops the calling
// conversation's own.
//
// The engine is the file's one writer. It writes only for a conversation it
// has marked, never creating the folder, and only a place this project has;
// a position that cannot be written costs the verb nothing.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { PROJECT_IDENTITIES, VALID_PHASES, illegalNameReason } = require('../kernel/manifest-schema.cjs');
const { isObject, writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { conversationDir, isMarked } = require('./conversation.cjs');

const FILE = 'position.json';

/**
 * @typedef {object} Position
 * @property {string} name   a work unit, or a project identity
 * @property {string} [phase]
 * @property {string} [topic]
 * @property {string} [task] the implementation task in flight, `{phase}.{task}`
 */

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

/** @param {string} sessionId @param {Position} position */
function writePosition(sessionId, position) {
  try { writeJsonAtomic(positionPath(sessionId), position); } catch { /* a courtesy, never a failure */ }
}

/** @param {string} cwd @param {string} name */
function isWorkUnit(cwd, name) {
  return illegalNameReason('work unit', name) === null && fs.existsSync(path.join(cwd, '.workflows', name));
}

/**
 * Whether the arguments name a place this project has: a work unit, a
 * phase and legal topic in one, or a project identity, which has no phase.
 * @param {string} cwd @param {string} name @param {string} [phase] @param {string} [topic]
 */
function isPlace(cwd, name, phase, topic) {
  if (phase === undefined) return PROJECT_IDENTITIES.includes(name) || isWorkUnit(cwd, name);
  return VALID_PHASES.includes(phase) && typeof topic === 'string' && illegalNameReason('topic', topic) === null
    && isWorkUnit(cwd, name);
}

/** @param {Position|null} a @param {Position} b */
function samePlace(a, b) {
  return a !== null && a.name === b.name && a.phase === b.phase && a.topic === b.topic;
}

/** The plan step an internal id ends in, `{phase}.{task}`. @param {string} internalId @returns {string|null} */
function taskStep(internalId) {
  const m = /-(\d+)-(\d+)$/.exec(internalId);
  return m ? `${m[1]}.${m[2]}` : null;
}

/**
 * Record the calling conversation's arrival at a place.
 * @param {string} cwd @param {string} name @param {string} [phase] @param {string} [topic]
 */
function recordPosition(cwd, name, phase, topic) {
  const own = ownConversation();
  if (!own || !isPlace(cwd, name, phase, topic)) return;
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
  const own = ownConversation();
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

module.exports = { readPosition, recordPosition, recordTask, clearTask, dropPosition };
