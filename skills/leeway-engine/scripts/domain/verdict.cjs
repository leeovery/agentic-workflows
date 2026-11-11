'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the verdict verbs (6.1.6) — the verdict queue, and a verdict
// given on a departure (16.10).
//
// - `verdict queue` answers the departures this machine logged waiting on a
//   verdict, each with where it stands and Claude's lean
//   (ledger-verdicts.cjs): the ledger read as the ledger's reads are
//   (ledger-read.cjs) through the trust log's evidence (trust-evidence.cjs),
//   holding no lock.
// - `verdict give <entry> <verdict> --at <point>` logs the verdict in the
//   trust log (16.10.9): the entry named by a prefix of its id, as a ledger
//   link names one; the verdict nothing, a fix later, a real loss, or a
//   skip; the point a topic's decided screen, ready to build, an
//   investigation's conclusion, the finish gate, a quick-fix's close
//   (16.10.10, 16.10.11), or the queue (16.10.7). It refuses an entry the
//   ledger holds as no departure (16.10.1); a departure this machine logged
//   none for: one made on another machine, whose verdict is given there
//   (16.13.1), or the person's replacement of their own departure, still
//   against the lean, which is owed none; a departure made in a place no
//   longer live, which the queue leaves out (ledger-verdicts.cjs); and a
//   departure whose latest verdict is no skip: a skip waits in the queue
//   for the verdict that follows it, and a verdict given is corrected as a
//   correction (16.15.4), never given again — a verdict waiting in any
//   conversation for the trust log among them, which the queue leaves out
//   too. The departures and the verdicts are read in one pass
//   (trust-evidence.cjs).
//   It holds the writer lock (engine.cjs), so a peer's verdict on the same
//   departure never lands between the check and the append, and writes
//   nothing the state holds. An append that fails is a warning, the event
//   waiting in the conversation (trust-log.cjs). Given at the queue, it
//   answers where the page leads next (projections/verdict-page.cjs).
// - `render verdicts` draws the verdict page (16.10.7): the queue's first
//   departure, read as the queue is, with the skip it waits after, the
//   trust log read once for both — no other project's, nor another
//   machine's (16.10.12, 16.18.7). Its words are the ledger's, the trust
//   log holding none. With nothing waiting it renders empty.
// ---------------------------------------------------------------------------

