'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the questions waiting on the person in a build (12.13) — a
// projection of the ledger, never a file (12.13.6). A question the build
// needs the person for is parked with its task by a raise (raise.cjs), as a
// `parked` line (ledger-events.cjs).
//
// - Its number: `Q{n}`, per unit, the next after the highest the unit's
//   parks hold, live or not, so none is ever reused and a queued "Q2" never
//   shifts when Q1 is answered. Two clones parking in one unit before either
//   pushes can mint one number twice; the merge keeps both lines, and a
//   number naming two refuses, naming each by the id that tells them apart.
// - Waiting: a park waits while it is live and what it is about stands open
//   — the question it answers open, by the one rule every read decides by
//   (ledger-fold.cjs); the decision a replacement would replace current,
//   and no live keep of it made since the park. So an answer landed any
//   way — through the raise, or a merge, a move to the roadmap or the
//   person's own `ledger decide` — ends the wait, and so does a unit or a
//   place set aside, while it is.
// - `raise waiting <unit>`: the unit's waiting questions, oldest first, each
//   by its number and its park's id, with what it asks, the task it parks,
//   when it parked and how many minutes it has waited: what every surface
//   showing the questions waiting reads (12.13.7).
// - `raise aside <unit> <question> …`: each question named set aside — by
//   its number, or its park's id — staying waiting (12.13.17): it writes
//   nothing, and answers the receipt. Any question not waiting refuses the
//   whole call (20.6.10).
// - The receipt (12.13.16, 20.6.9), one line Claude shows as it is: the
//   questions and what became of them — answered, set aside, or still open,
//   explained again, where the person didn't follow; then what that means —
//   the task an answer frees, or each of their tasks, building again; where
//   another question still parks its task, the task waiting on it; else
//   still waiting — how many questions of the unit still wait, and the next
//   to raise. The next is read from the conversation's discussion queue,
//   `discussing.json` in its folder, which the board keeps —
//   `{"discussing", "queue"}`, the question under discussion and those
//   queued after it, by number: the first of them still waiting and not
//   just recorded. With no queue, or none still waiting, it names none; a
//   queue that cannot be read names none, and says so as a warning. An
//   explained-again question is still under discussion, so names no next.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { messageOf } = require('../kernel/call.cjs');
const { isObject } = require('../kernel/manifest-io.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { findStateRoot } = require('../kernel/state-root.cjs');
const { conversationDir } = require('./conversation.cjs');
const { shortId, resolveId } = require('./ledger-ids.cjs');
const { ID_FACTS, readFolded, factsOf, isLive, whyDead, questionStands, notCurrent, keptOf } = require('./ledger-fold.cjs');
const { liveness, manifestOf } = require('./ledger-units.cjs');

/** @typedef {import('./ledger-fold.cjs').Folded} Folded */
/** @typedef {import('./ledger.cjs').EntryPlace} EntryPlace */
/**
 * A waiting question as `raise waiting` answers it: its number, its park's
 * short id, what it asks, the task it parks, when it parked and how many
 * whole minutes it has waited.
 * @typedef {{question: string, id: string, asks: string, parks: string, since: string, waited_minutes: number}} Waiting
 */
/**
 * A park found waiting: its full id and its line; and, for a replacement it
 * proposes, the decision's answer as it stands.
 * @typedef {{id: string, line: Record<string, any>, keeps: string|null}} FoundPark
 */
/** A seal's park: its full id, its number and the task it parks (raise.cjs). @typedef {{park: string, number: number, task: string}} Parks */

const DISCUSSING = 'discussing.json';
const NUMBERED = /^Q([1-9][0-9]*)$/;
const WAITING_USAGE = 'raise waiting <work-unit>';
const ASIDE_USAGE = 'raise aside <work-unit> <question> …   (each by its number, Q{n}, or its park\'s id)';

/** A question as the person reads its number. @param {number} number */
function numbered(number) {
  return `Q${number}`;
}

/** The parks made in `unit`, live or not, in the ledger's order. @param {Folded} read @param {string} unit @returns {string[]} */
function parksOf(read, unit) {
  return [...read.facts].filter(([, facts]) => facts.event === 'parked' && facts.unit === unit).map(([id]) => id);
}

/** The number a question parked now in `unit` takes. @param {Folded} read @param {string} unit */
function nextNumber(read, unit) {
  return 1 + Math.max(0, ...parksOf(read, unit).map((id) => /** @type {number} */ (factsOf(read, id).number)));
}

/**
 * Why the park `id` waits no longer, or null while it waits: its place set
 * aside; its question answered, merged into another's answer or moved to
 * the roadmap; the decision it would replace no longer current, or kept as
 * it stands since it parked.
 * @param {Folded} read @param {string} id
 * @returns {string|null}
 */
function notWaiting(read, id) {
  const dead = whyDead(read, id);
  if (dead !== null) return dead;
  const { question, replaces, place } = factsOf(read, id);
  if (question !== null) {
    const stands = questionStands(read, question);
    return { open: null, answered: 'its question is answered', merged: 'its question is merged into another\'s answer', later: 'its question is moved to the roadmap as later' }[stands];
  }
  const decision = /** @type {string} */ (replaces);
  if (notCurrent(read, decision) !== null) return 'the decision it would replace is no longer current';
  return keptOf(read, decision).some((keep) => factsOf(read, keep).place.number > place.number) ? 'the person kept the decision as it stands' : null;
}

/** Whether the park `id` waits. @param {Folded} read @param {string} id */
function waits(read, id) {
  return notWaiting(read, id) === null;
}

/** The parks of `unit` still waiting, oldest first. @param {Folded} read @param {string} unit */
function waitingParks(read, unit) {
  return parksOf(read, unit).filter((id) => waits(read, id));
}

/** The numbers of the questions of `unit` still waiting, oldest first. @param {Folded} read @param {string} unit */
function waitingNumbers(read, unit) {
  return waitingParks(read, unit).map((id) => numbered(/** @type {number} */ (factsOf(read, id).number)));
}

/**
 * The park of `unit` that `name` names — its number, or a prefix of its id —
 * refused in the words of `said`: a number no park holds, or two clones'
 * parks hold, naming each by its id; an id no park of the unit begins.
 * @param {Folded} read @param {string} unit @param {string} name @param {string} said
 * @returns {string}
 */
function parkNamed(read, unit, name, said) {
  const parks = parksOf(read, unit);
  const short = (/** @type {string} */ id) => shortId(id, read.facts.keys());
  const asNumber = NUMBERED.exec(name);
  if (asNumber === null) {
    try {
      return resolveId(name, parks);
    } catch (err) {
      throw new Error(`${said}: ${name} names no question parked in ${unit} — ${messageOf(err)}`);
    }
  }
  const holding = parks.filter((id) => factsOf(read, id).number === Number(asNumber[1]));
  if (holding.length === 1) return holding[0];
  if (holding.length === 0) {
    const waiting = waitingNumbers(read, unit);
    throw new Error(`${said}: ${unit} has no question ${name} — ${waiting.length === 0 ? 'none waits on the person' : `those waiting: ${waiting.join(', ')}`}`);
  }
  const each = holding.map((id) => `${short(id)} (parks ${factsOf(read, id).task})`).join(', ');
  throw new Error(`${said}: ${name} names ${holding.length} questions of ${unit} — each clone parked one under it before the other pushed; name the one by its id: ${each}`);
}

/**
 * The park `name` names, refused in the words of `said` where it waits no
 * longer (20.6.10).
 * @param {Folded} read @param {string} unit @param {string} name @param {string} said
 * @returns {string}
 */
function waitingNamed(read, unit, name, said) {
  const id = parkNamed(read, unit, name, said);
  const why = notWaiting(read, id);
  if (why !== null) throw new Error(`${said}: ${numbered(/** @type {number} */ (factsOf(read, id).number))} waits no longer — ${why}`);
  return id;
}

/**
 * The project's state root and the unit `unit` names, refused in the words
 * of `said`: no state, no unit named, or none of that name.
 * @param {string} cwd @param {string|undefined} unit @param {string} said @param {string} usage
 */
function unitRoot(cwd, unit, said, usage) {
  if (unit === undefined || unit === '' || unit.startsWith('--')) throw new Error(`Usage: engine ${usage}`);
  const root = findStateRoot(cwd);
  if (root === null) throw new Error(`${said}: there is no workflows state here — the questions waiting are in the ledger, which the state holds`);
  if (manifestOf(root, unit) === null) throw new Error(`${said}: there is no work unit "${unit}"`);
  return root;
}

/**
 * `answer` given the ledger folded and read against liveness, and the entry
 * at any place read again.
 * @template T
 * @param {string} root @param {string[]} warnings
 * @param {(read: Folded, entryAt: (place: EntryPlace) => Record<string, any>) => T} answer
 * @returns {T}
 */
function readQuestions(root, warnings, answer) {
  return readFolded(root, ID_FACTS, warnings, (facts, entryAt) => answer({ facts, live: liveness(root) }, entryAt));
}

/**
 * The park `name` names in `unit`, waiting — refused in the words of `said`
 * where none does — with its line, and for a replacement the decision's
 * answer as it stands: what drawing it needs (raise.cjs).
 * @param {string} cwd @param {string|undefined} unit @param {string|undefined} name @param {string} said @param {string} usage @param {string[]} warnings
 * @returns {FoundPark}
 */
function foundPark(cwd, unit, name, said, usage, warnings) {
  const root = unitRoot(cwd, unit, said, usage);
  if (name === undefined || name === '' || name.startsWith('--')) throw new Error(`Usage: engine ${usage}`);
  return readQuestions(root, warnings, (read, entryAt) => {
    const id = waitingNamed(read, /** @type {string} */ (unit), name, said);
    const line = entryAt(factsOf(read, id).place);
    const keeps = line.replaces === null ? null : /** @type {string} */ (entryAt(factsOf(read, line.replaces).place).text);
    return { id, line, keeps };
  });
}

/**
 * The park of `unit` still waiting about what `target` is about — its
 * question, in any of its wordings, or the decision it would replace — and
 * parking `task`: its number, its short id, what it asks and why; null
 * where none waits.
 * @param {string} cwd @param {string} unit @param {import('./raise.cjs').Target} target @param {string} task @param {string[]} warnings
 * @returns {{name: string, id: string, asks: string, why_asking: string}|null}
 */
function parkedAlready(cwd, unit, { answers, replaces }, task, warnings) {
  return readQuestions(/** @type {string} */ (findStateRoot(cwd)), warnings, (read, entryAt) => {
    const about = (/** @type {string} */ id) => {
      const { question, replaces: replacing } = factsOf(read, id);
      return answers === null ? replacing === replaces?.entry : question !== null && factsOf(read, question).root === factsOf(read, answers).root;
    };
    const park = waitingParks(read, unit).find((id) => factsOf(read, id).task === task && about(id));
    if (park === undefined) return null;
    const { number, call, why_asking: whyAsking } = entryAt(factsOf(read, park).place);
    return { name: numbered(number), id: shortId(park, read.facts.keys()), asks: call.question, why_asking: whyAsking };
  });
}

/**
 * `raise waiting <unit>`: the unit's questions waiting on the person,
 * oldest first.
 * @param {string} cwd @param {string[]} args
 * @returns {{unit: string, waiting: Waiting[], warnings?: string[]}}
 */
function waitingQuestions(cwd, args) {
  if (args.length !== 1) throw new Error(`Usage: engine ${WAITING_USAGE}`);
  const [unit] = args;
  const root = unitRoot(cwd, unit, 'raise waiting', WAITING_USAGE);
  /** @type {string[]} */
  const warnings = [];
  const now = Date.now();
  const waiting = readQuestions(root, warnings, (read, entryAt) => waitingParks(read, unit).map((id) => {
    const { number, task, place } = factsOf(read, id);
    const line = entryAt(place);
    return {
      question: numbered(/** @type {number} */ (number)),
      id: shortId(id, read.facts.keys()),
      asks: line.call.question,
      parks: /** @type {string} */ (task),
      since: line.at,
      waited_minutes: Math.max(0, Math.floor((now - Date.parse(line.at)) / 60000)),
    };
  }));
  return { unit, waiting, ...(warnings.length > 0 ? { warnings } : {}) };
}

/**
 * The next question to raise: the first of the conversation's discussion
 * queue still waiting and not among those `recorded`; null with no queue,
 * none such, or no conversation. A queue that cannot be read names none,
 * saying so in `warnings`.
 * @param {string|null} session @param {string[]} recorded @param {string[]} waiting @param {string[]} warnings
 * @returns {string|null}
 */
function nextUp(session, recorded, waiting, warnings) {
  if (session === null) return null;
  const file = path.join(conversationDir(session), DISCUSSING);
  if (!fs.existsSync(file)) return null;
  let queue;
  try {
    queue = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    warnings.push(`the discussion queue, ${file}, cannot be read, so the receipt names no next question: ${messageOf(err)}`);
    return null;
  }
  if (!isObject(queue) || !Array.isArray(queue.queue)) {
    warnings.push(`the discussion queue, ${file}, holds no {"discussing", "queue"}, so the receipt names no next question`);
    return null;
  }
  return [queue.discussing, ...queue.queue].find((name) => typeof name === 'string' && !recorded.includes(name) && waiting.includes(name)) ?? null;
}

/**
 * The receipt's line: the questions and what became of them, what that
 * means, how many still wait, and the next to raise where there is one.
 * @param {string[]} names @param {string} outcome @param {string} means @param {number} count @param {string|null} next
 */
function receiptLine(names, outcome, means, count, next) {
  return [`${names.join(', ')} ${outcome}`, means, count === 0 ? 'nothing waiting on you' : `${count} waiting on you`, ...(next === null ? [] : [`next: ${next}`])].join(' · ');
}

/**
 * Whether the parks `a` and `b` are about one thing: the same question, in
 * any of its wordings, or the same decision a replacement would replace.
 * @param {Folded} read @param {string} a @param {string} b
 */
function aboutOne(read, a, b) {
  const [one, other] = [factsOf(read, a), factsOf(read, b)];
  if (one.question !== null && other.question !== null) return factsOf(read, one.question).root === factsOf(read, other.question).root;
  return one.replaces !== null && one.replaces === other.replaces;
}

/**
 * What an answer to the park `park` means for the build: the tasks of every
 * park about the same thing, now answered with it, that no question still
 * waiting parks — one building again, or each of theirs; none, where
 * another question still parks the task.
 * @param {Folded} read @param {string} unit @param {string} park
 */
function answerMeans(read, unit, park) {
  const waiting = waitingParks(read, unit);
  const held = new Set(waiting.map((id) => factsOf(read, id).task));
  const freed = [...new Set(parksOf(read, unit).filter((id) => !waiting.includes(id) && aboutOne(read, id, park)).map((id) => /** @type {string} */ (factsOf(read, id).task)))]
    .filter((task) => !held.has(task));
  if (freed.length === 1) return `task ${freed[0]} builds again`;
  if (freed.length > 1) return 'their tasks build again';
  const task = factsOf(read, park).task;
  const by = waiting.filter((id) => factsOf(read, id).task === task).map((id) => numbered(/** @type {number} */ (factsOf(read, id).number)));
  return `task ${task} waits on ${by.join(', ')}`;
}

/**
 * The receipt of the person's answer to the parked question `parks`, read
 * from the ledger as it stands once the answer landed.
 * @param {string} cwd @param {string} unit @param {Parks} parks @param {string[]} warnings
 */
function answeredReceipt(cwd, unit, parks, warnings) {
  const root = /** @type {string} */ (findStateRoot(cwd));
  const name = numbered(parks.number);
  return readQuestions(root, warnings, (read) => {
    const waiting = waitingNumbers(read, unit);
    return receiptLine([name], 'answered', answerMeans(read, unit, parks.park), waiting.length, nextUp(handedSession(), [name], waiting, warnings));
  });
}

/**
 * The receipt of the person not following the parked question `parks`:
 * still open, explained again, so still under discussion.
 * @param {string} cwd @param {string} unit @param {Parks} parks @param {string[]} warnings
 */
function explainedReceipt(cwd, unit, parks, warnings) {
  const root = /** @type {string} */ (findStateRoot(cwd));
  const count = readQuestions(root, warnings, (read) => waitingParks(read, unit).length);
  return receiptLine([numbered(parks.number)], 'still open, explained again', 'still waiting', count, null);
}

/**
 * Refuse, in the words of `said`, the person's answer to the parked
 * question `parks` once it waits no longer (20.6.10): nothing is recorded.
 * @param {Folded} read @param {Parks} parks @param {string} said
 */
function checkStillWaiting(read, parks, said) {
  const why = notWaiting(read, parks.park);
  if (why !== null) throw new Error(`${said}: ${numbered(parks.number)} waits no longer — ${why}; nothing recorded`);
}

/**
 * Whether the parked question `parks` still waits, read now: refused in the
 * words of `said` where it waits no longer.
 * @param {string} cwd @param {Parks} parks @param {string} said @param {string[]} warnings
 */
function stillWaiting(cwd, parks, said, warnings) {
  readQuestions(/** @type {string} */ (findStateRoot(cwd)), warnings, (read) => checkStillWaiting(read, parks, said));
}

/**
 * `raise aside <unit> <question> …`: each question named set aside, staying
 * waiting; nothing written. Refuses any named that does not wait.
 * @param {string} cwd @param {string[]} args
 * @returns {{receipt: string, warnings?: string[]}}
 */
function asideQuestions(cwd, args) {
  const [unit, ...names] = args;
  if (names.length === 0 || names.some((name) => name === '' || name.startsWith('--'))) throw new Error(`Usage: engine ${ASIDE_USAGE}`);
  const root = unitRoot(cwd, unit, 'raise aside', ASIDE_USAGE);
  /** @type {string[]} */
  const warnings = [];
  const receipt = readQuestions(root, warnings, (read) => {
    const aside = [...new Set(names.map((name) => numbered(/** @type {number} */ (factsOf(read, waitingNamed(read, unit, name, 'raise aside')).number))))];
    const waiting = waitingNumbers(read, unit);
    return receiptLine(aside, 'set aside', 'still waiting', waiting.length, nextUp(handedSession(), aside, waiting, warnings));
  });
  return { receipt, ...(warnings.length > 0 ? { warnings } : {}) };
}

module.exports = {
  DISCUSSING, WAITING_USAGE, ASIDE_USAGE, numbered, nextNumber, parkedAlready, waitingQuestions, asideQuestions, foundPark, answeredReceipt, explainedReceipt, checkStillWaiting, stillWaiting,
};
