'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the conversations a place's entry names to catch up on — the
// DATA's `catch up` lines (enter.cjs). A person often leaves on their own
// turn: Claude has just said something, and the window closes. The next
// conversation at the place has what the place keeps, but neither that last
// word nor what was agreed that never reached it; the transcripts of the
// conversations before it have both.
//
// Every place an entry enters keeps the conversations that entered it, in
// its cache, `.cache/{unit}/{phase}/{topic}/conversations.json`, the
// product's conversation's at `product/discovery/product` as its presence
// is: `{conversations: [{session, transcript, told}]}`, in the order they
// last entered — each conversation's session id, its transcript where one
// is found, and whether an entry has named it since it last entered. Each
// entry names every row not yet told, but its own and those of a
// conversation still holding the place live (presence.cjs, read once) —
// read as the place stood before the entry wrote anything (`owedAt`) —
// oldest first, by its transcript — its own where it still stands, else
// the one Claude Code keeps under its id — or by one line that the
// transcript is gone; then, its writes done, marks each it named told and
// records itself (`caughtUp`), untold, one row a conversation, moved last
// as it enters again, never changing another's mark. So each conversation
// that ended is named once, to the next that enters; one still live is
// named to the first entry after it ends, but where an entry takes the
// place over (`--take`), which names the one it takes from, live as it is.
// An entry that started its place names none and marks every row told. A
// row is marked told as it is named, not as it is read: a compaction in the
// middle of the read loses that catch-up, which is accepted.
//
// A conversation arriving at another place through `arriveAt`
// (session-label.cjs) has its own row at the place it was at marked told:
// its talk from then on belongs where it went. Those arrivals are an entry,
// a level move among them, `session label`, the epic's menu or the roadmap
// drawn, and a unit's finish or cancel returning the conversation to where
// its start was made (topic-leave.cjs). A conversation that left another
// way — the start menu drawn, or boot, each dropping its position — keeps
// its row untold, and is still named to the next entry, the framework
// bounding that read to as far as it stayed here. A conversation resumed
// (`claude --resume`) has its row at its position's place recorded again,
// untold and last (`resumedAt`, by `session resume`), labels on or off: it
// never enters again, and the next entry names what it said once resumed.
// A call with no session id names and records nothing; nor does a type
// call, which takes no place (enter.cjs).
//
// The last `KEPT` rows are kept, the oldest told one going first; where none
// is told, the oldest goes unnamed. Each read-modify-write holds the lock
// beside the file, the last lock a process takes. A row of another shape is
// passed over. Gitignored, in no commit; the file's absence is none
// recorded.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { writeJsonAtomic, withStateLockFile } = require('../kernel/manifest-io.cjs');
const { statePath } = require('../kernel/state-root.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { runningTranscript } = require('./conversation.cjs');
const { heldLive } = require('./presence.cjs');

/** @typedef {import('./enter.cjs').Line} Line */

/** A conversation a place keeps (the header's). @typedef {{session: string, transcript: string|null, told: boolean}} Row */

/** How many conversations a place keeps. */
const KEPT = 5;

/** Whether a value is a row. @param {unknown} row @returns {row is Row} */
function isRow(row) {
  if (row === null || typeof row !== 'object') return false;
  const { session, transcript, told } = /** @type {Record<string, unknown>} */ (row);
  return typeof session === 'string' && (transcript === null || typeof transcript === 'string') && typeof told === 'boolean';
}

/** The rows at `file`, those of another shape passed over; none where it does not read. @param {string} file absolute @returns {Row[]} */
function rowsIn(file) {
  try {
    const { conversations } = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(conversations) ? conversations.filter(isRow) : [];
  } catch {
    return [];
  }
}

/** The last `KEPT` of `rows`, the oldest told going first. @param {Row[]} rows @returns {Row[]} */
function kept(rows) {
  if (rows.length <= KEPT) return rows;
  const told = rows.findIndex((row) => row.told);
  return kept(rows.filter((_, at) => at !== Math.max(told, 0)));
}

/** Where a place keeps its conversations. @param {string} cwd @param {string} unit @param {string} phase @param {string} place */
const rowsFile = (cwd, unit, phase, place) => statePath(cwd, '.cache', unit, phase, place, 'conversations.json');

/**
 * Change a place's rows under the lock beside them, answering what `change`
 * does.
 * @template T
 * @param {string} cwd @param {string} unit @param {string} phase @param {string} place
 * @param {(rows: Row[]) => {rows: Row[], value: T}} change
 * @returns {T}
 */
function withRows(cwd, unit, phase, place, change) {
  const file = rowsFile(cwd, unit, phase, place);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return withStateLockFile(`${file}.lock`, () => {
    const { rows, value } = change(rowsIn(file));
    writeJsonAtomic(file, { conversations: kept(rows) });
    return value;
  }, { name: 'the conversations lock' });
}

/** `rows` with the conversation `session` recorded last, untold (the header's). @param {Row[]} rows @param {string} session @returns {Row[]} */
const recordedLast = (rows, session) => [...rows.filter((row) => row.session !== session), { session, transcript: runningTranscript(session), told: false }];

/** The line naming a conversation to catch up on (the header's). @param {Row} row @returns {Line} */
function caughtUpOn({ session, transcript }) {
  const found = transcript !== null && fs.existsSync(transcript) ? transcript : runningTranscript(session);
  return ['catch up', found ?? `the transcript of session ${session} is gone — say so in one line, and carry on from what this place keeps`];
}

/**
 * The conversations a place owes the calling conversation, as the place
 * stands before its entry writes anything: each row not yet told, but its
 * own and, but where the entry is a `take`, those still holding the place
 * live (the header's).
 * @param {string} cwd @param {string} unit @param {string} phase @param {string} place @param {boolean} take
 * @returns {Row[]}
 */
function owedAt(cwd, unit, phase, place, take) {
  const own = handedSession();
  if (own === null) return [];
  const untold = rowsIn(rowsFile(cwd, unit, phase, place)).filter((row) => !row.told && row.session !== own);
  if (take || untold.length === 0) return untold;
  const live = heldLive(cwd, unit, phase, place);
  return untold.filter((row) => !live.has(row.session));
}

/**
 * The calling conversation entered at a place (the header's): the lines
 * naming each conversation `owed`, those marked told — or, where the entry
 * `started` the place, none, every row marked told — and itself recorded.
 * @param {string} cwd @param {string} unit @param {string} phase @param {string} place @param {boolean} started @param {Row[]} owed
 * @returns {Line[]}
 */
function caughtUp(cwd, unit, phase, place, started, owed) {
  const own = handedSession();
  if (own === null) return [];
  const named = started ? [] : owed;
  const told = (/** @type {Row} */ row) => started || named.some(({ session }) => session === row.session);
  return withRows(cwd, unit, phase, place, (rows) => ({
    rows: recordedLast(rows.map((row) => (told(row) ? { ...row, told: true } : row)), own),
    value: named.map(caughtUpOn),
  }));
}

/**
 * The calling conversation moved on from a place to another: its own row
 * there marked told, where it has one (the header's).
 * @param {string} cwd @param {{unit: string, phase: string, topic: string}} left
 */
function movedOn(cwd, { unit, phase, topic }) {
  const own = handedSession();
  if (own === null || !rowsIn(rowsFile(cwd, unit, phase, topic)).some((row) => row.session === own)) return;
  withRows(cwd, unit, phase, topic, (rows) => ({ rows: rows.map((row) => (row.session === own ? { ...row, told: true } : row)), value: undefined }));
}

/**
 * The conversation `session` resumed at a place it was last at: recorded
 * there again, untold and last (the header's).
 * @param {string} cwd @param {string} session @param {{unit: string, phase: string, topic: string}} at
 */
function resumedAt(cwd, session, { unit, phase, topic }) {
  withRows(cwd, unit, phase, topic, (rows) => ({ rows: recordedLast(rows, session), value: undefined }));
}

module.exports = { owedAt, caughtUp, movedOn, resumedAt };
