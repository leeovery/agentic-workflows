'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the questions waiting on the person in a build (12.13) — a
// projection of the ledger, never a file (12.13.6). A question the build
// needs the person for is parked with its task by a raise (raise.cjs), as a
// `parked` line (ledger-events.cjs).
//
// - A question: a park, and every park after it holding its number about
//   the same thing — the question, in any of its wordings, or the decision a
//   replacement would replace — each a task that met it while it waited and
//   joined it, its line holding the first park's sealed call, copied under
//   the writer lock. It goes by its first park, which it is drawn from, and
//   parks every task its parks name but where a close has taken the task off
//   that park, an `unparked` line naming it: a park made outside any task —
//   the task writer's, the consolidation agent's or the phase review's
//   (12.5.5) — names none, and a question parking nothing waits as any other,
//   nothing waiting on it. What it asks is Claude's call's question as
//   sealed, or, where its question has been reworded since, its wording as it
//   stands.
// - Its number: `Q{n}`, per unit, the next after the highest the unit's
//   parks hold, live or not, so none is ever reused and a queued "Q2" never
//   shifts when Q1 is answered; a task joining a question waiting takes its
//   number. Two clones parking in one unit before either pushes can mint
//   one number for two questions; the merge keeps both, and the number
//   naming both refuses, naming each by the id that tells them apart.
// - Waiting: a park waits while it is live and what it is about stands open
//   — the question it answers live, in some wording, and open, by the one
//   rule every read decides by (ledger-fold.cjs); the decision a
//   replacement would replace current, and no live keep of it made since
//   the park. While it waits, its answer comes through its raise alone: a
//   decision on its question, a move or a merge of it, a replacement of its
//   decision or a merge naming that decision its duplicate, and any other
//   raise on either, asked or proceeding, are refused anywhere else
//   (`checkUnparked`). So the wait ends with the raise's answer, a keep
//   among them, or the unit, its place or its question set aside, while it
//   is — a question set aside with its topic waits again once the topic is
//   back — or with a merged or moved line a clone's merge brings in, made
//   where the park had not yet arrived, which the fold reads as any other
//   (`notWaiting`).
// - `raise waiting <unit>`: the unit's waiting questions, oldest first, each
//   by its number and its first park's id, with what it asks — its
//   question's wording as it stands now — the tasks it parks, when it
//   parked and how many minutes it has waited: what every surface showing
//   the questions waiting reads (12.13.7).
// - `raise aside <unit> <question> …`: each question named set aside — by
//   its number, or a park's id — staying waiting (12.13.17): it writes
//   nothing, and answers the receipt. Any question not waiting refuses the
//   whole call (20.6.10).
// - The receipt (12.13.16, 20.6.9), one line Claude shows as it is: the
//   questions and what became of them — answered, set aside, or still open,
//   explained again, where the person didn't follow; then what that means —
//   the task the answer freed, or each of theirs, building again: a task a
//   park held that waited before the answer and no park still waiting
//   holds after it — in step, once the task in flight is done, or from the
//   one in flight where it is one of several freed (12.7.9); where none is,
//   the task a question still waiting holds; where none is and it parks
//   none, that no task waited on it; else still
//   waiting — how many questions of the unit still wait, and the
//   next to raise. The next is read from the conversation's discussion
//   queue, `discussing.json` in its folder, which the gate mod keeps —
//   `{"discussing", "queue"}`, the question under discussion and those
//   queued after it, by number: the first of them still waiting and not
//   just recorded. With no queue, or none still waiting, it names none; a
//   queue that cannot be read names none, and says so as a warning. An
//   explained-again question is still under discussion, so names no next.
// - A task against its questions (13.4.6), what the task verbs read: the
//   tasks each question waiting parks, so a task parked never shows as
//   ready, is never done nor its account taken while a question parks it,
//   and is taken off them as it closes.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { messageOf } = require('../kernel/call.cjs');
const { isObject } = require('../kernel/manifest-io.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { findStateRoot } = require('../kernel/state-root.cjs');
const { conversationDir } = require('./conversation.cjs');
const { shortId, resolveId } = require('./ledger-ids.cjs');
const { ID_FACTS, readFolded, factsOf, whyDead, questionStands, notCurrent, keptOf, wordingOf } = require('./ledger-fold.cjs');
const { liveness, manifestOf } = require('./ledger-units.cjs');

/** @typedef {import('./ledger-fold.cjs').Folded} Folded */
/** @typedef {import('./ledger.cjs').EntryPlace} EntryPlace */
/** The entry at a place, read again. @typedef {(place: EntryPlace) => Record<string, any>} EntryAt */
/**
 * What a park can be about: the question an answer would answer, in any of
 * its wordings, or the decision a replacement would replace.
 * @typedef {{answers?: string|null, replaces?: string|null}} Subject
 */
/**
 * A question parked in a unit: its first park, its number, every park of
 * it in the ledger's order, and the tasks they park, in the order each
 * first parked — none taken off it since.
 * @typedef {{park: string, number: number, parks: string[], tasks: string[]}} Question
 */
/**
 * A waiting question as `raise waiting` answers it: its number, its first
 * park's short id, what it asks, the tasks it parks, when it parked and how
 * many whole minutes it has waited.
 * @typedef {{question: string, id: string, asks: string, parks: string[], since: string, waited_minutes: number}} Waiting
 */
/**
 * A question found waiting: its parks, its first park's line, what it asks
 * now, its question's wording as it stands — null for a replacement — and,
 * for a replacement, the decision's answer as it stands.
 * @typedef {{question: Question, line: Record<string, any>, asks: string, answers: string|null, keeps: string|null}} FoundPark
 */
/**
 * The question of a unit waiting on a subject: its number, its first
 * park's short id, the tasks it parks, its first park's line, and what it
 * asks now.
 * @typedef {{name: string, id: string, tasks: string[], line: Record<string, any>, asks: string}} WaitingOn
 */
/** A park's call as sealed: Claude's call, the rows judged, and why it asks. @typedef {{call: Record<string, any>, rows_judged: string[], why_asking: string}} Sealed */
/** A seal's question: its first park's full id, its number and the tasks it parks (raise.cjs). @typedef {{park: string, number: number, tasks: string[]}} Parks */

const DISCUSSING = 'discussing.json';
const NUMBERED = /^Q([1-9][0-9]*)$/;
const WAITING_USAGE = 'raise waiting <work-unit>';
const ASIDE_USAGE = 'raise aside <work-unit> <question> …   (each by its number, Q{n}, or its park\'s id)';

/** A question as the person reads its number. @param {number} number */
function numbered(number) {
  return `Q${number}`;
}

/** The tasks a question parks, as a line says them: the first, and how many more; or none. @param {string[]} tasks */
function parkedTasks(tasks) {
  if (tasks.length === 0) return 'no task';
  return tasks.length === 1 ? `task ${tasks[0]}` : `task ${tasks[0]} and ${tasks.length - 1} more`;
}

/** The task the park `id` parks, or null: none named, or a close took it off this park. @param {Folded} read @param {string} id */
function taskOf(read, id) {
  const { task, unparked_by: unparkedBy } = factsOf(read, id);
  return unparkedBy.length > 0 ? null : task;
}

/** The parks made in `unit`, live or not, in the ledger's order. @param {Folded} read @param {string} unit @returns {string[]} */
function parksOf(read, unit) {
  return [...read.facts].filter(([, facts]) => facts.event === 'parked' && facts.unit === unit).map(([id]) => id);
}

/** Whether the park `park` is about `subject`. @param {Folded} read @param {string} park @param {Subject} subject */
function isAbout(read, park, { answers = null, replaces = null }) {
  const { question, replaces: replacing } = factsOf(read, park);
  if (answers !== null) return question !== null && factsOf(read, question).root === factsOf(read, answers).root;
  return replaces !== null && replacing === replaces;
}

/** What the park `park` is about. @param {Folded} read @param {string} park @returns {Subject} */
function subjectOf(read, park) {
  const { question, replaces } = factsOf(read, park);
  return { answers: question, replaces };
}

/**
 * The parks `ids` as the questions they make, in the order each first
 * parked: a park, and each after it holding its number about the same thing.
 * @param {Folded} read @param {string[]} ids
 * @returns {Question[]}
 */
function questionsOf(read, ids) {
  /** @type {Question[]} */
  const questions = [];
  for (const id of ids) {
    const number = /** @type {number} */ (factsOf(read, id).number);
    const task = taskOf(read, id);
    let question = questions.find((q) => q.number === number && isAbout(read, id, subjectOf(read, q.park)));
    if (question === undefined) {
      question = { park: id, number, parks: [], tasks: [] };
      questions.push(question);
    }
    question.parks.push(id);
    if (task !== null && !question.tasks.includes(task)) question.tasks.push(task);
  }
  return questions;
}

/** The next number a question parked in `unit` mints. @param {Folded} read @param {string} unit */
function nextNumber(read, unit) {
  return 1 + Math.max(0, ...parksOf(read, unit).map((id) => /** @type {number} */ (factsOf(read, id).number)));
}

/**
 * Why the park `id` waits no longer, or null while it waits: its place set
 * aside; its question set aside in every wording, answered, merged into
 * another's answer or moved to the roadmap; the decision it would replace
 * no longer current, or kept as it stands since it parked.
 * @param {Folded} read @param {string} id
 * @returns {string|null}
 */
function notWaiting(read, id) {
  const dead = whyDead(read, id);
  if (dead !== null) return dead;
  const { question, replaces, place } = factsOf(read, id);
  if (question !== null) {
    if (wordingOf(read, question) === null) return `its question is set aside — ${whyDead(read, question)}`;
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

/** The questions of `unit` still waiting, oldest first. @param {Folded} read @param {string} unit */
function waitingOf(read, unit) {
  return questionsOf(read, waitingParks(read, unit));
}

/** The numbers of the questions of `unit` still waiting, oldest first. @param {Folded} read @param {string} unit */
function waitingNumbers(read, unit) {
  return waitingOf(read, unit).map((q) => numbered(q.number));
}

/**
 * The question of `unit` that `name` names — its number, or a prefix of a
 * park's id — refused in the words of `said`: a number no park holds, or
 * two clones' questions hold, naming each by its id; an id no park of the
 * unit begins.
 * @param {Folded} read @param {string} unit @param {string} name @param {string} said
 * @returns {Question}
 */
function questionNamed(read, unit, name, said) {
  const parks = parksOf(read, unit);
  const questions = questionsOf(read, parks);
  const asNumber = NUMBERED.exec(name);
  if (asNumber === null) {
    let park;
    try {
      park = resolveId(name, parks);
    } catch (err) {
      throw new Error(`${said}: ${name} names no question parked in ${unit} — ${messageOf(err)}`);
    }
    return /** @type {Question} */ (questions.find((q) => q.parks.includes(park)));
  }
  const holding = questions.filter((q) => q.number === Number(asNumber[1]));
  if (holding.length === 1) return holding[0];
  if (holding.length === 0) {
    const waiting = waitingNumbers(read, unit);
    throw new Error(`${said}: ${unit} has no question ${name} — ${waiting.length === 0 ? 'none waits on the person' : `those waiting: ${waiting.join(', ')}`}`);
  }
  const each = holding.map((q) => `${shortId(q.park, read.facts.keys())} (parks ${q.tasks.length === 0 ? 'no task' : q.tasks.join(', ')})`).join(', ');
  throw new Error(`${said}: ${name} names ${holding.length} questions of ${unit} — each clone parked one under it before the other pushed; name the one by its id: ${each}`);
}

/**
 * The question `name` names, refused in the words of `said` where it waits
 * no longer (20.6.10).
 * @param {Folded} read @param {string} unit @param {string} name @param {string} said
 * @returns {Question}
 */
function waitingNamed(read, unit, name, said) {
  const question = questionNamed(read, unit, name, said);
  const why = notWaiting(read, question.park);
  if (why !== null) throw new Error(`${said}: ${numbered(question.number)} waits no longer — ${why}`);
  return question;
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
 * @param {(read: Folded, entryAt: EntryAt) => T} answer
 * @returns {T}
 */
function readQuestions(root, warnings, answer) {
  return readFolded(root, ID_FACTS, warnings, (facts, entryAt) => answer({ facts, live: liveness(root) }, entryAt));
}

/**
 * What the question whose first park's line is `line` asks now: Claude's
 * call's question as it was sealed, or, where its question has been
 * reworded since, its wording as it stands, on one line; and that wording —
 * null for a replacement, and for a question set aside in every wording,
 * which asks as it was sealed.
 * @param {Folded} read @param {EntryAt} entryAt @param {Record<string, any>} line
 * @returns {{asks: string, answers: string|null}}
 */
function askedNow(read, entryAt, line) {
  const answers = line.question === null ? null : wordingOf(read, line.question);
  if (answers === null || answers === line.question) return { asks: line.call.question, answers };
  return { asks: entryAt(factsOf(read, answers).place).text.replace(/\s+/g, ' ').trim(), answers };
}

/**
 * The question `name` names in `unit`, waiting — refused in the words of
 * `said` where none does — with its first park's line, what it asks and its
 * question's wording as they stand, and for a replacement the decision's
 * answer as it stands: what drawing it needs (raise.cjs).
 * @param {string} cwd @param {string|undefined} unit @param {string|undefined} name @param {string} said @param {string} usage @param {string[]} warnings
 * @returns {FoundPark}
 */
function foundPark(cwd, unit, name, said, usage, warnings) {
  const root = unitRoot(cwd, unit, said, usage);
  if (name === undefined || name === '' || name.startsWith('--')) throw new Error(`Usage: engine ${usage}`);
  return readQuestions(root, warnings, (read, entryAt) => {
    const question = waitingNamed(read, /** @type {string} */ (unit), name, said);
    const line = entryAt(factsOf(read, question.park).place);
    const keeps = line.replaces === null ? null : /** @type {string} */ (entryAt(factsOf(read, line.replaces).place).text);
    return { question, line, ...askedNow(read, entryAt, line), keeps };
  });
}

/**
 * The question of `unit` waiting on `subject` — the question a raise
 * answers, in any of its wordings, or the decision it would replace — or
 * null where none waits.
 * @param {string} cwd @param {string} unit @param {Subject} subject @param {string[]} warnings
 * @returns {WaitingOn|null}
 */
function waitingOn(cwd, unit, subject, warnings) {
  return readQuestions(/** @type {string} */ (findStateRoot(cwd)), warnings, (read, entryAt) => {
    const question = waitingOf(read, unit).find((q) => isAbout(read, q.park, subject));
    if (question === undefined) return null;
    const line = entryAt(factsOf(read, question.park).place);
    return { name: numbered(question.number), id: shortId(question.park, read.facts.keys()), tasks: question.tasks, line, asks: askedNow(read, entryAt, line).asks };
  });
}

/**
 * What a park about `subject` in `unit` holds of its own, set under the
 * writer lock from the ledger as the write read it there, `read` and
 * `entryAt`: where a question waits on it, which the park's task joins,
 * that question's number and its first park's call as sealed; else the
 * next number, and `sealed`, the call as the raise sealed it.
 * @param {Folded} read @param {EntryAt} entryAt @param {string} unit @param {Subject} subject @param {Sealed} sealed
 * @returns {Sealed & {number: number}}
 */
function parkedUnder(read, entryAt, unit, subject, sealed) {
  const joined = waitingParks(read, unit).find((id) => isAbout(read, id, subject));
  if (joined === undefined) return { number: nextNumber(read, unit), ...sealed };
  const { number, place } = factsOf(read, joined);
  const { call, rows_judged: judged, why_asking: whyAsking } = entryAt(place);
  return { number: /** @type {number} */ (number), call, rows_judged: judged, why_asking: whyAsking };
}

/**
 * The question of `unit` the park `park` is one of, read now: its number,
 * what it asks now, and the tasks it parks.
 * @param {string} cwd @param {string} unit @param {string} park @param {string[]} warnings
 * @returns {{name: string, asks: string, tasks: string[]}}
 */
function parkedQuestion(cwd, unit, park, warnings) {
  return readQuestions(/** @type {string} */ (findStateRoot(cwd)), warnings, (read, entryAt) => {
    const question = /** @type {Question} */ (questionsOf(read, parksOf(read, unit)).find((q) => q.parks.includes(park)));
    return { name: numbered(question.number), asks: askedNow(read, entryAt, entryAt(factsOf(read, question.park).place)).asks, tasks: question.tasks };
  });
}

/**
 * Refuse, in the words of `said`, an answer to what a question waiting in
 * the build is about — a decision on its question, a move or a merge of it,
 * a replacement of the decision it would replace or a merge naming it its
 * duplicate, or a raise on either, asked or proceeding — made anywhere but
 * through its raise, which the person answers it by alone.
 * @param {Folded} read @param {Subject} subject @param {string} said
 */
function checkUnparked(read, subject, said) {
  const park = [...read.facts].find(([id, facts]) => facts.event === 'parked' && isAbout(read, id, subject) && waits(read, id));
  if (park === undefined) return;
  const [id, { unit }] = park;
  const question = /** @type {Question} */ (waitingOf(read, unit).find((q) => q.parks.includes(id)));
  const name = numbered(question.number);
  throw new Error(`${said}: ${name} of ${unit} waits on the person about this, parking ${parkedTasks(question.tasks)} — the person answers it through the raise alone: raise draw ${unit} ${name}`);
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
  const waiting = readQuestions(root, warnings, (read, entryAt) => waitingIn(read, entryAt, unit, now));
  return { unit, waiting, ...(warnings.length > 0 ? { warnings } : {}) };
}

/**
 * The unit's questions waiting on the person, as `raise waiting` answers
 * them, and each task by where an answer last freed it (`freedAtOf`'s),
 * from one read of the ledger, what it said pushed to `warnings`.
 * @param {string} cwd @param {string} unit @param {string[]} warnings
 * @returns {{waiting: Waiting[], freed: Map<string, number>}}
 */
function waitingAndFreed(cwd, unit, warnings) {
  const root = unitRoot(cwd, unit, 'raise waiting', WAITING_USAGE);
  const now = Date.now();
  return readQuestions(root, warnings, (read, entryAt) => ({ waiting: waitingIn(read, entryAt, unit, now), freed: freedIn(read, unit) }));
}

/** The unit's questions waiting, oldest first, as `raise waiting` answers them. @param {Folded} read @param {EntryAt} entryAt @param {string} unit @param {number} now @returns {Waiting[]} */
function waitingIn(read, entryAt, unit, now) {
  return waitingOf(read, unit).map((question) => {
    const line = entryAt(factsOf(read, question.park).place);
    return {
      question: numbered(question.number),
      id: shortId(question.park, read.facts.keys()),
      asks: askedNow(read, entryAt, line).asks,
      parks: question.tasks,
      since: line.at,
      waited_minutes: Math.max(0, Math.floor((now - Date.parse(line.at)) / 60000)),
    };
  });
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
 * What an answer to the question `parks` meant for the build, the unit's
 * parks waiting before it `before`: the tasks parks held that waited
 * before it and wait no longer, that no park still waiting holds, as
 * `freedWords` says them; none, where a question still waiting holds its
 * task; and none where it parks no task.
 * @param {Folded} read @param {string} unit @param {Parks} parks @param {string[]} before
 * @returns {{freed: string[]}|{means: string}}
 */
function answerMeans(read, unit, parks, before) {
  const after = waitingParks(read, unit);
  const held = new Set(after.map((id) => taskOf(read, id)));
  const freed = [...new Set(before.filter((id) => !after.includes(id)).map((id) => taskOf(read, id)))]
    .filter((task) => task !== null && !held.has(task));
  if (freed.length > 0) return { freed: /** @type {string[]} */ (freed) };
  const { tasks } = /** @type {Question} */ (questionsOf(read, parksOf(read, unit)).find((q) => q.park === parks.park));
  const task = tasks.find((t) => held.has(t));
  if (task === undefined) return { means: 'no task waited on it' };
  const by = waitingOf(read, unit).filter((q) => q.tasks.includes(task)).map((q) => numbered(q.number));
  return { means: `task ${task} waits on ${by.join(', ')}` };
}

/**
 * The tasks an answer freed building again — one, or each of theirs — one
 * its pair is reading once that round is read (round-report.cjs), and in
 * step, one at a time (12.7.9): once the task in flight is done, where it
 * is none of them; else from the one in flight, where they are several.
 * @param {string[]} freed @param {import('./task-verbs.cjs').StepTurn|null} turn @param {(task: string) => number|null} read the round its pair reads
 */
function freedWords(freed, turn, read) {
  const reading = freed.length === 1 ? read(freed[0]) : null;
  const behind = turn !== null && !freed.includes(turn.inFlight) ? `task ${turn.inFlight} is done` : null;
  const waits = [...(reading === null ? [] : [`its pair has read round ${reading}`]), ...(behind === null ? [] : [behind])];
  const again = `${freed.length === 1 ? `task ${freed[0]} builds` : 'their tasks build'} again${waits.length === 0 ? '' : ` once ${waits.join(' and ')}`}`;
  return turn !== null && behind === null && freed.length > 1 ? `${again}, task ${turn.inFlight} first` : again;
}

/**
 * The receipt of the person's answer to the parked question `parks`, read
 * from the ledger as it stands once the answer landed, against the unit's
 * parks waiting before it, `before`, and in step what goes on first then,
 * `turnNow` answering it (task-verbs.cjs, `stepTurn`), read only where the
 * answer freed a task.
 * @param {string} cwd @param {string} unit @param {Parks} parks @param {string[]} before @param {string[]} warnings
 * @param {() => import('./task-verbs.cjs').StepTurn|null} turnNow @param {(task: string) => number|null} read the round a task's pair reads
 */
function answeredReceipt(cwd, unit, parks, before, warnings, turnNow, read) {
  const root = /** @type {string} */ (findStateRoot(cwd));
  const name = numbered(parks.number);
  const { meant, waiting } = readQuestions(root, warnings, (read) => ({ meant: answerMeans(read, unit, parks, before), waiting: waitingNumbers(read, unit) }));
  const means = 'means' in meant ? meant.means : freedWords(meant.freed, turnNow(), read);
  return receiptLine([name], 'answered', means, waiting.length, nextUp(handedSession(), [name], waiting, warnings));
}

/**
 * The receipt of the person not following the parked question `parks`:
 * still open, explained again, so still under discussion.
 * @param {string} cwd @param {string} unit @param {Parks} parks @param {string[]} warnings
 */
function explainedReceipt(cwd, unit, parks, warnings) {
  const root = /** @type {string} */ (findStateRoot(cwd));
  const count = readQuestions(root, warnings, (read) => waitingOf(read, unit).length);
  return receiptLine([numbered(parks.number)], 'still open, explained again', 'still waiting', count, null);
}

/**
 * Refuse, in the words of `said`, the person's answer to the parked
 * question `parks` once it waits no longer (20.6.10): nothing is recorded.
 * Answers the unit's parks waiting, as the answer is about to land.
 * @param {Folded} read @param {Parks} parks @param {string} said
 * @returns {string[]}
 */
function checkStillWaiting(read, parks, said) {
  const why = notWaiting(read, parks.park);
  if (why !== null) throw new Error(`${said}: ${numbered(parks.number)} waits no longer — ${why}; nothing recorded`);
  return waitingParks(read, /** @type {string} */ (factsOf(read, parks.park).unit));
}

/**
 * Refuse, in the words of `said`, the person's answer to a raise, read from
 * `read` as it is about to land, recording nothing: to a question waiting in
 * the build, `parks`, once it waits no longer (20.6.10); to any other raise,
 * about `subject`, once a question in the build has come to wait on it since
 * it was drawn, its answer that question's raise's alone. Answers the unit's
 * parks waiting for the first, none for the other.
 * @param {Folded} read @param {Parks|null} parks @param {Subject} subject @param {string} said
 * @returns {string[]}
 */
function checkAnswerable(read, parks, subject, said) {
  if (parks !== null) return checkStillWaiting(read, parks, said);
  checkUnparked(read, subject, said);
  return [];
}

/**
 * `checkAnswerable`, read now: for "I don't follow", which lands nothing in
 * the ledger.
 * @param {string} cwd @param {Parks|null} parks @param {Subject} subject @param {string} said @param {string[]} warnings
 */
function answerable(cwd, parks, subject, said, warnings) {
  readQuestions(/** @type {string} */ (findStateRoot(cwd)), warnings, (read) => checkAnswerable(read, parks, subject, said));
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
    const aside = [...new Set(names.map((name) => numbered(waitingNamed(read, unit, name, 'raise aside').number)))];
    const waiting = waitingNumbers(read, unit);
    return receiptLine(aside, 'set aside', 'still waiting', waiting.length, nextUp(handedSession(), aside, waiting, warnings));
  });
  return { receipt, ...(warnings.length > 0 ? { warnings } : {}) };
}

/**
 * The tasks of `unit` its questions waiting park, each with the numbers of
 * those parking it, oldest first.
 * @param {string} root @param {string} unit @param {string[]} warnings
 * @returns {Map<string, string[]>}
 */
function parkedTasksOf(root, unit, warnings) {
  return readQuestions(root, warnings, (read) => {
    /** @type {Map<string, string[]>} */
    const parked = new Map();
    for (const question of waitingOf(read, unit)) {
      for (const task of question.tasks) parked.set(task, [...(parked.get(task) ?? []), numbered(question.number)]);
    }
    return parked;
  });
}

/**
 * The ledger's line at which the park `id` stopped waiting: the first entry
 * after it answering, merging or moving its question, or replacing or
 * keeping the decision it would replace; its own line where none did —
 * set aside, or waiting still.
 * @param {Folded} read @param {string} id
 */
function stoppedAt(read, id) {
  const { question, replaces, place } = factsOf(read, id);
  const about = factsOf(read, question === null ? /** @type {string} */ (replaces) : factsOf(read, question).root);
  const ends = question === null ? [...about.replaced_by, ...about.kept] : [...about.answered_by, ...about.merges, ...about.moves];
  const after = ends.map((end) => factsOf(read, end).place.number).filter((line) => line > place.number);
  return after.length === 0 ? place.number : Math.min(...after);
}

/**
 * Each task of `unit` a park has named, live or not — but one a close took
 * off its parks — by the ledger's line at which the last of its parks to
 * stop waiting stopped: where it was freed to go on (`stoppedAt`).
 * @param {string} root @param {string} unit @param {string[]} warnings
 * @returns {Map<string, number>}
 */
function freedAtOf(root, unit, warnings) {
  return readQuestions(root, warnings, (read) => freedIn(read, unit));
}

/** `freedAtOf`'s answer, from the ledger read. @param {Folded} read @param {string} unit @returns {Map<string, number>} */
function freedIn(read, unit) {
  /** @type {Map<string, number>} */
  const freed = new Map();
  for (const id of parksOf(read, unit)) {
    const task = taskOf(read, id);
    if (task !== null) freed.set(task, Math.max(freed.get(task) ?? 0, stoppedAt(read, id)));
  }
  return freed;
}

/**
 * Where `task` of `unit` waits: the numbers of the questions waiting that
 * park it, oldest first, the parks of theirs naming it, and the build's
 * phase the first of those was made in; none, where none parks it.
 * @param {string} root @param {string} unit @param {string} task @param {string[]} warnings
 * @returns {{names: string[], parks: string[], phase: string|null}}
 */
function parkingTask(root, unit, task, warnings) {
  return readQuestions(root, warnings, (read) => {
    const holding = waitingOf(read, unit).filter((question) => question.tasks.includes(task));
    const parks = holding.flatMap((question) => question.parks.filter((id) => taskOf(read, id) === task));
    return { names: holding.map((question) => numbered(question.number)), parks, phase: parks.length === 0 ? null : factsOf(read, parks[0]).phase };
  });
}

module.exports = {
  DISCUSSING, WAITING_USAGE, ASIDE_USAGE, numbered, parkedTasks, waitingOn, parkedUnder, parkedQuestion, checkUnparked, waitingQuestions, readQuestions, waitingOf, asideQuestions, foundPark, answeredReceipt,
  explainedReceipt, checkAnswerable, answerable, parkedTasksOf, freedAtOf, waitingAndFreed, parkingTask,
};
