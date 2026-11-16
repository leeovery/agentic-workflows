'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the person's review of the spec (11.11) — the marks read back
// from the review page, the comments waiting for Claude, the numbers the
// open page holds, and the review's record.
//
// The page writes its `marks` collection, one document a section (`s1`,
// `s2`, …), each `{"m": {"<lineId>": {s, h, t, at}}}`: a line's id its
// number with its dots as dashes; `s` a tick, an open conversation
// (`comment`) or empty; `h` the fingerprint of the wording the person ticked
// or unticked (spec-page-model.cjs); `t` the line's conversation, each
// message keyed `p<ms>` (the person) or `c<ms>` (Claude) and its time in
// epoch milliseconds, `{by, x}`, an empty `x` a message the person removed;
// and `at` when. Claude reads them back through `spec marks <unit> --file
// <marks.json>`, the collection by document — each as the page holds it, or
// as the artifact store saves it, under `data` — and the engine keeps them
// at `.cache/{unit}/specification/marks.json`, answering the comments
// waiting for Claude: a line whose conversation is open, the person's
// message its last (11.11.4). It refuses, every refusal opening
// `spec marks: `, storing nothing: a unit the project lacks; one with no
// spec; a concluded spec, whose review ended when the build began; a file it
// cannot read as the marks, naming every fault; and a spec its grammar
// cannot read.
//
// Nothing on the page reaches Claude by itself (11.11.5), so the comments
// waiting and the record are only as fresh as the marks last stored: ready
// to build's yes stores the marks it is handed first, then reads the
// comments waiting and writes the record from them, in one call
// (`settleReview`).
//
// The page is open once Claude has recorded its publishing (`spec
// published`, spec-page.cjs), the artifact's address and when kept at
// `.cache/{unit}/specification/published.json`, beside the page Claude built
// and outside it, so a page built again never closes it; marks are stored
// only from a page published, which Claude reads back to
// `.cache/{unit}/specification/read-back.json` — the file `spec published`,
// the spec's entry and its recovery note name (`openPage`), and ready to
// build's picks take. While it is, a number never changes
// (11.11.3). Every number it holds is kept with its last wording in
// `.cache/{unit}/specification/held.json`, which each land adds to: the
// numbers of the spec the state branch holds and of the stored marks with
// those of every land since the page opened. `spec land` refuses a line
// moved to another number — its wording one another number held, which no
// longer holds it; a number removed since the page opened given to another
// line, a line brought back with its last wording being that line again;
// and an added number not past every number held where it sits, its part,
// its area's scenarios or its line's screens. The spec's writer is briefed
// with them, each place's numbers and the next free one there
// (`heldPlaces`), so it never writes a land the page refuses.
//
// The record (11.11.9) is `{unit}/spec-review.json`, written when the
// person picks the build's position, only where the page was open — a spec
// the person did not review has none — and never by Claude, whom the layout
// hook refuses it. By number, a screen's included, it holds each line's
// state and its conversation, `{"lines": {"<number>": {state, conversation:
// [{by: person|claude, at, text}]}}}`: `approved`, ticked on its wording;
// `approved-after-comment`, ticked with a conversation; `claudes-tick`,
// carrying Claude's tick the person let stand — neither ticked on its
// wording nor ever unticked, whatever wording the untick held, no
// conversation open (11.11.16); `open`, its conversation
// open, answered or not; `changed`, ticked on a wording it no longer has;
// `passed`, passed without review; and `removed`, a line the spec no longer
// holds that the person ticked or commented on. A tick with no fingerprint
// stands. Nothing reads the record to count trust (11.11.10).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { statePath, stateRoot } = require('../kernel/state-root.cjs');
const { isObject, writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { workUnitNameRefusal } = require('../kernel/manifest-schema.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { manifestOf } = require('./ledger-units.cjs');
const { SPEC_FILE, specReading } = require('./spec-sections.cjs');
const { specStanding } = require('./spec-standing.cjs');
const { landedSpec } = require('./spec-landed.cjs');
const { fingerprint } = require('../kernel/fingerprint.cjs');
const { specPage } = require('./spec-page-model.cjs');

const MARKS_USAGE = 'spec marks <work-unit> --file <marks.json>';

/** The review's record, beside the spec. */
const REVIEW_FILE = 'spec-review.json';

/** @typedef {import('./spec-sections.cjs').Line} Line */
/** @typedef {import('./spec-page-model.cjs').SpecPage} SpecPage */
/** A message of a line's conversation as the page keeps it. @typedef {{by?: 'p'|'c', x: string}} Message */
/** A line's mark as the page keeps it. @typedef {{s?: 'tick'|'comment'|'', h?: string, t?: Record<string, Message>, at?: string}} Mark */
/** The marks by document, each `{m}`: the marks by line id. @typedef {Record<string, {m: Record<string, Mark>}>} Marks */
/** A message as the record holds it. @typedef {{by: 'person'|'claude', at: string, text: string}} Said */
/** @typedef {'approved'|'approved-after-comment'|'claudes-tick'|'open'|'changed'|'passed'|'removed'} ReviewState */
/**
 * A line as the review leaves it: its id and number; for a line the spec
 * holds, its area and its wording; its state and its conversation; and
 * whether its conversation waits for Claude.
 * @typedef {{id: string, number: string, section: number|null, wording: string|null, state: ReviewState, conversation: Said[], waiting: boolean}} Reviewed
 */
/** A comment waiting for Claude: its line, the marks' document Claude answers in, the line's wording and its conversation. @typedef {{number: string, id: string, doc: string, wording: string, conversation: Said[]}} Waiting */
/** The review settled at ready to build's yes: the comments waiting for Claude, and the record written — none while a comment waits. @typedef {{waiting: Waiting[], record: string|null}} Settled */

/** A marks document's id. */
const DOC = /^s[1-9][0-9]*$/;

/** A line's id: a statement's or a scenario's number dashed, a screen's tail after it. */
const LINE_ID = /^(?:[0-9]+-[0-9]+-[0-9]+|[0-9]+-S[0-9]+)(?:-scr[0-9]+)?$/;

/** A message's key: who wrote it, and when, in epoch milliseconds. */
const MESSAGE_KEY = /^[pc][0-9]+$/;

const STATUSES = ['tick', 'comment', ''];

/** The unit's review page's cache. @param {string} cwd @param {string} unit */
const pageCache = (cwd, unit) => statePath(cwd, '.cache', unit, 'specification');

/** Where the unit's marks are kept. @param {string} cwd @param {string} unit */
const marksFile = (cwd, unit) => path.join(pageCache(cwd, unit), 'marks.json');

/** Where the unit's page is built. @param {string} cwd @param {string} unit */
const pageDir = (cwd, unit) => path.join(pageCache(cwd, unit), 'page');

/** Where the numbers the unit's open page holds are kept. @param {string} cwd @param {string} unit */
const heldFile = (cwd, unit) => path.join(pageCache(cwd, unit), 'held.json');

/** Where the unit's page's publishing is recorded. @param {string} cwd @param {string} unit */
const publishedFile = (cwd, unit) => path.join(pageCache(cwd, unit), 'published.json');

/** Where Claude reads the unit's open page's marks back to, for the engine to take. @param {string} cwd @param {string} unit */
const readBackFile = (cwd, unit) => path.join(pageCache(cwd, unit), 'read-back.json');

/** Whether the unit's review page is open: its publishing recorded. @param {string} cwd @param {string} unit */
function pageOpen(cwd, unit) {
  return fs.existsSync(publishedFile(cwd, unit));
}

/** The unit's page as published: its address and when, or null where it is not. @param {string} cwd @param {string} unit @returns {{url: string, at: string}|null} */
const publishedPage = (cwd, unit) => cached(publishedFile(cwd, unit), null);

/**
 * What a conversation needs to reach the unit's open page: its address, and
 * the file its marks are read back to; null where it is not open.
 * @param {string} cwd @param {string} unit @returns {{url: string, readBack: string}|null}
 */
function openPage(cwd, unit) {
  const published = publishedPage(cwd, unit);
  return published === null ? null : { url: published.url, readBack: readBackFile(cwd, unit) };
}

/** A line's number from its id: dashes back to dots, a screen's tail kept. @param {string} id */
function numberOf(id) {
  const [, base, tail = ''] = /** @type {RegExpExecArray} */ (/^(.*?)(-scr[0-9]+)?$/.exec(id));
  return `${base.replaceAll('-', '.')}${tail}`;
}

/** The time a message key holds, or null where it holds none. @param {string} key */
function keyTime(key) {
  if (!MESSAGE_KEY.test(key)) return null;
  const at = new Date(Number(key.slice(1)));
  return Number.isNaN(at.getTime()) ? null : at;
}

/** The faults of a line's conversation. @param {string} what @param {unknown} said @returns {string[]} */
function conversationFaults(what, said) {
  if (!isObject(said)) return [`${what}: t is the line's conversation, {"p<ms>": {"by", "x"}, …}`];
  return Object.entries(/** @type {Record<string, any>} */ (said)).flatMap(([key, message]) => {
    if (keyTime(key) === null) return [`${what}: "${key}" is no message's key — p or c and the time in epoch milliseconds`];
    const shaped = isObject(message) && typeof message.x === 'string' && (message.by === undefined || message.by === 'p' || message.by === 'c');
    return shaped ? [] : [`${what}: message ${key} is no message — {"by": "p"|"c", "x": "<text>"}`];
  });
}

/** The faults of one mark. @param {string} doc @param {string} id @param {unknown} mark @returns {string[]} */
function markFaults(doc, id, mark) {
  const what = `${doc}'s mark on ${id}`;
  if (!LINE_ID.test(id)) return [`${what}: ${id} is no line's id — a line's number with its dots as dashes, as 3-2-1, 3-S4 or 3-2-1-scr1`];
  if (!isObject(mark)) return [`${what} is no mark — a mark is {"s", "h", "t", "at"}`];
  const { s, h, t, at } = /** @type {Record<string, unknown>} */ (mark);
  return [
    ...(s !== undefined && !STATUSES.includes(/** @type {string} */ (s)) ? [`${what}: s is "tick", "comment" or empty`] : []),
    ...(h !== undefined && typeof h !== 'string' ? [`${what}: h is the fingerprint of the line's wording`] : []),
    ...(at !== undefined && typeof at !== 'string' ? [`${what}: at is when it was made`] : []),
    ...(t !== undefined ? conversationFaults(what, t) : []),
  ];
}

/**
 * The marks a file holds, by document: each `{"m": {…}}`, or saved by the
 * artifact store under `data`. Refuses a file it cannot read as the marks,
 * naming every fault.
 * @param {string} file @returns {Marks}
 */
function marksIn(file) {
  let given;
  try {
    given = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`${file} holds no marks: ${messageOf(err)}`);
  }
  if (!isObject(given)) throw new Error(`${file} holds no marks — the marks are the page's collection by document, {"s1": {"m": {…}}, …}`);
  /** @type {string[]} */
  const faults = [];
  /** @type {Marks} */
  const marks = {};
  for (const [doc, held] of Object.entries(/** @type {Record<string, any>} */ (given))) {
    const body = isObject(held) && isObject(held.data) ? held.data : held;
    if (!DOC.test(doc) || !isObject(body) || !isObject(body.m)) {
      faults.push(`${doc} is no document of the marks — each is s<N>, holding {"m": {…}}`);
      continue;
    }
    for (const [id, mark] of Object.entries(body.m)) faults.push(...markFaults(doc, id, mark));
    marks[doc] = { m: body.m };
  }
  if (faults.length > 0) throw new Error(faults.join('\n'));
  return marks;
}

/** A JSON file the engine keeps in the page's cache, or `none` where it holds none. @template T @param {string} file @param {T} none @returns {T} */
function cached(file, none) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : none;
}

