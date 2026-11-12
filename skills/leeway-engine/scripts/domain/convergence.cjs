'use strict';

// ---------------------------------------------------------------------------
// Domain ring: convergence (16.8) — Claude's offer to settle the rest of a
// topic under discussion once the person's answers have run its way, and
// the person's answer to it.
//
// - The run (16.8.7, P13): the person's answers to raises in the topic's
//   discussion, read from this machine's trust log (trust-evidence.cjs) and
//   placed by the ledger entry each names — the line it landed, where it
//   was made — in time order. An agreement extends it; a departure breaks
//   it; an answer the person didn't follow, their "don't care" on a blind
//   question, Claude's own calls and an answer a reversal cancels do
//   neither; answers in another topic, unit or phase never reach it. It
//   starts again from the person's latest no to the offer, kept in the
//   topic's cache (`convergence.json`) — so a new machine may offer once
//   more — and from their latest yes, which the trust log holds.
// - The offer is due once the run holds CONVERGENCE_RUN agreements, the
//   topic holds an open question to settle, and every question open at the
//   person's latest yes is closed, so no offer comes back while the
//   settling it started goes on (`offerDue`). The decision point asks it
//   once the person answers a raise in a topic's discussion
//   (decision-point.cjs `convergenceDue`, raise.cjs); until the ask rule is
//   switched on, it never offers.
// - `render convergence <wu>.<topic> [--asked]` (16.8.2): the offer, the
//   topic named by its key or the title a rename gave it, under discussion
//   in a unit in progress; drawn where the decision point says it is due,
//   or on the person's word whatever the run, `--asked` (16.S28); refused
//   where nothing is open. Its forecast is the ask rule's (ask-rule.cjs) on
//   each open question as the counts stand now — each labelled from its
//   wording alone, the calls put at once (labeller.cjs), one that fails
//   coming to the person (16.19.8) — as a call sorted by its kind,
//   `several`, since Claude has made none of them yet, made in the topic's
//   discussion, blocking no build work, replacing nothing, and measured by
//   the experiment still running that measures it, if any (9.1.11): those
//   the rule lets proceed, or sends Claude to check, Claude would settle;
//   the rest come to the person. No blind draw enters it: at settle time a
//   point may still be drawn blind, which the offer's DATA says
//   (projections/convergence.cjs).
// - `convergence accept <wu> <topic>`, the person's yes: stated intent,
//   logged in the trust log as a `convergence` event (16.8.6, 16.13.4), its
//   id drawn from the conversation and when the offer was shown, so a rerun
//   is read once. `convergence decline <wu> <topic>`, their no: kept in the
//   topic's cache, when they gave it (16.8.4). Each only on the person's
//   answer as the conversation recorded it at the offer (gate.cjs), else it
//   refuses, writing nothing. Neither writes the state: no writer lock.
// - Settling is no verb of its own: Claude raises each open question as
//   usual, and the rule decides each (16.8.5).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { stateRoot, statePath } = require('../kernel/state-root.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { idFrom, shortIds } = require('./ledger-ids.cjs');
const { ID_FACTS, readFolded, mapOf } = require('./ledger-fold.cjs');
const { liveness, manifestOf, measuredBy } = require('./ledger-units.cjs');
const { itemOf, topicKey, topicTitle } = require('./derivations.cjs');
const { unitInProgress } = require('./topic-standing.cjs');
const { projectName } = require('./state-checks.cjs');
const { readProjectEvents, record, projectId, modelOf } = require('./trust-log.cjs');
const { evidenceIn } = require('./trust-evidence.cjs');
const { countsOf } = require('./trust-counts.cjs');
const { trustSettings, CONVERGENCE_RUN } = require('./trust-settings.cjs');
const { careEntries } = require('./person.cjs');
const { labelsAtOnce, questionText, kindOf } = require('./labeller.cjs');
const { rule } = require('./ask-rule.cjs');
const { answeredTo, lastShown } = require('./gate.cjs');
const { offerScreen, OFFER_GATE } = require('./projections/convergence.cjs');

