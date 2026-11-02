'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a task against the build's questions parking it (13.4.6,
// questions.cjs), so the tracker and the ledger agree on what a task waits
// on.
//
// - A raise that parks a task, `--parks <phase>.<n>` (raise.cjs), names one
//   the tracker holds and not yet ended, read as any read of the tracker is
//   (task-verbs.cjs) under the writer lock, since that read may commit the
//   tracker's setting up.
// - A task a question waiting parks waits on it: `task ready` never answers
//   it, and `task done` and `task account` refuse it, naming each question's
//   raise, `raise draw <unit> Q{n}`.
// - `task close` ends a task whatever waits on it, taking it off every
//   question parking it: an `unparked` line in the ledger (ledger-events.cjs)
//   under the conversation's session, landed and committed as a park is,
//   before the tracker moves — so a close the tracker then refuses, run
//   again, finds it taken off already and writes nothing more. A question it
//   leaves parking nothing still waits.
// ---------------------------------------------------------------------------

const { handedSession } = require('../kernel/process.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { withStateLock } = require('./state-worktree.cjs');
const { parseShownTask, shownTask, taskName } = require('./task-id.cjs');
const { trackedTask, ENDED } = require('./task-verbs.cjs');
const { landRaised } = require('./ledger-write.cjs');
const { parkedTasksOf } = require('./questions.cjs');

/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */

/**
 * Refuse, in the words of `said`, a task of `unit` a raise would park that
 * the tracker lacks, or that has ended.
 * @param {string} cwd @param {string} unit @param {string} task @param {string} said
 */
function checkParkable(cwd, unit, task, said) {
  const ref = parseShownTask(unit, task);
  const lacking = `${said}: --parks names ${taskName(ref)}, which the tracker does not hold — a question parks a task the tracker holds`;
  const { status } = withStateLock(stateRoot(cwd), () => trackedTask(cwd, ref, lacking));
  if (ENDED.includes(status)) throw new Error(`${said}: --parks names ${taskName(ref)}, which is ${status} — a question parks only a task not yet ended`);
}

/** The tasks of `unit` its questions waiting park, each with the numbers of those parking it. @param {string} cwd @param {string} unit */
function parkedOf(cwd, unit) {
  return parkedTasksOf(stateRoot(cwd), unit, []);
}

/**
 * Refuse, in the words of `said`, a task a question waiting parks, naming
 * each question's raise.
 * @param {string} cwd @param {TaskRef} ref @param {string} said
 */
function refuseParked(cwd, ref, said) {
  const names = parkedOf(cwd, ref.unit).get(shownTask(ref));
  if (names === undefined) return;
  const draws = names.map((name) => `raise draw ${ref.unit} ${name}`).join(', ');
  throw new Error(`${said}: ${taskName(ref)} waits on ${names.join(', ')}, parked for the person — they answer ${names.length === 1 ? 'it' : 'each'} through its raise: ${draws}`);
}

/**
 * The task taken off every question waiting that parks it, in the words of
 * `said`: the numbers of those it was taken off, none where none parks it;
 * any warnings the landing gave pushed to `warnings`. Refuses where one
 * does and the call has no session to tag the ledger's line with.
 * @param {string} cwd @param {TaskRef} ref @param {string} said @param {string[]} warnings
 * @returns {string[]}
 */
function takeOff(cwd, ref, said, warnings) {
  const task = shownTask(ref);
  const names = parkedOf(cwd, ref.unit).get(task) ?? [];
  if (names.length === 0) return [];
  if (handedSession() === null) {
    throw new Error(`${said}: ${taskName(ref)} is parked on ${names.join(', ')}, and taking it off is written to the ledger under the conversation's session — Claude Code hands every command it runs one, and this one has none`);
  }
  landRaised(cwd, {
    said, place: { unit: ref.unit, phase: 'implementation', topic: null }, lands: 'unpark', linked: { task }, content: {}, id: null, logs: null, checkRead: () => {},
  }, warnings);
  return names;
}

module.exports = { checkParkable, refuseParked, takeOff, parkedOf };