/** The unit's stored marks, by document; none where none are stored. @param {string} cwd @param {string} unit @returns {Marks} */
const storedMarks = (cwd, unit) => cached(marksFile(cwd, unit), {});

/** Every mark, by line id. @param {Marks} marks @returns {Record<string, Mark>} */
const byLine = (marks) => Object.assign({}, ...Object.values(marks).map(({ m }) => m));

/** A line's conversation in order, its removed messages left out. @param {Mark} mark @returns {Said[]} */
function conversationOf({ t = {} }) {
  return Object.entries(t)
    .filter(([, { x }]) => x !== '')
    .map(([key, { by, x }]) => ({ at: /** @type {Date} */ (keyTime(key)), by: (by ?? key[0]) === 'p' ? 'person' : 'claude', text: x }))
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map(({ at, by, text }) => /** @type {Said} */ ({ by, at: at.toISOString(), text }));
}

/**
 * A line the spec holds as its marks leave it.
 * @param {SpecPage} page @param {SpecPage['lines'][number]} modelLine @param {Mark} mark @returns {Reviewed}
 */
function reviewedLine(page, { id, section, h, line }, mark) {
  const conversation = conversationOf(mark);
  const changed = mark.s === 'tick' && Boolean(mark.h) && mark.h !== h;
  const talking = mark.s === 'comment' || (changed && conversation.length > 0);
  /** @type {ReviewState} */
  let state = 'passed';
  if (changed) state = 'changed';
  else if (mark.s === 'tick') state = conversation.length > 0 ? 'approved-after-comment' : 'approved';
  else if (mark.s === 'comment') state = 'open';
  else if (page.ticks.get(id)?.v === 'soft' && !mark.h) state = 'claudes-tick';
  return { id, number: line.number, section, wording: line.wording, state, conversation, waiting: talking && conversation.at(-1)?.by === 'person' };
}