/** @typedef {import('./event-fields.cjs').Kind} Kind */
/** @typedef {import('./ledger-fold.cjs').IdFacts} IdFacts */
/** An open question on the topic: its id, its short form, its wording, and the experiment still running that measures it, null for none. @typedef {{id: string, short: string, text: string, measured: string|null}} Open */
/** The topic as it stands: the run of agreements, its open questions, and whether one of them was open at the person's latest yes. @typedef {{run: number, open: Open[], settling: boolean}} Standing */
/** What the rule forecasts for an open question: its short id, its kind, and whether Claude would settle it. @typedef {{short: string, kind: Kind|null, mine: boolean}} Forecast */

const PHASE = 'discussion';
const DECLINED = 'convergence.json';
const ACCEPT_USAGE = 'convergence accept <work-unit> <topic>   (the person\'s yes on the convergence offer)';
const DECLINE_USAGE = 'convergence decline <work-unit> <topic>   (the person\'s no on it)';

/** The convergence verbs' usage, a line each. */
const CONVERGENCE_USAGE = [ACCEPT_USAGE, DECLINE_USAGE].join('\n');

/** Where the topic's cache keeps the person's no. @param {string} cwd @param {string} unit @param {string} topic */
const declinedFile = (cwd, unit, topic) => statePath(cwd, '.cache', unit, PHASE, topic, DECLINED);

/** When the person last declined the offer on the topic, null where they never did. @param {string} cwd @param {string} unit @param {string} topic */
function declinedAt(cwd, unit, topic) {
  const file = declinedFile(cwd, unit, topic);
  if (!fs.existsSync(file)) return null;
  return Date.parse(JSON.parse(fs.readFileSync(file, 'utf8')).declined);
}

/** An event's time. @param {Record<string, unknown>} event */
const timeOf = (event) => Date.parse(/** @type {string} */ (event.at));

/** The latest of `times`, null where none is given. @param {(number|null)[]} times */
function latest(...times) {
  const given = /** @type {number[]} */ (times.filter((time) => time !== null));
  return given.length === 0 ? null : Math.max(...given);
}

/**
 * When the person last said yes to the offer on the topic, the trust log's
 * `convergence` event, null where they never did.
 * @param {Record<string, unknown>[]} events the project's @param {string} unit @param {string} topic
 */
function acceptedAt(events, unit, topic) {
  return latest(...events.filter((event) => event.type === 'convergence' && event.unit === unit && event.topic === topic).map(timeOf));
}

/**
 * The agreements in a row in the topic `topic` of `unit` (the header's):
 * `events` the project's, placed by `facts`, those after `since` alone.
 * Pure.
 * @param {Record<string, unknown>[]} events @param {Map<string, IdFacts>} facts @param {string} unit @param {string} topic @param {number|null} since
 * @returns {number}
 */
function runIn(events, facts, unit, topic, since) {
  const inTopic = evidenceIn(events).answers.filter(({ event }) => {
    const made = facts.get(/** @type {string} */ (event.entry));
    return made !== undefined && made.unit === unit && made.topic === topic && made.phase === PHASE && (since === null || timeOf(event) > since);
  });
  let run = 0;
  for (const { standing, cancelled_by: cancelled } of [...inTopic].sort((a, b) => timeOf(a.event) - timeOf(b.event))) {
    if (cancelled !== null) continue;
    if (standing === 'agreement') run += 1;
    else if (standing === 'departure') run = 0;
  }
  return run;
}

/**
 * The topic `topic` of `unit` as the trust log and the ledger stand: the
 * run, the questions open on its map (5.8.5), each with its wording and the
 * experiment measuring it, and whether one of them was first asked by the
 * person's latest yes, so its settling goes on. What the ledger's read said
 * is pushed to `warnings`.
 * @param {string} cwd @param {string} unit @param {string} topic @param {string[]} warnings
 * @returns {Standing}
 */
