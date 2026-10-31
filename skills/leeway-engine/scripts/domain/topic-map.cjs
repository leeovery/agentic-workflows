'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a topic's map as the person sees it (9.5) — `render map
// <unit>.<topic>`, drawn from `ledger map` and `ledger shown` in one read of
// the ledger, so drawing it in the conversation moves the last-looked mark
// in the same call (5.8.14, 9.5.11): the calls it lists since the person
// last looked are the ones it marks shown.
//
// - Whose a row is: the person's, where an answer on it is theirs, and
//   where it is open or gone on — moved to another topic, later on the
//   roadmap, or standing elsewhere for what was made on the topic; carried
//   over, where an answer on it came by migration, never passing as the
//   person's decision (21.6.5); else Claude's call — its own, or one the
//   person handed over with "your call" or "don't care", marked so (9.5.3,
//   9.5.4). So the person's rows, the carried rows and Claude's calls
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
const { topicTitles, titled } = require('./derivations.cjs');
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

/** How the person handed an answer over to Claude — "your call", "don't care" — or null where they did not. @param {{given?: string}} answer */
function handedTag({ given }) {
  return given !== undefined && Object.hasOwn(HANDED_TAGS, given) ? HANDED_TAGS[/** @type {keyof typeof HANDED_TAGS} */ (given)] : null;
}

/**
 * Whose a decided row is, and its tag: the person's, where any answer is
 * theirs; carried over, where an answer came by migration; else Claude's —
 * marked handed over where the person handed it over, else Claude's own
 * call.
 * @param {RowAnswer[]} answers
 * @returns {{whose: 'yours'|'carried'|'claudes', tag: string}}
 */
function closedBy(answers) {
  if (answers.some((a) => a.by === 'person')) return { whose: 'yours', tag: 'yours' };
  if (answers.some((a) => a.given === 'carried')) return { whose: 'carried', tag: CARRIED };
  const handed = answers.map(handedTag).find((tag) => tag !== null);
  return { whose: 'claudes', tag: handed ?? CLAUDES_CALL };
}

/**
 * Where a row stands for the person: open, gone on, or decided — theirs,
 * carried over, or Claude's.
 * @param {Row} row @returns {'open'|'moved'|'yours'|'carried'|'claudes'}
 */
function rowStanding(row) {
  if (row.stands === 'open') return 'open';
  return DECIDED_STANDS.includes(row.stands) ? closedBy(answersOn(row)).whose : 'moved';
}

/**
 * How the map names a topic of a unit: by the name it goes by (8.8.17).
 * @typedef {(unit: string, topic: string) => string} Namer
 */

/**
 * A `Namer` reading each unit's titles once, from its manifest.
 * @param {string} root @returns {Namer}
 */
function topicNamer(root) {
  /** @type {Map<string, Record<string, string>>} */
  const titles = new Map();
  return (unit, topic) => {
    if (!titles.has(unit)) titles.set(unit, topicTitles(manifestOf(root, unit) ?? {}));
    return titled(/** @type {Record<string, string>} */ (titles.get(unit)), topic);
  };
}

/** Where a row gone on stands now: moved to a topic, later on the roadmap, or elsewhere. @param {Row} row @param {string} unit @param {Namer} named */
function goneTo({ stands, moved_to: to, stands_in: standsIn }, unit, named) {
  if (stands === 'later') return 'later, on the roadmap';
  if (stands === 'moved-away') return `moved to ${named(unit, /** @type {string} */ (to))}`;
  const where = /** @type {{unit: string, topic: string|null}} */ (standsIn);
  return `on ${where.topic === null ? titlecase(where.unit) : named(where.unit, where.topic)}`;
}

/** What an open question waits on, beneath it. @param {Row} row @param {string} unit @param {Namer} named @returns {string[]} */
function openNotes({ moved_from: from, waiting_on: waiting }, unit, named) {
  const notes = from === null ? [] : [`↳ From ${named(unit, from)}'s message`];
  if (waiting !== null) notes.push(waiting.running ? `↳ Waiting on experiment ${waiting.experiment}, still running` : `↳ Experiment ${waiting.experiment} has reported — its result is still to write`);
  return notes;
}

/**
 * The map's rows sorted into its sections, each as it is drawn, with the
 * counts the map opens on; the topics a row names, of `unit` or another,
 * `named`.
 * @param {Row[]} rows @param {string} unit @param {Namer} named
 * @returns {{counts: MapView['counts'], open: DrawnRow[], decided: DrawnRow[], moved: DrawnRow[]}}
 */
function mapSections(rows, unit, named) {
  /** @type {{open: DrawnRow[], decided: DrawnRow[], moved: DrawnRow[]}} */
  const drawn = { open: [], decided: [], moved: [] };
  const decided = { yours: 0, carried: 0, claudes: 0 };
  for (const row of rows) {
    const standing = rowStanding(row);
    if (standing === 'open') {
      drawn.open.push({ glyph: '○', text: row.text, tag: 'yours', notes: openNotes(row, unit, named) });
    } else if (standing === 'moved') {
      drawn.moved.push({ glyph: '→', text: row.text, tag: goneTo(row, unit, named), notes: [] });
    } else {
      decided[standing] += 1;
      drawn.decided.push({ glyph: standing === 'claudes' ? '◇' : '✓', text: row.text, tag: closedBy(answersOn(row)).tag, notes: [] });
    }
  }
  const calls = claudesCalls(rows).length;
  const counts = { yours: drawn.open.length + decided.yours + drawn.moved.length, decided: decided.yours, open: drawn.open.length, moved: drawn.moved.length, calls, carried: decided.carried };
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
      const named = topicNamer(root);
      return mapScreen({ title: named(unit, topic), since: sinceRows(rows, shown), ...mapSections(rows, unit, named) });
    });
  } catch (err) {
    throw carrying(err, warnings);
  }
}

module.exports = { rowStanding, answersOn, claudesCalls, handedTag, topicAddress, mapSurface };