/**
 * Every line as the marks leave it: the spec's, in its order, then each the
 * spec no longer holds that the person ticked or commented on.
 * @param {SpecPage} page @param {Marks} marks @returns {Reviewed[]}
 */
function reviewOf(page, marks) {
  const marked = byLine(marks);
  const held = new Set(page.lines.map(({ id }) => id));
  const removed = Object.entries(marked).filter(([id, mark]) => !held.has(id) && (Boolean(mark.s) || conversationOf(mark).length > 0));
  return [
    ...page.lines.map((line) => reviewedLine(page, line, marked[line.id] ?? {})),
    ...removed.map(([id, mark]) => /** @type {Reviewed} */ ({ id, number: numberOf(id), section: null, wording: null, state: 'removed', conversation: conversationOf(mark), waiting: false })),
  ];
}

/** The comments waiting for Claude among reviewed lines. @param {Reviewed[]} reviewed @returns {Waiting[]} */
function waitingIn(reviewed) {
  return reviewed.filter(({ waiting }) => waiting).map(({ number, id, section, wording, conversation }) => ({
    number, id, doc: `s${section}`, wording: /** @type {string} */ (wording), conversation,
  }));
}

/**
 * Every line of the unit's spec as its stored marks leave it, then each
 * line removed after it was marked. Refuses what `specPage` refuses.
 * @param {string} cwd @param {string} unit @returns {Reviewed[]}
 */
