'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a topic's map as the person sees it (9.5) — `render map
// <unit>.<topic>`, drawn from `ledger map` and `ledger shown` in one read of
// the ledger, so drawing it in the conversation moves the last-looked mark
// in the same call (5.8.14, 9.5.11): the calls it lists since the person
// last looked are the ones it marks shown.
//
// - Whose a row is: Claude's call where every answer on it is Claude's —
//   its own, or one the person handed over with "your call" or "don't
//   care", marked so (9.5.3, 9.5.4); every other row is the person's
//   question — open, closed by their decision, carried over, or gone on:
//   moved to another topic, later on the roadmap, or standing elsewhere for
//   what was made on the topic. So the person's rows and Claude's calls
//   together are the map's rows.
// - Claude's calls are the map's answers Claude made, those handed over
//   among them and none carried over (`claudesCall`), each counted once.
// - An open question its experiment measures is marked waiting on it, still
//   running or reported with its result to write (9.1.11); one moved in
//   from another topic, as the message it came as.
// ---------------------------------------------------------------------------

const { stateRoot } = require('../kernel/state-root.cjs');
const { claudesCall } = require('./ledger-events.cjs');
const { carrying } = require('./ledger.cjs');
const { readShown, answerMap } = require('./ledger-read.cjs');
const { answerShown } = require('./ledger-since.cjs');
const { hasTopic, manifestOf } = require('./ledger-units.cjs');
const { titlecase } = require('./conventions.cjs');
const { mapScreen } = require('./projections/map.cjs');

/** @typedef {import('./projections/map.cjs').DrawnRow} DrawnRow */
/** @typedef {import('./projections/map.cjs').MapView} MapView */

/** An answer on a map row, as `ledger map` shows it. @typedef {{id: string, by: string, given: string, text: string}} RowAnswer */

/**
 * A map row as `ledger map` shows it.
 * @typedef {{
 *   id: string, text: string, by: string, given?: string, stands: string,
 *   moved_from: string|null, moved_to: string|null, stands_in: {unit: string, topic: string|null}|null,
 *   part_of: string|null, answers: RowAnswer[], waiting_on: {experiment: string, running: boolean}|null,
 * }} Row
 */

/** The stands a decided row has: answered, merged, or an answer whose question is set aside. */
const DECIDED_STANDS = ['answered', 'merged', 'question-set-aside'];

/** The tag of a row Claude's answer closed as the person handed it over, by how it was given. */
const HANDED_TAGS = Object.freeze({ 'your-call': 'your call', 'dont-care': 'don\'t care' });

const CLAUDES_CALL = 'Claude\'s call';
const CARRIED = 'carried over';

/** A row's answers; the row's own entry where it is an answer whose question is set aside. @param {Row} row @returns {RowAnswer[]} */
function answersOn(row) {
  return row.stands === 'question-set-aside' ? [/** @type {RowAnswer} */ (/** @type {unknown} */ (row))] : row.answers;
}

/**
 * Who closed a decided row, and its tag: the person, where any answer is
 * theirs; the person too where an answer was carried over; else Claude —
 * marked handed over where the person handed it over, else Claude's own
 * call.
 * @param {RowAnswer[]} answers
 * @returns {{claudes: boolean, tag: string}}
 */
function closedBy(answers) {
  if (answers.some((a) => a.by === 'person')) return { claudes: false, tag: 'yours' };
  if (answers.some((a) => a.given === 'carried')) return { claudes: false, tag: CARRIED };
  const handed = answers.find((a) => Object.hasOwn(HANDED_TAGS, a.given));
  return { claudes: true, tag: handed === undefined ? CLAUDES_CALL : HANDED_TAGS[/** @type {keyof typeof HANDED_TAGS} */ (handed.given)] };
}

/** Where a row gone on stands now: moved to a topic, later on the roadmap, or elsewhere. @param {Row} row */
function goneTo({ stands, moved_to: to, stands_in: standsIn }) {
  if (stands === 'later') return 'later, on the roadmap';
  if (stands === 'moved-away') return `moved to ${titlecase(/** @type {string} */ (to))}`;
  const where = /** @type {{unit: string, topic: string|null}} */ (standsIn);
  return `on ${titlecase(where.topic ?? where.unit)}`;
}

/** What an open question waits on, beneath it. @param {Row} row @returns {string[]} */
function openNotes({ moved_from: from, waiting_on: waiting }) {
  const notes = from === null ? [] : [`↳ From ${titlecase(from)}'s message`];
  if (waiting !== null) notes.push(waiting.running ? `↳ Waiting on experiment ${waiting.experiment}, still running` : `↳ Experiment ${waiting.experiment} has reported — its result is still to write`);
  return notes;
}

