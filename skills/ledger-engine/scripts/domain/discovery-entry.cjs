'use strict';

// ---------------------------------------------------------------------------
// Domain ring: discovery's row of the entry (enter.cjs) — `enter discovery
// <product|unit> [--move] [--seeds <seeds>]`, at either of discovery's
// homes (8.2.7): the
// product's conversation, `product`, which has no manifest of its own, and
// an epic's discovery. Each is one conversation carried on from its row,
// with no question before its reads (8.2.10, 8.6.7, 8.8.12); whether an
// epic's can be entered is topic-standing.cjs's.
//
// The session (8.14.11): the entry carries on the home's open log, or opens
// the next where none is open, and writes the conversation's line into it
// where the log's last such line is another's (8.14.8), so the log always
// names who wrote last.
//
// What it reads, as it found the home before writing anything:
//   - the product's: its two latest logs holding talk in full — a log a
//     conversation opened and said nothing in never pushes the talk out of
//     what a return reads — or, once the conversation has written its
//     picture of where the product stands, the picture in full, the latest
//     closed log holding talk by its closing line, the open log in full
//     where it holds talk, as a conversation carrying the sitting on from
//     another reads it, and each unit started since that closed sitting's
//     first conversation began — or, with none closed, the open sitting's —
//     on its day or after, whichever door started it, with what the work
//     carries: an epic's points from before, else its first log, a
//     feature's or a bugfix's brief, a quick-fix's description; so a return
//     points the picture at work started without it; the
//     roadmap, the product record with the code's
//     findings, and whether the baseline's research is owed (8.2.10,
//     8.12.13) — where it starts work from seeds, the seeds and the picture
//     in place of the logs, and only those (18.8.15, seeds.cjs) — and
//     where this conversation writes start this work's payload, a file of
//     its own (`conversationFile`, start-this-work.cjs);
//   - an epic's: its older logs by their closing lines, its two latest
//     holding talk in full, the pointers its first log keeps into the product's sessions
//     (8.14.3), the points from before it carries (from-before.cjs), its map, and the product record with what discovery found of
//     the unit (8.6.7) — and, from seeds, each roadmap idea to take in
//     (18.8.4);
//   - either, where the open log was last written by another conversation:
//     that conversation's transcript, to catch the log up from its last write
//     onward, and at the product the picture with it, or one line that the
//     transcript is gone (8.14.9) — none where
//     the log ends on a level move's pointer, its talk carried on elsewhere,
//     nor where that conversation still holds the place live, writing its
//     own (18.4.21).
//
// The type call (`--type-call`, at the product alone): a piece of work
// brought to Start — in the person's words, from the start menu, or from
// what triage or the roadmap picked — takes its type call in no session of
// the product's conversation (8.2.9). Nothing is asked first, started,
// written or recorded: the conversation holds no place, so another window
// talking product is never asked about nor its session closed, and the
// call answers only what the type call reads — the roadmap, the live inbox,
// the seeds where the work starts from any, and the product's picture where
// it has one, to read and never write — and where the payload is written.
//
// The start menu's count of the product's conversation is of its logs
// holding talk too (`productConversation`, 18.2.13), with the date of the
// latest conversation they name.
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
const { PRODUCT_PICTURE } = require('./layout.cjs');
const { sessionLogs, activeSession, sessionLogsAt, openSession } = require('./discovery-session.cjs');
const { discoveryStanding } = require('./topic-standing.cjs');
const { readPosition, placeLine } = require('./position.cjs');
const { clearOwnQuietly, holdsLive } = require('./presence.cjs');
const { runningTranscript } = require('./conversation.cjs');
const { researchOwed } = require('./brownfield.cjs');
const { productCall, mapCall, namedConversations, isHeader, appendLine, topicLog } = require('./topic-log.cjs');
const { beyondLists } = require('./discovery-log.cjs');
const { assertSeeds, seedReads } = require('./seeds.cjs');
const { fromBeforeFile } = require('./from-before.cjs');
const { loadProjectManifest, loadManifest } = require('./reads.cjs');
const { briefFile } = require('./derivations.cjs');

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

/**
 * A file of the calling conversation's own in the product's discovery cache:
 * `{stem}-{session}.json`, or `{stem}.json` where no session is handed.
 * @param {string} cwd @param {string} stem
 */
function conversationFile(cwd, stem) {
  const sessionId = handedSession();
  return statePath(cwd, '.cache', PRODUCT, 'discovery', PRODUCT, sessionId === null ? `${stem}.json` : `${stem}-${sessionId}.json`);
}