function reviewStates(cwd, unit) {
  return reviewOf(specPage(cwd, unit), storedMarks(cwd, unit));
}

/** The record of reviewed lines written: its path from the state root. @param {string} cwd @param {string} unit @param {Reviewed[]} reviewed */
function writeRecord(cwd, unit, reviewed) {
  const rel = `${unit}/${REVIEW_FILE}`;
  writeJsonAtomic(statePath(cwd, rel), { lines: Object.fromEntries(reviewed.map(({ number, state, conversation }) => [number, { state, conversation }])) });
  return rel;
}

/** Why the unit's review page can neither be built nor its marks stored, before anything is read, or null. @param {string} cwd @param {string} unit @returns {string|null} */
function pageRefusal(cwd, unit) {
  if (workUnitNameRefusal(unit) !== null || manifestOf(stateRoot(cwd), unit) === null) return `there is no work unit "${unit}"`;
  const standing = specStanding(cwd, unit);
  if (standing === 'none') return `${unit} has no spec — its folder holds no ${SPEC_FILE}, and the page reviews the spec`;
  if (standing === 'concluded') return `${unit}'s spec is concluded — its review ended when the build began`;
  return null;
}

/**
 * The marks in `file` stored as the unit's, after every check: every line
 * as they leave it. Refuses, storing nothing, what `spec marks` refuses.
 * @param {string} cwd @param {string} unit @param {string} file absolute or from cwd @returns {Reviewed[]}
 */
