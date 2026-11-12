'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the matrix and the person's settings (16.15, 17.1.2,
// 17.1.3) — the matrix screen, the replay a setting is picked from, the
// pick that writes it, and the person's corrections in words.
//
// - `render matrix`: the matrix, in the menus' frame (projections/
//   matrix.cjs), read for this project, the conversation's model and now:
//   the person's settings (trust-settings.cjs) and care entries here
//   (person.cjs); each kind's tally, its bound and where it stands at the
//   threshold and at half of it, and the one-answer calls', from the trust
//   log's counts, the person's events read once (trust-counts.cjs); the
//   weight carried in from their other projects, danger's apart, as it
//   always asks; and how this project's review findings split, from its
//   ledger (measures.cjs).
// - `render matrix-replay --threshold <n> | --build <n>`: the trust log
//   replayed against the threshold proposed, or its raise mid-build
//   (replay.cjs), `n` a percent above 0 and below 100. It refuses the
//   setting as it stands, and a raise mid-build not above the threshold.
// - `trust threshold <n>` and `trust build-threshold <n>`: the setting
//   written to the settings file (trust-settings.cjs, 16.13.7) on the
//   person's yes on the replay of it, as the gate recorded it (gate.cjs) —
//   Claude never sets it (16.13.2). Each answers the matrix as what comes
//   next. It writes nothing the state holds, and takes no writer lock
//   (engine.cjs).
// - `trust correct <entry> --kind <kind> | --verdict <nothing|fix|loss>`:
//   the person's correction, in their words, of a question's kind or of a
//   departure's verdict, logged in the trust log (16.15.4), so the counts
//   follow (trust-evidence.cjs). The entry is named by a prefix of its id,
//   as a ledger link names one. A kind is corrected on a question this
//   machine logged an answer or a call for; a verdict, on a departure this
//   machine logged whose latest verdict is no skip — one waiting is given
//   its verdict, never corrected. It holds the writer lock, as `verdict
//   give` does, and writes nothing the state holds.
// ---------------------------------------------------------------------------

const { messageOf } = require('../kernel/call.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { KINDS } = require('./event-fields.cjs');
const { carrying } = require('./ledger.cjs');
const { resolveId, shortId } = require('./ledger-ids.cjs');
const { ID_FACTS, foldLedger } = require('./ledger-fold.cjs');
const { liveness } = require('./ledger-units.cjs');
const { record, readPersonEvents, modelOf } = require('./trust-log.cjs');
const { evidenceOf } = require('./trust-evidence.cjs');
const { countsFrom, tallyFrom, stateOf, carriedWeight } = require('./trust-counts.cjs');
const { HARD_TO_UNDO, trustSettings, setTrustSetting } = require('./trust-settings.cjs');
const { careEntries, careIn } = require('./person.cjs');
const { hereOf, sessionOf } = require('./person-verbs.cjs');
const { answeredTo } = require('./gate.cjs');
const { findingsSplit } = require('./measures.cjs');
const { replay } = require('./replay.cjs');
const { percent } = require('./ask-rule.cjs');
const { MENUS, drawMenu } = require('./menus.cjs');
const { matrixScreen, replayScreen, percentArg } = require('./projections/matrix.cjs');

/** @typedef {import('./event-fields.cjs').Kind} Kind */
/** @typedef {import('./trust-settings.cjs').Settings} Settings */
/** @typedef {import('./projections/matrix.cjs').MatrixView} MatrixView */
/** @typedef {import('./projections/matrix.cjs').Setting} Setting */
/** @typedef {import('./person-verbs.cjs').Here} Here */

// The kinds as the matrix lists them, danger first (16.15.1).
const MATRIX_KINDS = Object.freeze(/** @type {Kind[]} */ (['danger', 'contract', 'scope', 'behaviour', 'look', 'process', 'words', 'internals']));
const JUDGED = Object.freeze(['nothing', 'fix', 'loss']);
// The replay's gate, whose yes writes the setting.
const REPLAY_GATE = 'matrix replay';

const CORRECT_USAGE = `trust correct <entry> --kind <${KINDS.join('|')}> | --verdict <${JUDGED.join('|')}>`;
/** Each setting's verb, its usage, the setting it writes and the replay's flag proposing it. @type {Readonly<Record<string, {usage: string, name: keyof Settings, flag: Setting}>>} */
const SETTING_VERBS = Object.freeze({
  threshold: { usage: 'trust threshold <percent>', name: 'threshold', flag: 'threshold' },
  'build-threshold': { usage: 'trust build-threshold <percent>', name: 'build_threshold', flag: 'build' },
});

/** The trust verbs' usage, a line each. */
const TRUST_USAGE = [...Object.values(SETTING_VERBS).map(({ usage }) => usage), CORRECT_USAGE].join('\n');

/** The person's events on this machine, every project's, read once from the project at `root`. @param {string} root */
function personEvents(root) {
  /** @type {Record<string, unknown>[]} */
  const events = [];
  readPersonEvents(root, (event) => events.push(event));
  return events;
}

/**
 * The matrix's view (the header's).
 * @param {string} cwd @param {Here} here @param {string[]} warnings
 * @returns {MatrixView}
 */
function matrixView(cwd, here, warnings) {
  const events = personEvents(here.root);
  const clock = { project: here.id, model: modelOf(cwd), now: Date.now() };
  const counts = countsFrom(events, clock);
  const tally = tallyFrom(events, clock);
  const settings = trustSettings();
  const cared = new Set(careIn(careEntries(), here.id).map(({ kind }) => kind));
  const { threshold } = settings;
  const one = stateOf(counts.one, threshold);
  return {
    project: here.name,
    settings,
    carried: [...MATRIX_KINDS.filter((kind) => kind !== 'danger').map((kind) => counts.kinds[kind]), counts.one].reduce((sum, count) => sum + carriedWeight(count), 0),
    kinds: MATRIX_KINDS.map((kind) => {
      const at = stateOf(counts.kinds[kind], threshold);
      return { kind, tally: tally.kinds[kind], bound: at.bound, asks: at.asks, hardAsks: stateOf(counts.kinds[kind], threshold * HARD_TO_UNDO).asks, cared: cared.has(kind) };
    }),
    one: { tally: tally.one, bound: one.bound, asks: one.asks },
    split: findingsSplit({ facts: foldLedger(here.root, ID_FACTS, warnings), live: liveness(here.root) }),
  };
}

/**
 * `render matrix` (the header's).
 * @param {string} cwd @returns {string}
 */
function matrixSurface(cwd) {
  /** @type {string[]} */
  const warnings = [];
  try {
    return drawMenu(cwd, MENUS.matrix, {}, matrixScreen(matrixView(cwd, hereOf(cwd), warnings)));
  } catch (err) {
    throw carrying(err, warnings);
  }
}

const PERCENT = /^(\d+(?:\.\d+)?)%?$/;

/**
 * A threshold as the person names it, a percent, read as a fraction;
 * refused, in the words of `said`, where it is none above 0 and below 100.
 * @param {string} said @param {string|undefined} given
 */
function rateOf(said, given) {
  const read = PERCENT.exec(given ?? '');
  const rate = read === null ? NaN : Number(read[1]) / 100;
  if (!(rate > 0 && rate < 1)) throw new Error(`${said}: ${JSON.stringify(given ?? '')} is no threshold — a percent above 0 and below 100, as 25 or 12.5`);
  return rate;
}

/**
 * The settings with `setting` set to `rate` — refused, in the words of
 * `said`, where it stands so already, or, mid-build, does not raise the
 * threshold.
 * @param {string} said @param {Settings} settings @param {Setting} setting @param {number} rate
 * @returns {Settings}
 */
function proposing(said, settings, setting, rate) {
  const { threshold, build_threshold: build } = settings;
  if (setting === 'threshold') {
    if (rate === threshold) throw new Error(`${said}: ${percent(rate)} is your threshold already`);
    return { ...settings, threshold: rate };
  }
  if (rate === build) throw new Error(`${said}: ${percent(rate)} is your threshold mid-build already`);
  if (rate <= threshold) throw new Error(`${said}: mid-build the threshold rises over your ${percent(threshold)}, never to ${percent(rate)} — a lower one is your threshold's own pick`);
  return { ...settings, build_threshold: rate };
}

/**
 * `render matrix-replay --threshold <n> | --build <n>` (the header's).
 * @param {string} cwd @param {{threshold?: string, build?: string}} flags
 * @returns {string}
 */
function replaySurface(cwd, { threshold, build }) {
  const said = 'render matrix-replay';
  if ((threshold === undefined) === (build === undefined)) throw new Error(`${said}: --threshold <percent> or --build <percent>, one and not both`);
  /** @type {Setting} */
  const setting = threshold === undefined ? 'build' : 'threshold';
  const rate = rateOf(said, threshold ?? build);
  const here = hereOf(cwd);
  const settings = trustSettings();
  const replayed = replay(personEvents(here.root), {
    project: { id: here.id, name: here.name }, settings: proposing(said, settings, setting, rate), care: careEntries(), now: Date.now(), blocking: setting === 'build',
  });
  return replayScreen({ project: here.name, setting, proposed: rate, settings, replayed });
}

/**
 * `trust threshold|build-threshold <n>` (the header's): the setting written,
 * and the matrix next.
 * @param {string} verb @param {string[]} args
 */
function setSetting(verb, args) {
  const { usage, name, flag } = SETTING_VERBS[verb];
  if (args.length !== 1) throw new Error(`Usage: engine ${usage}`);
  const said = `trust ${verb}`;
  const rate = rateOf(said, args[0]);
  const session = sessionOf(said);
  if (!answeredTo(session, [REPLAY_GATE], ['trust', verb, percentArg(rate)], null)) {
    throw new Error(`${said}: the person has not picked ${percent(rate)} — only their y/yes on its replay, render matrix-replay --${flag} ${percentArg(rate)}, sets it, and nothing is written`);
  }
  proposing(said, trustSettings(), flag, rate);
  setTrustSetting(name, rate);
  return { [name]: percent(rate), next: { kind: 'engine', argv: ['render', 'matrix'] } };
}

/**
 * A correction's argv read: the entry's prefix, and the kind or the verdict
 * it corrects to, the other null. Refuses argv of another shape, and a kind
 * or a verdict there is none of.
 * @param {string[]} args
 * @returns {{prefix: string, kind: Kind|null, verdict: string|null}}
 */
function readCorrection(args) {
  const [prefix, flag, value, ...rest] = args;
  if (prefix === undefined || prefix.startsWith('--') || value === undefined || rest.length > 0 || (flag !== '--kind' && flag !== '--verdict')) throw new Error(`Usage: engine ${CORRECT_USAGE}`);
  if (flag === '--kind' && !KINDS.includes(/** @type {Kind} */ (value))) throw new Error(`trust correct: "${value}" is no kind — ${KINDS.join(', ')}`);
  if (flag === '--verdict' && !JUDGED.includes(value)) throw new Error(`trust correct: "${value}" is no verdict to correct to — ${JUDGED.join(', ')}; a skip is no verdict given`);
  return flag === '--kind' ? { prefix, kind: /** @type {Kind} */ (value), verdict: null } : { prefix, kind: null, verdict: value };
}

/**
 * `trust correct` (the header's): the correction logged. Answers the entry
 * by its short id, and what it was corrected to.
 * @param {string} cwd @param {string[]} args
 */
function correct(cwd, args) {
  const { prefix, kind, verdict } = readCorrection(args);
  /** @type {string[]} */
  const warnings = [];
  try {
    const root = stateRoot(cwd);
    const facts = foldLedger(root, ID_FACTS, warnings);
    let id;
    try {
      id = resolveId(prefix, facts.keys());
    } catch (err) {
      throw new Error(`trust correct: ${messageOf(err)}`);
    }
    const entry = shortId(id, facts.keys());
    const { answers, departures, judged } = evidenceOf(root);
    if (kind !== null && !answers.some(({ event }) => event.entry === id)) throw new Error(`trust correct: ${entry} is no question this machine's trust log holds an answer or a call for — a kind is corrected where the counts read it`);
    if (verdict !== null && !departures.has(id)) throw new Error(`trust correct: ${entry} is no departure this machine logged — a verdict is corrected on the machine where it was given`);
    if (verdict !== null && !judged.has(id)) throw new Error(`trust correct: ${entry} waits on its verdict — give it with verdict give; only a verdict given is corrected`);
    record('correction', { entry: id, kind, verdict }, { cwd, warnings });
    const answered = kind === null ? { entry, verdict } : { entry, kind };
    return warnings.length > 0 ? { ...answered, warnings } : answered;
  } catch (err) {
    throw carrying(err, warnings);
  }
}

/**
 * `trust <threshold|build-threshold|correct>`: the verb's answer.
 * @param {string} cwd @param {string} verb @param {string[]} args
 * @returns {Record<string, unknown>}
 */
function runTrustVerb(cwd, verb, args) {
  if (Object.hasOwn(SETTING_VERBS, verb)) return setSetting(verb, args);
  if (verb === 'correct') return correct(cwd, args);
  throw new Error(`Usage: engine trust <${[...Object.keys(SETTING_VERBS), 'correct'].join('|')}> …\n${TRUST_USAGE}`);
}

module.exports = { TRUST_USAGE, MATRIX_KINDS, runTrustVerb, matrixSurface, replaySurface };