const { messageOf } = require('../kernel/call.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { loadManifest } = require('./reads.cjs');
const { topicTitle } = require('./derivations.cjs');
const { projectName } = require('./state-checks.cjs');
const { carrying } = require('./ledger.cjs');
const { resolveId, shortId } = require('./ledger-ids.cjs');
const { ID_FACTS, foldLedger, whyDead, standingOf } = require('./ledger-fold.cjs');
const { liveness } = require('./ledger-units.cjs');
const { readShown } = require('./ledger-read.cjs');
const { isDeparture, queueOf, departureOf, answerQueue } = require('./ledger-verdicts.cjs');
const { record, readProjectEvents } = require('./trust-log.cjs');
const { evidenceIn, evidenceOf } = require('./trust-evidence.cjs');
const { VERDICTS, VERDICT_POINTS } = require('./trust-events.cjs');
const { MENUS, drawMenu } = require('./menus.cjs');
const { verdictPage, afterVerdict } = require('./projections/verdict-page.cjs');

/** @typedef {import('./ledger-read.cjs').Shower} Shower */
/** @typedef {import('./trust-evidence.cjs').Evidence} Evidence */
/** @typedef {import('./projections/verdict-page.cjs').VerdictPage} VerdictPage */

const QUEUE_USAGE = 'verdict queue';
const GIVE_USAGE = `verdict give <entry> <${VERDICTS.join('|')}> --at <${VERDICT_POINTS.join('|')}>`;

/** The verdict verbs' usage, a line each. */
const VERDICT_USAGE = [QUEUE_USAGE, GIVE_USAGE].join('\n');

/**
 * `answer`'s answer, with what it said on the way as warnings, which a
 * refusal carries too.
 * @param {(warnings: string[]) => Record<string, unknown>} answer
 * @returns {Record<string, unknown>}
 */
function warned(answer) {
  /** @type {string[]} */
  const warnings = [];
  try {
    const answered = answer(warnings);
    return warnings.length > 0 ? { ...answered, warnings } : answered;
  } catch (err) {
    throw carrying(err, warnings);
  }
}

/**
 * `verdict queue`: the departures waiting on a verdict.
 * @param {string} cwd @param {string[]} args
 */
function verdictQueue(cwd, args) {
  if (args.length > 0) throw new Error(`Usage: engine ${QUEUE_USAGE}`);
  return warned((warnings) => {
    const root = stateRoot(cwd);
    return readShown(root, warnings, (shower) => answerQueue(shower, root));
  });
}

/**
 * A verdict's argv read: the entry's prefix, the verdict and the point.
 * Refuses argv of another shape, a verdict outside the four, and a point
 * no verdict is given at.
 * @param {string[]} args
 * @returns {{prefix: string, verdict: string, point: string}}
 */
function readGive(args) {
  const at = args.indexOf('--at');
  const positional = at === -1 ? args : [...args.slice(0, at), ...args.slice(at + 2)];
  const point = at === -1 ? undefined : args[at + 1];
  if (positional.length !== 2 || point === undefined || [...positional, point].some((arg) => arg.startsWith('--'))) {
    throw new Error(`Usage: engine ${GIVE_USAGE}`);
  }
  const [prefix, verdict] = positional;
  if (!VERDICTS.includes(verdict)) throw new Error(`verdict give: "${verdict}" is no verdict — ${VERDICTS.join(', ')}`);
  if (!VERDICT_POINTS.includes(point)) throw new Error(`verdict give: --at names "${point}", where no verdict is given — ${VERDICT_POINTS.join(', ')}`);
  return { prefix, verdict, point };
}

/**
 * `verdict give`: the verdict logged on the departure the prefix names.
 * Answers the entry by its short id, the verdict and the point.
 * @param {string} cwd @param {string[]} args
 */
function giveVerdict(cwd, args) {
  const { prefix, verdict, point } = readGive(args);
  return warned((warnings) => {
    const root = stateRoot(cwd);
    const folded = { facts: foldLedger(root, ID_FACTS, warnings), live: liveness(root) };
    let id;
    try {
      id = resolveId(prefix, folded.facts.keys());
    } catch (err) {
      throw new Error(`verdict give: ${messageOf(err)}`);
    }
    const entry = shortId(id, folded.facts.keys());
    if (!isDeparture(folded, id)) throw new Error(`verdict give: ${entry} is no departure — a verdict is given on the person's answer that stood over Claude's lean`);
    const { departures, judged } = evidenceOf(root);
    if (!departures.has(id)) throw new Error(`verdict give: ${entry} is no departure this machine logged — a departure's verdict is given on the machine where it was made, and the person's replacement of their own departure is owed none`);
    const dead = whyDead(folded, id);
    if (dead !== null) throw new Error(`verdict give: ${entry} is owed no verdict — ${dead}, so the departure is no longer live`);
    if (judged.has(id)) throw new Error(`verdict give: ${entry} has its verdict — only a skip waits for one, and a verdict given is corrected, never given again`);
    record('verdict', { entry: id, verdict, point }, { cwd, warnings });
    if (point !== 'queue') return { entry, verdict, point };
    const left = queueOf(folded, { departures, judged: verdict === 'skip' ? judged : new Set([...judged, id]) });
    return { entry, verdict, point, next: afterVerdict(left.length) };
  });
}

/**
 * The skip a departure waits after, by its point and time: the latest
 * given on it, the trust log's order breaking a tie; null where it was
 * never asked.
 * @param {Record<string, unknown>[]} events @param {string} id
 * @returns {{point: string, at: string}|null}
 */
function skipOf(events, id) {
  const skips = events.filter(({ type, entry, verdict }) => type === 'verdict' && entry === id && verdict === 'skip');
  const latest = skips.reduce((last, event) => (Date.parse(/** @type {string} */ (event.at)) >= Date.parse(/** @type {string} */ (last.at)) ? event : last), skips[0]);
  return latest === undefined ? null : { point: /** @type {string} */ (latest.point), at: /** @type {string} */ (latest.at) };
}

/**
 * The name of the place an entry was made in: the name its topic goes by,
 * or its unit's where it has no topic of its own.
 * @param {string} cwd @param {{unit: string, topic: string|null}} standing
 */
function placeName(cwd, { unit, topic }) {
  return topicTitle(loadManifest(cwd, unit), topic ?? unit);
}

/**
 * The verdict page's view: the queue's first departure; null where none
 * waits.
 * @param {string} cwd @param {Shower} shower @param {Evidence} evidence @param {Record<string, unknown>[]} events
 * @returns {VerdictPage|null}
 */
function pageOf(cwd, shower, evidence, events) {
  const queue = queueOf(shower.folded, evidence);
  if (queue.length === 0) return null;
  const [id] = queue;
  return {
    project: projectName(cwd),
    place: placeName(cwd, standingOf(shower.folded, id)),
    departure: departureOf(shower, id),
    made: /** @type {string} */ (shower.show(id).at),
    skipped: skipOf(events, id),
    waiting: queue.length,
  };
}

/**
 * `render verdicts`: the verdict page (the header's).
 * @param {string} cwd
 * @returns {string}
 */
function verdictsSurface(cwd) {
  /** @type {string[]} */
  const warnings = [];
  try {
    const root = stateRoot(cwd);
    /** @type {Record<string, unknown>[]} */
    const events = [];
    readProjectEvents(root, (event) => events.push(event));
    const view = readShown(root, warnings, (shower) => pageOf(cwd, shower, evidenceIn(events), events));
    return view === null ? '' : drawMenu(cwd, MENUS.verdicts, {}, verdictPage(view));
  } catch (err) {
    throw carrying(err, warnings);
  }
}

/** @type {Readonly<Record<string, (cwd: string, args: string[]) => Record<string, unknown>>>} */
const VERBS = Object.freeze({ queue: verdictQueue, give: giveVerdict });

/**
 * `verdict <queue|give>`: the verb's answer.
 * @param {string} cwd @param {string} verb @param {string[]} args
 */
function runVerdictVerb(cwd, verb, args) {
  if (!Object.hasOwn(VERBS, verb)) throw new Error(`Usage: engine verdict <${Object.keys(VERBS).join('|')}> …\n${VERDICT_USAGE}`);
  return VERBS[verb](cwd, args);
}

module.exports = { VERDICT_USAGE, runVerdictVerb, verdictsSurface };