function stored(cwd, unit, file) {
  const refused = pageRefusal(cwd, unit);
  if (refused !== null) throw new Error(refused);
  if (!pageOpen(cwd, unit)) throw new Error(`${unit}'s review page is not published — publish it, record it with spec published ${unit} <url>, then read its marks back`);
  const marks = marksIn(path.resolve(cwd, file));
  const reviewed = reviewOf(specPage(cwd, unit), marks);
  fs.mkdirSync(pageCache(cwd, unit), { recursive: true });
  writeJsonAtomic(marksFile(cwd, unit), marks);
  return reviewed;
}

/**
 * Store the marks Claude read back from the unit's review page, answering
 * the comments waiting for Claude.
 * @param {string} cwd @param {string} unit @param {string} file absolute or from cwd
 * @returns {{unit: string, waiting: Waiting[]}}
 */
function storeMarks(cwd, unit, file) {
  try {
    return { unit, waiting: waitingIn(stored(cwd, unit, file)) };
  } catch (err) {
    throw new Error(`spec marks: ${messageOf(err)}`);
  }
}

/**
 * The review settled at ready to build's yes, in one call: while the page
 * is open, the marks in `file` stored first, then the comments waiting for
 * Claude answered, and the record written from those marks only where none
 * waits (11.11.8); nothing while no page is open (11.S22). Refuses, writing
 * nothing, an open page with no marks given, and what `spec marks` refuses,
 * in its words without its opening. Commits nothing: the caller commits the
 * record.
 * @param {string} cwd @param {string} unit @param {string} [file] absolute or from cwd
 * @returns {Settled}
 */
function settleReview(cwd, unit, file) {
  if (!pageOpen(cwd, unit)) return { waiting: [], record: null };
  if (file === undefined) throw new Error(`${unit}'s review page is open, so the yes takes its marks — read them back from the page and give them as a file`);
  const reviewed = stored(cwd, unit, file);
  const waiting = waitingIn(reviewed);
  return { waiting, record: waiting.length > 0 ? null : writeRecord(cwd, unit, reviewed) };
}

/** Where a number stands among its siblings: what precedes its last digits, and those digits. @param {string} number */
function slotOf(number) {
  const [, place, k] = /** @type {RegExpExecArray} */ (/^(.*?)([0-9]+)$/.exec(number));
  return { place, k: Number(k) };
}

/**
 * The last of `numbers` at `place`, 0 where none sits there, and the next
 * free number there, past it.
 * @param {Iterable<string>} numbers @param {string} place @returns {{past: number, next: string}}
 */
function freeAt(numbers, place) {
  const past = Math.max(0, ...[...numbers].map(slotOf).filter((slot) => slot.place === place).map((slot) => slot.k));
  return { past, next: `${place}${past + 1}` };
}

