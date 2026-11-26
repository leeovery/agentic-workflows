'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a departure's verdict (6.1.6, 16.10), given at the moment the
// person makes the departure, which the verb recording it says is owed
// (ledger-verdicts.cjs, `verdictOwed`).
//
// - `render verdict <entry>` draws the verdict question on the departure
//   (projections/verdict.cjs): the question it answers, Claude's lean and
//   the person's answer, read as the ledger's reads are (ledger-read.cjs),
//   holding no lock. Its words are the ledger's, the trust log holding none.
// - `verdict give <entry> <verdict> [--from-words]` logs the verdict in the
//   trust log (16.10.9): the entry named by a prefix of its id, as a ledger
//   link names one; the verdict nothing, a fix later, a real loss, or a
//   skip, the person unable to call it yet; given as asked, the person's
//   pick on the question, or, with `--from-words`, read from what they said
//   as they made the departure. Whichever is given is the departure's for
//   good: a skip is never asked again, and a verdict given is corrected as
//   a correction (16.15.4), never given again.
// - Each refuses an entry the ledger holds as no departure (16.10.1); a
//   departure this machine logged none for: one made on another machine,
//   whose verdict is given there (16.13.1), or the person's replacement of
//   their own departure, still against the lean, which is owed none; and a
//   departure given its verdict, one waiting in any conversation for the
//   trust log among them. The departures and the verdicts are read in one
//   pass (trust-evidence.cjs).
// - `give` holds the writer lock (engine.cjs), so a peer's verdict on the
//   same departure never lands between the check and the append, and
//   writes nothing the state holds. An append that fails is a warning, the
//   event waiting in the conversation (trust-log.cjs).
// ---------------------------------------------------------------------------

const { messageOf } = require('../kernel/call.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { carrying } = require('./ledger.cjs');
const { resolveId, shortId } = require('./ledger-ids.cjs');
const { ID_FACTS, foldLedger } = require('./ledger-fold.cjs');
const { liveness } = require('./ledger-units.cjs');
const { isDeparture, departureOf } = require('./ledger-verdicts.cjs');
const { readShown } = require('./ledger-read.cjs');
const { record } = require('./trust-log.cjs');
const { evidenceOf } = require('./trust-evidence.cjs');
const { VERDICTS } = require('./trust-events.cjs');
const { verdictQuestion } = require('./projections/verdict.cjs');

/** @typedef {import('./ledger-fold.cjs').Folded} Folded */

const FROM_WORDS = '--from-words';
const GIVE_USAGE = `verdict give <entry> <${VERDICTS.join('|')}> [${FROM_WORDS}]`;

/** The verdict verbs' usage, a line each. */
const VERDICT_USAGE = GIVE_USAGE;

/**
 * The departure `prefix` names that this machine owes its verdict, by its
 * id and its short id, refused in the words of `said` otherwise (the
 * header's).
 * @param {string} root @param {Folded} folded @param {string} prefix @param {string} said
 * @returns {{id: string, entry: string}}
 */
function owedDeparture(root, folded, prefix, said) {
  let id;
  try {
    id = resolveId(prefix, folded.facts.keys());
  } catch (err) {
    throw new Error(`${said}: ${messageOf(err)}`);
  }
  const entry = shortId(id, folded.facts.keys());
  if (!isDeparture(folded, id)) throw new Error(`${said}: ${entry} is no departure — a verdict is given on the person's answer that stood over Claude's lean`);
  const { departures, verdicts } = evidenceOf(root);
  if (!departures.has(id)) throw new Error(`${said}: ${entry} is no departure this machine logged — a departure's verdict is given on the machine where it was made, and the person's replacement of their own departure is owed none`);
  if (verdicts.has(id)) throw new Error(`${said}: ${entry} has its verdict — a verdict is given once, at the departure, and a verdict given is corrected, never given again`);
  return { id, entry };
}

/**
 * A verdict's argv read: the entry's prefix, the verdict, and whether it
 * was read from the person's words. Refuses argv of another shape and a
 * verdict outside the four.
 * @param {string[]} args
 * @returns {{prefix: string, verdict: string, words: boolean}}
 */
function readGive(args) {
  const words = args.includes(FROM_WORDS);
  const positional = args.filter((arg) => arg !== FROM_WORDS);
  if (positional.length !== 2 || positional.some((arg) => arg.startsWith('--')) || args.length - positional.length > 1) throw new Error(`Usage: engine ${GIVE_USAGE}`);
  const [prefix, verdict] = positional;
  if (!VERDICTS.includes(verdict)) throw new Error(`verdict give: "${verdict}" is no verdict — ${VERDICTS.join(', ')}`);
  return { prefix, verdict, words };
}

/**
 * `verdict give` (the header's): the verdict logged on the departure the
 * prefix names. Answers the entry by its short id, the verdict and how it
 * was given.
 * @param {string} cwd @param {string[]} args
 */
function giveVerdict(cwd, args) {
  const { prefix, verdict, words } = readGive(args);
  /** @type {string[]} */
  const warnings = [];
  try {
    const root = stateRoot(cwd);
    const { id, entry } = owedDeparture(root, { facts: foldLedger(root, ID_FACTS, warnings), live: liveness(root) }, prefix, 'verdict give');
    const given = words ? 'words' : 'asked';
    record('verdict', { entry: id, verdict, given }, { cwd, warnings });
    return { entry, verdict, given, ...(warnings.length > 0 ? { warnings } : {}) };
  } catch (err) {
    throw carrying(err, warnings);
  }
}

/**
 * `render verdict <entry>` (the header's): the verdict question on the
 * departure the prefix names.
 * @param {string} cwd @param {string|undefined} prefix
 * @returns {string}
 */
function verdictSurface(cwd, prefix) {
  if (prefix === undefined) throw new Error('Usage: engine render verdict <entry>');
  /** @type {string[]} */
  const warnings = [];
  try {
    const root = stateRoot(cwd);
    return readShown(root, warnings, (shower) => verdictQuestion(departureOf(shower, owedDeparture(root, shower.folded, prefix, 'render verdict').id)));
  } catch (err) {
    throw carrying(err, warnings);
  }
}

/** @type {Readonly<Record<string, (cwd: string, args: string[]) => Record<string, unknown>>>} */
const VERBS = Object.freeze({ give: giveVerdict });

/**
 * `verdict give`: the verb's answer.
 * @param {string} cwd @param {string} verb @param {string[]} args
 */
function runVerdictVerb(cwd, verb, args) {
  if (!Object.hasOwn(VERBS, verb)) throw new Error(`Usage: engine verdict <${Object.keys(VERBS).join('|')}> …\n${VERDICT_USAGE}`);
  return VERBS[verb](cwd, args);
}

module.exports = { VERDICT_USAGE, runVerdictVerb, verdictSurface };