/** Where this conversation writes start this work's payload, which its yes removes. @param {string} cwd */
const payloadFile = (cwd) => conversationFile(cwd, 'start-this-work-payload');

/** The DATA's line naming this conversation's payload. @param {string} cwd @returns {Line} */
const payloadLine = (cwd) => as('payload')(payloadFile(cwd));

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

/** A log's written lines, trimmed, blank lines left out. @param {string} file absolute */
function writtenLines(file) {
  return linesOf(file).map((line) => line.trim()).filter((line) => line !== '');
}

/**
 * A log's closing line: its last written line beyond the fixed lists that is
 * neither a conversation's line nor a pointer the engine wrote; null where
 * it has none.
 * @param {string} file absolute
 */
function closingLine(file) {
  return beyondLists(linesOf(file)).map((line) => line.trim()).filter((line) => line !== '' && !isHeader(line) && !line.startsWith(POINTER)).at(-1) ?? null;
}

/** A home's logs holding talk, in order: each with a written line of its own beyond the lines the engine keeps. @param {string} cwd @param {string} unit */
const talkLogs = (cwd, unit) => homeLogs(cwd, unit).filter((log) => closingLine(log) !== null);

/**
 * The product's conversation as the start menu names it (the header's): how
 * many sessions holding talk it has had, and the date of the latest
 * conversation they name — null while none names one.
 * @param {string} cwd @returns {{sessions: number, last: string|null}}
 */
function productConversation(cwd) {
  const logs = talkLogs(cwd, PRODUCT);
  const latest = logs.map((log) => namedConversations(log).at(-1)).filter((named) => named !== undefined).at(-1);
  return { sessions: logs.length, last: latest?.date ?? null };
}

/**
 * Whether a log ends on the pointer a level move wrote: the sitting there
 * ended cleanly, and what came after it is in the log moved to.
 * @param {string} file absolute
 */
const endsOnPointer = (file) => writtenLines(file).at(-1)?.startsWith(POINTER) === true;

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
 * gone. Nothing for a log opened by this entry, for one a level move left,
 * ending on its pointer, nor for one whose last writer holds the place live.
 * @param {Entering} at @returns {Line[]}
 */
function catchUp({ cwd, unit, started }) {
  if (started) return [];
  const log = statePath(cwd, logAt(unit, /** @type {string} */ (activeSession(cwd, unit))));
  const last = namedConversations(log).at(-1);
  if (last === undefined || last.session === handedSession() || endsOnPointer(log)) return [];
  if (holdsLive(cwd, unit, 'discovery', unit, last.session)) return [];
  const transcript = last.transcript !== null && fs.existsSync(last.transcript) ? last.transcript : runningTranscript(last.session);
  const pictured = unit === PRODUCT && pictureOf(cwd).length > 0;
  return [as('catch up')(transcript === null
    ? `the transcript of session ${last.session}, which last wrote the log, is gone — say so in one line, and carry on from the log${pictured ? ', bringing the picture up to date from it' : ''}`
    : `read ${transcript} from the log's last write onward, and add to the log${pictured ? ' and the picture what they are' : ' what it is'} missing`)];
}

/** The product's picture, where its conversation has written one. @param {string} cwd @returns {Line[]} */
function pictureOf(cwd) {
  const picture = statePath(cwd, PRODUCT_PICTURE);
  return fs.existsSync(picture) ? [as('picture')(picture)] : [];
}

/**
 * Where the product's conversation had got to (the header's): with its
 * picture, the picture, its latest closed sitting by its closing line, and
 * its open sitting in full where it holds talk; else its latest logs in
 * full.
 * @param {string} cwd @returns {Line[]}
 */
function productStanding(cwd) {
  const talk = talkLogs(cwd, PRODUCT);
  const picture = pictureOf(cwd);
  if (picture.length === 0) return talk.slice(-RECENT).map(as('session log'));
  const open = activeSession(cwd, PRODUCT);
  const openLog = open === null ? null : statePath(cwd, logAt(PRODUCT, open));
  const closed = talk.filter((log) => log !== openLog).at(-1);
  const opened = talk.filter((log) => log === openLog);
  return [
    ...picture,
    ...(closed === undefined ? [] : [as('latest sitting')(closedBy(closed))]),
    ...opened.map(as('session log')),
    ...startedSince(cwd, closed ?? opened[0]),
  ];
}