function topicStanding(cwd, unit, topic, warnings) {
  const root = stateRoot(cwd);
  /** @type {Record<string, unknown>[]} */
  const events = [];
  readProjectEvents(root, (event) => events.push(event));
  const yes = acceptedAt(events, unit, topic);
  const manifest = /** @type {Record<string, any>} */ (manifestOf(root, unit));
  return readFolded(root, ID_FACTS, warnings, (facts, entryAt) => {
    const shorts = shortIds(facts.keys());
    const fact = (/** @type {string} */ id) => /** @type {IdFacts} */ (facts.get(id));
    const ids = mapOf({ facts, live: liveness(root) }, unit, topic).filter(({ stands }) => stands === 'open').map(({ id }) => id);
    const askedAt = (/** @type {string} */ id) => Date.parse(String(entryAt(fact(fact(id).root).place).at));
    return {
      run: runIn(events, facts, unit, topic, latest(yes, declinedAt(cwd, unit, topic))),
      open: ids.map((id) => ({ id, short: /** @type {string} */ (shorts.get(id)), text: String(entryAt(fact(id).place).text), measured: measuredBy(manifest, facts, id) })),
      // The ledger keeps whole seconds: a question asked in the yes's own second counts as open at it.
      settling: yes !== null && ids.some((id) => askedAt(id) <= yes),
    };
  });
}

/**
 * Whether the offer is due as the topic stands: its run come to the offer,
 * something open to settle, and no settling the person's yes started still
 * going on.
 * @param {Standing} standing
 */
const dueIn = ({ run, open, settling }) => run >= CONVERGENCE_RUN && open.length > 0 && !settling;

/**
 * The agreements in a row in the topic where the offer is due on it, else
 * null (the header's): the decision point's once the ask rule is switched
 * on. What the ledger's read said is pushed to `warnings`.
 * @param {string} cwd @param {string} unit @param {string} topic @param {string[]} [warnings]
 * @returns {number|null}
 */
function offerDue(cwd, unit, topic, warnings = []) {
  const standing = topicStanding(cwd, unit, topic, warnings);
  return dueIn(standing) ? standing.run : null;
}

/**
 * What the ask rule forecasts for each of the questions `open` on the
 * topic `topic` of `unit` (the header's), as the counts stand now for the
 * session's model.
 * @param {string} cwd @param {string} unit @param {string} topic @param {Open[]} open
 * @returns {Forecast[]}
 */
function forecastOf(cwd, unit, topic, open) {
  const root = stateRoot(cwd);
  const care = careEntries();
  const settings = trustSettings();
  const project = { id: projectId(root), name: projectName(cwd) };
  const counts = countsOf(root, { model: modelOf(cwd), now: Date.now() });
  const labels = labelsAtOnce(open.map(({ text }) => questionText(text, [])));
  return open.map(({ short, measured }, i) => {
    const label = labels[i];
    const { decision } = rule({ sort: 'several' }, {
      label, place: { unit, phase: PHASE, topic }, blocks_build: false, replaced_by: null, measured, always: null, checked: false, project, counts, settings, care,
    });
    return { short, kind: kindOf(label), mine: decision !== 'ask' };
  });
}

/**
 * The topic a render names, `<wu>.<topic>` — by its key, or the title a
 * rename gave it — under discussion in a unit in progress, refused in the
 * words of `said` otherwise.
 * @param {string} cwd @param {string|undefined} dotpath @param {string} said
 * @returns {{unit: string, topic: string, manifest: Record<string, any>}}
 */
function topicOf(cwd, dotpath, said) {
  const [unit, named, ...rest] = (dotpath ?? '').split('.');
  if (!unit || !named || rest.length > 0) throw new Error(`${said}: address must be <work-unit>.<topic>, got "${dotpath ?? ''}"`);
  let manifest;
  try {
    manifest = unitInProgress(cwd, unit);
  } catch (err) {
    throw new Error(`${said}: ${messageOf(err)}`);
  }
  const topic = topicKey(manifest, named);
  if (itemOf(manifest, PHASE, topic)?.status !== 'in-progress') throw new Error(`${said}: ${unit} has no topic "${named}" under discussion — the offer settles the rest of a topic under discussion`);
  return { unit, topic, manifest };
}

/**
 * The decision point's word on the offer on the topic `topic` of `unit`:
 * its agreements in a row where due, else null.
 * @param {string} cwd @param {string} unit @param {string} topic
 * @returns {number|null}
 */