/**
 * Every number the unit's open page holds, with the fingerprint of its last
 * wording — null for one only a mark without a fingerprint names — and the
 * numbers `landed`, the spec the state branch holds, gives.
 * @param {string} cwd @param {string} unit @param {string|null} landed
 * @returns {{held: Map<string, string|null>, live: Set<string>}}
 */
function heldNumbers(cwd, unit, landed) {
  /** @type {Map<string, string|null>} */
  const held = new Map(Object.entries(cached(heldFile(cwd, unit), { numbers: {} }).numbers));
  const live = landed === null ? [] : specReading(landed).lines;
  for (const { number, wording } of live) held.set(number, fingerprint(wording));
  for (const [id, mark] of Object.entries(byLine(storedMarks(cwd, unit)))) if (!held.has(numberOf(id))) held.set(numberOf(id), mark.h ?? null);
  return { held, live: new Set(live.map(({ number }) => number)) };
}

/**
 * The numbers the unit's open page holds, by where each sits — a part, an
 * area's scenarios or a line's screens — in the order first held, each
 * place's numbers in order with the next free one there; null while no page
 * is open.
 * @param {string} cwd @param {string} unit @returns {{held: string[], next: string}[]|null}
 */
function heldPlaces(cwd, unit) {
  if (!pageOpen(cwd, unit)) return null;
  const numbers = [...heldNumbers(cwd, unit, landedSpec(cwd, unit)).held.keys()];
  /** @type {Map<string, number[]>} */
  const places = new Map();
  for (const { place, k } of numbers.map(slotOf)) places.set(place, [...(places.get(place) ?? []), k]);
  return [...places].map(([place, ks]) => ({ held: ks.sort((a, b) => a - b).map((k) => `${place}${k}`), next: freeAt(numbers, place).next }));
}

/**
 * What a land of `lines` would change of the numbers the unit's open page
 * holds (11.11.3), one fault a line: a line whose wording another number
 * held, which no longer holds it; a number removed since the page opened
 * given to another line; and an added number not past every number held
 * where it sits. None while no page is open.
 * @param {string} cwd @param {string} unit @param {string|null} landed the spec the state branch holds @param {Line[]} lines
 * @returns {string[]}
 */
function heldNumberFaults(cwd, unit, landed, lines) {
  if (!pageOpen(cwd, unit)) return [];
  const { held, live } = heldNumbers(cwd, unit, landed);
  const now = new Map(lines.map(({ number, wording }) => [number, fingerprint(wording)]));
  return lines.flatMap(({ number }) => {
    const h = now.get(number);
    if (held.get(number) === h) return [];
    const moved = [...held].find(([other, was]) => other !== number && was === h && now.get(other) !== h);
    if (moved !== undefined) return [`${number} now holds the wording ${moved[0]} held — a number never changes while the review page is open: a line keeps its number, and a line added takes the next free one`];
    if (live.has(number)) return [];
    const { past, next } = freeAt(held.keys(), slotOf(number).place);
    if (held.has(number)) return [`${number} was removed while the review page is open, and its number is not given to another line — a line added takes the next free number, ${next}`];
    return slotOf(number).k > past ? [] : [`${number} is added while the review page is open — a line added takes the next free number, ${next}`];
  });
}

/**
 * Keep, while the unit's page is open, every number it holds after a land of
 * `lines` over `landed`, each with its last wording.
 * @param {string} cwd @param {string} unit @param {string|null} landed @param {Line[]} lines
 */
function holdNumbers(cwd, unit, landed, lines) {
  if (!pageOpen(cwd, unit)) return;
  const { held } = heldNumbers(cwd, unit, landed);
  for (const { number, wording } of lines) held.set(number, fingerprint(wording));
  writeJsonAtomic(heldFile(cwd, unit), { numbers: Object.fromEntries(held) });
}

module.exports = {
  MARKS_USAGE, REVIEW_FILE, marksFile, pageDir, publishedFile, publishedPage, readBackFile, openPage, pageOpen, pageRefusal, storeMarks, reviewStates, settleReview, heldPlaces, heldNumberFaults, holdNumbers,
};