/**
 * The map's rows sorted into its sections, each as it is drawn, with the
 * counts the map opens on.
 * @param {Row[]} rows
 * @returns {{counts: MapView['counts'], open: DrawnRow[], decided: DrawnRow[], moved: DrawnRow[]}}
 */
function mapSections(rows) {
  /** @type {{open: DrawnRow[], decided: DrawnRow[], moved: DrawnRow[]}} */
  const drawn = { open: [], decided: [], moved: [] };
  let yoursDecided = 0;
  for (const row of rows) {
    if (row.stands === 'open') {
      drawn.open.push({ glyph: '○', text: row.text, tag: 'yours', notes: openNotes(row) });
    } else if (DECIDED_STANDS.includes(row.stands)) {
      const { claudes, tag } = closedBy(answersOn(row));
      if (!claudes) yoursDecided += 1;
      drawn.decided.push({ glyph: claudes ? '◇' : '✓', text: row.text, tag, notes: [] });
    } else {
      drawn.moved.push({ glyph: '→', text: row.text, tag: goneTo(row), notes: [] });
    }
  }
  const calls = claudesCalls(rows).length;
  const counts = { yours: drawn.open.length + yoursDecided + drawn.moved.length, decided: yoursDecided, open: drawn.open.length, moved: drawn.moved.length, calls };
  return { counts, ...drawn };
}

/**
 * Claude's calls on the map, each once, with the question it answers: the
 * answers Claude made, handed over among them, none carried over.
 * @param {Row[]} rows
 * @returns {{answer: RowAnswer, question: string|null}[]}
 */
function claudesCalls(rows) {
  /** @type {Map<string, {answer: RowAnswer, question: string|null}>} */
  const calls = new Map();
  for (const row of rows) {
    const alone = row.stands === 'question-set-aside';
    for (const answer of answersOn(row)) {
      if (claudesCall(answer) && !calls.has(answer.id)) calls.set(answer.id, { answer, question: alone ? null : row.text });
    }
  }
  return [...calls.values()];
}

/**
 * The calls a look showed, each under the question it answers on the map;
 * one whose question is set aside, alone.
 * @param {Row[]} rows @param {{id: string, text: string}[]} shown
 * @returns {MapView['since']}
 */
function sinceRows(rows, shown) {
  const byAnswer = new Map(claudesCalls(rows).map((call) => [call.answer.id, call.question]));
  return shown.map(({ id, text }) => {
    const question = byAnswer.get(id) ?? null;
    return question === null ? { question: text, answer: null } : { question, answer: text };
  });
}

/**
 * The unit and topic a `<unit>.<topic>` address names, checked: the unit
 * exists and the topic is one of its.
 * @param {string} root @param {string|undefined} address @param {string} surface
 * @returns {{unit: string, topic: string, manifest: Record<string, any>}}
 */
function topicAddress(root, address, surface) {
  const [unit, topic, ...rest] = (address ?? '').split('.');
  if (!unit || !topic || rest.length > 0) throw new Error(`render ${surface}: address must be <work-unit>.<topic>, got "${address ?? ''}"`);
  const manifest = manifestOf(root, unit);
  if (manifest === null) throw new Error(`render ${surface}: there is no work unit "${unit}"`);
  if (!hasTopic(manifest, topic)) throw new Error(`render ${surface}: ${unit} has no topic "${topic}"`);
  return { unit, topic, manifest };
}

/**
 * `render map <unit>.<topic>`: the topic's map, the calls it lists since the
 * person last looked marked shown on this machine as it is drawn.
 * @param {string} cwd @param {{dotpath?: string}} args
 * @returns {string}
 */
function mapSurface(cwd, { dotpath }) {
  /** @type {string[]} */
  const warnings = [];
  try {
    const root = stateRoot(cwd);
    const { unit, topic } = topicAddress(root, dotpath, 'map');
    const place = { unit, topic };
    return readShown(root, warnings, (shower) => {
      const rows = /** @type {Row[]} */ (answerMap(shower, place, root).questions);
      const shown = /** @type {{id: string, text: string}[]} */ (/** @type {unknown} */ (answerShown(shower, place, root, warnings).calls));
      return mapScreen({ topic, since: sinceRows(rows, shown), ...mapSections(rows) });
    });
  } catch (err) {
    throw carrying(err, warnings);
  }
}

module.exports = { closedBy, answersOn, claudesCalls, topicAddress, mapSurface };