function offerSaid(cwd, unit, topic) {
  // Required here: switched on, the decision point reads `offerDue` from this module.
  return require('./decision-point.cjs').convergenceDue(cwd, unit, topic);
}

/**
 * `render convergence <wu>.<topic> [--asked]` (the header's).
 * @param {string} cwd @param {{dotpath?: string, asked?: string}} args
 * @returns {string}
 */
function convergenceSurface(cwd, { dotpath, asked }) {
  const said = 'render convergence';
  const { unit, topic, manifest } = topicOf(cwd, dotpath, said);
  const title = topicTitle(manifest, topic);
  /** @type {string[]} */
  const warnings = [];
  const standing = topicStanding(cwd, unit, topic, warnings);
  if (standing.open.length === 0) throw new Error(`${said}: nothing is open on ${title} to settle`);
  if (asked === undefined && offerSaid(cwd, unit, topic) === null) {
    throw new Error(`${said}: no offer is due on ${title} — the decision point offers none at ${standing.run} agreement${standing.run === 1 ? '' : 's'} in a row; on the person's word, --asked`);
  }
  return offerScreen({ title, unit, topic, run: asked === undefined ? standing.run : null, forecast: forecastOf(cwd, unit, topic, standing.open), warnings });
}

/**
 * The person's answer on the offer for the topic `args` names, leading to
 * `convergence {verb}`: its unit, topic and conversation, and when the offer
 * was shown and answered. Refuses another answer, or none.
 * @param {string} verb @param {string[]} args @param {string} usage
 */
function answeredOffer(verb, args, usage) {
  const said = `convergence ${verb}`;
  if (args.length !== 2 || args.some((arg) => arg === '' || arg.startsWith('--'))) throw new Error(`Usage: engine ${usage}`);
  const [unit, topic] = args;
  const session = handedSession();
  if (session === null) throw new Error(`${said}: no conversation to answer in — Claude Code hands every command it runs a session id, and this one has none`);
  if (!answeredTo(session, [OFFER_GATE], ['convergence', verb, unit, topic], null)) {
    throw new Error(`${said}: the person has not said ${verb === 'accept' ? 'yes' : 'no'} to settling the rest of ${topic} — only their answer on the offer, render convergence, leads here, and nothing is written`);
  }
  const { at, answered } = /** @type {import('./gate.cjs').ShownRecord} */ (lastShown(session));
  return { unit, topic, session, shown: at, answered: /** @type {import('./gate.cjs').Answered} */ (answered).at };
}

/**
 * `convergence accept <wu> <topic>` (the header's).
 * @param {string} cwd @param {string[]} args
 */
function accept(cwd, args) {
  const { unit, topic, session, shown } = answeredOffer('accept', args, ACCEPT_USAGE);
  /** @type {string[]} */
  const warnings = [];
  record('convergence', { unit, topic }, { cwd, warnings, id: idFrom(session, 'convergence accept', shown) });
  return { convergence: 'accepted', unit, topic, ...(warnings.length > 0 ? { warnings } : {}) };
}

/**
 * `convergence decline <wu> <topic>` (the header's).
 * @param {string} cwd @param {string[]} args
 */
function decline(cwd, args) {
  const { unit, topic, answered } = answeredOffer('decline', args, DECLINE_USAGE);
  const file = declinedFile(cwd, unit, topic);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeJsonAtomic(file, { declined: answered });
  return { convergence: 'declined', unit, topic };
}

/** @type {Readonly<Record<string, (cwd: string, args: string[]) => Record<string, unknown>>>} */
const VERBS = Object.freeze({ accept, decline });

/**
 * `convergence <accept|decline>`: the verb's answer.
 * @param {string} cwd @param {string} verb @param {string[]} args
 * @returns {Record<string, unknown>}
 */
function runConvergenceVerb(cwd, verb, args) {
  if (!Object.hasOwn(VERBS, verb)) throw new Error(`Usage: engine convergence <${Object.keys(VERBS).join('|')}> …\n${CONVERGENCE_USAGE}`);
  return VERBS[verb](cwd, args);
}

module.exports = { CONVERGENCE_USAGE, offerDue, convergenceSurface, runConvergenceVerb };
