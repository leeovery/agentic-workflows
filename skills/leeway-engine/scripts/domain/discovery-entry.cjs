'use strict';

// ---------------------------------------------------------------------------
// Domain ring: discovery's row of the entry (enter.cjs) — `enter discovery
// <product|unit> [--move]`, at either of discovery's homes (8.2.7): the
// product's conversation, `product`, which has no manifest of its own, and
// an epic's discovery. Each is one conversation carried on from its row,
// with no question before its reads (8.2.10, 8.6.7, 8.8.12); whether an
// epic's can be entered is topic-standing.cjs's.
//
// The session (8.14.11): the entry carries on the home's open log, or opens
// the next where none is open, and writes the conversation's line into it on
// its first entry (8.14.8), so the log always names who wrote last.
//
// What it reads, as it found the home before writing anything:
//   - the product's: its two latest logs in full, the roadmap, the product
//     record with the code's findings, and whether the baseline's research
//     is owed (8.2.10, 8.12.13);
//   - an epic's: its older logs by their closing lines, its two latest in
//     full, the pointers its first log keeps into the product's sessions
//     (8.14.3), its map, and the product record with what discovery found of
//     the unit (8.6.7);
//   - either, where the open log was last written by another conversation:
//     that conversation's transcript, to catch the log up from its last write
//     onward, or one line that the transcript is gone (8.14.9).
//
// A level move (`--move`) carries the conversation on from where it is
// working — the product's conversation, an epic's discovery, or a topic's
// discussion of the epic moved to — in the same session, with no handoff
// (8.2.11, 8.2.12, 24.1.8): the first home's log ends on a pointer to the
// second's, a topic's sitting is committed, and the presence moves with the
// position.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { PRODUCT } = require('../kernel/manifest-schema.cjs');
const { ENGINE_COMMAND } = require('../kernel/call.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { statePath } = require('../kernel/state-root.cjs');
const { sessionLogs, activeSession, sessionLogsAt, openSession } = require('./discovery-session.cjs');
const { discoveryStanding } = require('./topic-standing.cjs');
const { readPosition, placeLine } = require('./position.cjs');
const { clearOwnQuietly } = require('./presence.cjs');
const { runningTranscript } = require('./conversation.cjs');
const { researchOwed } = require('./baseline.cjs');
const { productCall, mapCall, namedConversations, isHeader, appendLine, topicLog } = require('./topic-log.cjs');

/** @typedef {import('./enter.cjs').Entry} Entry */
/** @typedef {import('./enter.cjs').Entering} Entering */
/** @typedef {import('./enter.cjs').Line} Line */
/** @typedef {import('./enter.cjs').Departure} Departure */
/** @typedef {import('./topic-standing.cjs').Standing} Standing */
/** @typedef {import('./position.cjs').Position} Position */

/** How many of a home's latest logs are read in full. */
const RECENT = 2;

/** What opens the pointer a home's log ends on where the conversation moved to another. */
const POINTER = '→ Carried on in ';

/** What opens each line of a unit's first log that points into the product's sessions (8.14.3). */
const SHAPED_BY = 'Shaped by: ';

/** A markdown link's target. */
const LINK = /\]\(\s*<?([^)>\s]+)>?\s*\)/;

/** @param {string} key @returns {(value: string) => Line} */
const as = (key) => (value) => [key, value];

/** A home named for the person: the product's conversation, or an epic's discovery. @param {string} unit */
const homeTitle = (unit) => (unit === PRODUCT ? 'the product\'s conversation' : `the discovery of "${unit}"`);

/** A home's log, state-relative. @param {string} unit @param {string} session */
const logAt = (unit, session) => `${sessionLogsAt(unit)}/session-${session}.md`;

/** A home's logs on disk, in order, as absolute paths. @param {string} cwd @param {string} unit */
function homeLogs(cwd, unit) {
  const dir = statePath(cwd, sessionLogsAt(unit));
  return sessionLogs(dir).map(({ file }) => path.join(dir, file));
}

/** A file's lines, none where it is not there. @param {string} file absolute */
function linesOf(file) {
  try {
    return fs.readFileSync(file, 'utf8').split('\n');
  } catch {
    return [];
  }
}

/**
 * A log's closing line: its last written line that is neither a
 * conversation's line nor a pointer the engine wrote; null where it has none.
 * @param {string} file absolute
 */
function closingLine(file) {
  return linesOf(file).map((line) => line.trim()).filter((line) => line !== '' && !isHeader(line) && !line.startsWith(POINTER)).at(-1) ?? null;
}

/** An older log as read: its path, and its closing line where it has one. @param {string} file absolute */
function closedBy(file) {
  const closing = closingLine(file);
  return closing === null ? file : `${file} — ${closing}`;
}

/**
 * Each place in the product's sessions a unit's first log points at: a
 * link's target as an absolute path, read from the log's folder, its anchor
 * kept; a pointer that is no link, as written.
 * @param {string|undefined} first absolute
 * @returns {string[]}
 */
function shapedBy(first) {
  if (first === undefined) return [];
  return linesOf(first).filter((line) => line.startsWith(SHAPED_BY)).map((line) => {
    const target = LINK.exec(line)?.[1];
    return target === undefined ? line.slice(SHAPED_BY.length).trim() : path.resolve(path.dirname(first), target);
  });
}

/**
 * Where the open log was last written by a conversation other than this
 * one: its transcript, to catch the log up from, or the one line that it is
 * gone. Nothing for a log opened by this entry.
 * @param {Entering} at @returns {Line[]}
 */
