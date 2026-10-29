'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the verdict verbs (6.1.6) — the verdict queue, and a verdict
// given on a departure (16.10).
//
// - `verdict queue` answers the departures waiting on a verdict, each with
//   where it stands and Claude's lean (ledger-verdicts.cjs): a projection of
//   the ledger, read as the ledger's reads are (ledger-read.cjs), holding no
//   lock.
// - `verdict give <entry> <verdict> --at <point>` logs the verdict in the
//   trust log (16.10.9): the entry named by a prefix of its id, as a ledger
//   link names one; the verdict nothing, a fix later, a real loss, or a
//   skip; the point a topic's decided screen, ready to build, an
//   investigation's conclusion, the finish gate, a quick-fix's close
//   (16.10.10, 16.10.11), or the queue (16.10.7). It refuses an entry that
//   is no departure (16.10.1), a departure made in a place no longer live,
//   which the queue leaves out (ledger-verdicts.cjs), and a departure whose
//   latest verdict is no skip: a skip waits in the queue for the verdict that follows it, and a
//   verdict given is corrected as a correction (16.15.4), never given again
//   — a verdict waiting in any conversation for the trust log among them,
//   which the queue leaves out too (trust-log.cjs).
//   It holds the writer lock (engine.cjs), so a peer's verdict on the same
//   departure never lands between the check and the append, and writes
//   nothing the state holds. An append that fails is a warning, the event
//   waiting in the conversation (trust-log.cjs).
// ---------------------------------------------------------------------------

const { messageOf } = require('../kernel/call.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { carrying } = require('./ledger.cjs');
const { resolveId, shortId } = require('./ledger-ids.cjs');
const { ID_FACTS, foldLedger, whyDead } = require('./ledger-fold.cjs');
const { liveness } = require('./ledger-units.cjs');
const { readShown } = require('./ledger-read.cjs');
const { isDeparture, answerQueue } = require('./ledger-verdicts.cjs');
const { record, judgedDepartures } = require('./trust-log.cjs');
const { VERDICTS, VERDICT_POINTS } = require('./trust-events.cjs');

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
    const dead = whyDead(folded, id);
    if (dead !== null) throw new Error(`verdict give: ${entry} is owed no verdict — ${dead}, so the departure is no longer live`);
    if (judgedDepartures(root).has(id)) throw new Error(`verdict give: ${entry} has its verdict — only a skip waits for one, and a verdict given is corrected, never given again`);
    record('verdict', { entry: id, verdict, point }, { cwd, warnings });
    return { entry, verdict, point };
  });
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

module.exports = { VERDICT_USAGE, runVerdictVerb };