/**
 * What a unit started carries, where a return points the picture at it:
 * an epic's points from before, else its first log; a feature's or a
 * bugfix's brief; a quick-fix's description. Null where it holds none.
 * @param {string} cwd @param {string} unit @param {string} type @param {Record<string, any>} manifest
 * @returns {string|null}
 */
function carrierOf(cwd, unit, type, manifest) {
  if (type === 'quick-fix') return typeof manifest.description === 'string' ? `its description: ${manifest.description}` : null;
  const files = type === 'epic' ? [fromBeforeFile(cwd, unit), statePath(cwd, logAt(unit, '001'))] : [statePath(cwd, briefFile(unit, unit))];
  return files.find((file) => fs.existsSync(file)) ?? null;
}

/**
 * Each unit started on or after the day the sitting `since` names began,
 * by its first conversation — the latest closed one, or with none the open
 * one — `{unit} {type} — {what it carries}`, in the order the project
 * registered them; none where no sitting has talked.
 * @param {string} cwd @param {string|undefined} sitting absolute @returns {Line[]}
 */
function startedSince(cwd, sitting) {
  const since = sitting === undefined ? undefined : namedConversations(sitting)[0]?.date;
  if (since === undefined) return [];
  const units = Object.entries(loadProjectManifest(cwd)?.work_units ?? {});
  return units.flatMap(([unit, { work_type: type }]) => {
    const manifest = loadManifest(cwd, unit);
    if (typeof manifest?.created !== 'string' || manifest.created < since) return [];
    const carrier = carrierOf(cwd, unit, type, manifest);
    return [as('started since')(`${unit} ${type}${carrier === null ? '' : ` — ${carrier}`}`)];
  });
}

/**
 * What the product's conversation reads (8.2.10): from seeds, the seeds in
 * place of its logs, beside its picture (18.8.15).
 * @param {Entering} at @returns {Line[]}
 */
function productReads(at) {
  return [
    ...(at.seeds === null ? productStanding(at.cwd) : [...seedReads(at.cwd, PRODUCT, at.seeds), ...pictureOf(at.cwd)]),
    as('roadmap')(`\`${ENGINE_COMMAND} roadmap state\``),
    as('product')(`\`${productCall()}\``),
    as('research owed')(researchOwed(at.manifest) ? 'yes' : 'no'),
    payloadLine(at.cwd),
    ...catchUp(at),
  ];
}

/** What an epic's discovery reads (8.6.7, 8.14.3), and each roadmap idea its seeds take in (18.8.4). @param {Entering} at @returns {Line[]} */
function epicReads(at) {
  const talk = talkLogs(at.cwd, at.unit);
  return [
    ...talk.slice(0, -RECENT).map((log) => as('older log')(closedBy(log))),
    ...talk.slice(-RECENT).map(as('session log')),
    ...shapedBy(homeLogs(at.cwd, at.unit)[0]).map(as('shaped by')),
    ...[fromBeforeFile(at.cwd, at.unit)].filter((file) => fs.existsSync(file)).map(as('from before')),
    as('map')(`\`${mapCall(at.unit)}\``),
    as('product')(`\`${productCall(at.unit)}\``),
    ...(at.seeds === null ? [] : seedReads(at.cwd, at.unit, at.seeds)),
    ...catchUp(at),
  ];
}

/**
 * What the type call reads (the header's): the seeds where the work starts
 * from any, the product's picture where it has one, the roadmap and the
 * live inbox — refused at an epic, whose discovery shapes work already
 * started.
 * @param {Standing} at @param {string|null} seeds @returns {Line[]}
 */
function typeCallReads({ cwd, unit }, seeds) {
  if (unit !== PRODUCT) throw new Error(`the type call is the product's, for work not yet started — "${unit}" is started: enter discovery ${unit}`);
  return [
    ...(seeds === null ? [] : seedReads(cwd, PRODUCT, seeds)),
    ...pictureOf(cwd),
    as('roadmap')(`\`${ENGINE_COMMAND} roadmap state\``),
    as('inbox')(statePath(cwd, '.inbox')),
    payloadLine(cwd),
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
  seeds: ({ cwd, unit }, seeds) => { assertSeeds(cwd, unit, seeds); },
  typeCall: typeCallReads,
});

module.exports = { DISCOVERY, SHAPED_BY, productConversation, conversationFile, payloadFile, shapedBy };