function catchUp({ cwd, unit, started }) {
  if (started) return [];
  const last = namedConversations(statePath(cwd, logAt(unit, /** @type {string} */ (activeSession(cwd, unit))))).at(-1);
  if (last === undefined || last.session === handedSession()) return [];
  const transcript = last.transcript !== null && fs.existsSync(last.transcript) ? last.transcript : runningTranscript(last.session);
  return [as('catch up')(transcript === null
    ? `the transcript of session ${last.session}, which last wrote the log, is gone — say so in one line, and carry on from the log`
    : `read ${transcript} from the log's last write onward, and add to the log what it is missing`)];
}

/** What the product's conversation reads (8.2.10). @param {Entering} at @returns {Line[]} */
function productReads(at) {
  return [
    ...homeLogs(at.cwd, PRODUCT).slice(-RECENT).map(as('session log')),
    as('roadmap')(`\`${ENGINE_COMMAND} roadmap state\``),
    as('product')(`\`${productCall()}\``),
    as('research owed')(researchOwed(at.manifest) ? 'yes' : 'no'),
    ...catchUp(at),
  ];
}

/** What an epic's discovery reads (8.6.7, 8.14.3). @param {Entering} at @returns {Line[]} */
function epicReads(at) {
  const logs = homeLogs(at.cwd, at.unit);
  return [
    ...logs.slice(0, -RECENT).map((log) => as('older log')(closedBy(log))),
    ...logs.slice(-RECENT).map(as('session log')),
    ...shapedBy(logs[0]).map(as('shaped by')),
    as('map')(`\`${mapCall(at.unit)}\``),
    as('product')(`\`${productCall(at.unit)}\``),
    ...catchUp(at),
  ];
}

/**
 * The pointer the first home's log ends on: the home the conversation went
 * to, and its log, linked from the first.
 * @param {string} from absolute @param {string} to absolute @param {string} unit the home gone to
 */
function pointerLine(from, to, unit) {
  const link = path.relative(path.dirname(from), to).split(path.sep).join('/');
  return `${POINTER}${homeTitle(unit)}: [${path.basename(to)}](${link})`;
}

/**
 * Leaving one of discovery's homes: its open log ends on the pointer, and
 * its presence goes.
 * @param {string} cwd @param {string} home @param {Position} from @returns {Departure}
 */
function homeDeparture(cwd, home, from) {
  const session = activeSession(cwd, home);
  const log = session === null ? null : statePath(cwd, logAt(home, session));
  return {
    line: placeLine(from, ' › '),
    logs: log === null ? [] : [log],
    leave: (to, unit) => {
      if (log !== null) appendLine(log, pointerLine(log, to, unit));
      clearOwnQuietly(cwd, home, 'discovery', home);
    },
  };
}

/**
 * Leaving a topic's discussion: its sitting, the log, committed with the
 * move, and its presence gone.
 * @param {string} cwd @param {string} unit @param {string} topic @param {Position} from @returns {Departure}
 */
function topicDeparture(cwd, unit, topic, from) {
  const log = statePath(cwd, topicLog(unit, topic));
  return {
    line: placeLine(from, ' › '),
    logs: fs.existsSync(log) ? [log] : [],
    leave: () => clearOwnQuietly(cwd, unit, 'discussion', topic),
  };
}

/** Whether a position is the home `unit` names. @param {Position} at @param {string} unit */
function isHome(at, unit) {
  return unit === PRODUCT ? at.name === PRODUCT && at.phase === undefined : at.name === unit && at.phase === 'discovery';
}

/**
 * Where a level move leaves from — the conversation's position — refused
 * where it holds none, is in the home moved to already, is a topic moving to
 * another epic than its own, or is anywhere but discovery or a topic's
 * discussion.
 * @param {Standing} at @returns {Departure}
 */
function departure({ cwd, unit }) {
  const sessionId = handedSession();
  const from = sessionId === null ? null : readPosition(sessionId);
  if (from === null) throw new Error(`a level move carries this conversation on from where it is working, and it holds no place — enter without --move: engine enter discovery ${unit}`);
  if (isHome(from, unit)) throw new Error(`this conversation is in ${homeTitle(unit)} already — carry on there`);
  if (isHome(from, PRODUCT)) return homeDeparture(cwd, PRODUCT, from);
  if (from.phase === 'discovery') return homeDeparture(cwd, from.name, from);
  if (from.phase === 'discussion' && typeof from.topic === 'string') {
    if (unit !== PRODUCT && unit !== from.name) {
      throw new Error(`a topic's talk moves up to its own epic's discovery or the product's conversation — "${from.topic}" is a topic of "${from.name}"`);
    }
    return topicDeparture(cwd, from.name, from.topic, from);
  }
  throw new Error(`a level move carries the conversation on from discovery or a topic's discussion — this one is working in ${placeLine(from, ' › ')}; enter without --move`);
}

/** @type {Entry} */
const DISCOVERY = Object.freeze({
  level: /** @type {const} */ ('unit'),
  product: true,
  standing: discoveryStanding,
  unstarted: ({ cwd, unit }) => activeSession(cwd, unit) === null,
  start: (cwd, unit) => { openSession(cwd, unit); },
  questions: () => [],
  reads: (at) => (at.unit === PRODUCT ? productReads(at) : epicReads(at)),
  log: ({ cwd, unit }) => logAt(unit, /** @type {string} */ (activeSession(cwd, unit))),
  writesHeader: true,
  move: departure,
});

module.exports = { DISCOVERY, POINTER, SHAPED_BY };
