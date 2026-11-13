'use strict';

// ---------------------------------------------------------------------------
// Domain ring: what waits on the person in a unit (18.2.3, 18.2.4, 18.4.2)
// — the one list the menus read, each wait with its door: the `next` a
// menu's row for it takes, into the phase the wait is answered in, a
// topic's by `handoff topic`, which refuses a pick gone stale.
//
// - The authority gates waiting: approve the map while a map is staged
//   (approve-map.cjs); an epic's topic's decided once its screen draws
//   (decided.cjs); ready to build once its screen draws, the spec's gaps all
//   answered (ready-to-build.cjs); an investigation's conclude once its
//   screen draws (investigation-conclude.cjs, 20.12.5); finish once its
//   screen draws — a quick-fix's close — which it never does while a
//   question of the build waits (D18, finish.cjs), and is never listed
//   while a question of this conversation waits.
// - The questions waiting, each read by the module that owns its rule, each
//   kind by where it is asked: the spec's gaps while the spec is under way
//   (spec-passes.cjs, spec-standing.cjs), asked in the conversation and
//   holding the spec (`gap`); the build's and its review's, parked in the
//   ledger, a builder's among them and a blind question holding its task
//   open (questions.cjs), waiting on the board (`question`); each raise this
//   conversation sealed at its investigation's places that the person has
//   not answered (raise.cjs, `raisePlaces`), holding the investigation
//   (`raise`); and a quick-fix's asked in its conversation, parking nothing
//   (questions.cjs), with each raise this conversation sealed at its fixes'
//   places still unanswered, but one counted already as asked (`raised`). A
//   seal is its conversation's alone, where it can be shown and answered:
//   read in no conversation, none counts. Everything else is read from the
//   ledger and the unit's files, the same in any conversation.
// - Each decided topic with an entry relying on an answer replaced since
//   (10.2.6, ledger-affected.cjs), its door where such an entry is answered
//   (unit-handoff.cjs): the topic's own while the unit is in the phase its
//   topics are talked through, else that phase, whose entry reads what the
//   change affected.
// - Asked for, the verdicts waiting on the departures that stand in the
//   unit, in the ledger's order (ledger-verdicts.cjs), each its door the
//   verdict page drawn for the unit.
//
// The call reads the ledger once, checked once, however many units it reads
// and however many of their rules read it (ledger-fold.cjs, `readOnce`), or
// meets a caller's read where it is handed one.
// ---------------------------------------------------------------------------

const { stateRoot } = require('../kernel/state-root.cjs');
const { readShownOnce, holdingShown } = require('./ledger-read.cjs');
const { factsOf } = require('./ledger-fold.cjs');
const { answerAffected } = require('./ledger-affected.cjs');
const { queueOf, inUnit } = require('./ledger-verdicts.cjs');
const { evidenceOf } = require('./trust-evidence.cjs');
const { sealsAt, sealWaits, raisePlaces } = require('./raise.cjs');
const { waitingIn, askedOpenIds } = require('./questions.cjs');
const { waitingGaps } = require('./spec-passes.cjs');
const { stagedOrNone } = require('./approve-map.cjs');
const { decidedDraws } = require('./decided.cjs');
const { readyDraws } = require('./ready-to-build.cjs');
const { finishDraws } = require('./finish.cjs');
const { concludeDraws } = require('./investigation-conclude.cjs');
const { specUnderWay } = require('./spec-standing.cjs');
const { phaseSkill } = require('./handoff.cjs');
const { affectedAnsweredIn } = require('./unit-handoff.cjs');
const {
  buildFinished, quickFixBuild, fixesBegun, reviewAsked, tasksBegun, investigationUnderWay, itemOf, mailPhase, topicTitle,
} = require('./derivations.cjs');

/** @typedef {import('./projections/surfaces.cjs').Next} Next */
/** @typedef {import('./ledger-read.cjs').Shower} Shower */
/** @typedef {import('./raise.cjs').Seal} Seal */

/** Every kind of wait (the header's). */
const WAIT_KINDS = Object.freeze(/** @type {const} */ (['map', 'decided', 'ready', 'conclude', 'finish', 'gap', 'question', 'raise', 'raised', 'affected', 'verdict']));

/** @typedef {typeof WAIT_KINDS[number]} WaitKind */
/**
 * A wait (the header's): its kind; its id — a question's number or short
 * id, a topic's name, a gate's own; its words; the topic it is about, where
 * it is a topic's; and its door.
 * @typedef {{kind: WaitKind, id: string, text: string, topic: string|null, next: Next}} Wait
 */

/**
 * What a call reads of the person and the ledger for every unit: the
 * ledger shown, the conversation reading, its seals counted, the verdicts
 * waiting asked for, and what the reads said.
 * @typedef {{shower: Shower, session: string|null, queue: string[], now: number, warnings: string[]}} Read
 */

/**
 * The door into a phase of the unit.
 * @param {Record<string, any>} manifest @param {string} phase @returns {Next}
 */
const intoPhase = (manifest, phase) => ({ kind: 'handoff', skill: phaseSkill(phase, manifest.work_type), args: [manifest.work_type, manifest.name] });

/** The door into a topic of the unit, refused where the pick has gone stale (handoff.cjs, `topicHandoff`). @param {Record<string, any>} manifest @param {string} topic @returns {Next} */
const intoTopic = (manifest, topic) => ({ kind: 'engine', argv: ['handoff', 'topic', manifest.name, topic] });

/** The verdict page's door, drawn for the unit. @param {string} unit @returns {Next} */
const verdictsOf = (unit) => ({ kind: 'engine', argv: ['render', 'verdicts', '--unit', unit] });

/** The phase a unit's tasks are built in now: its review once its build has finished, or a quick-fix's review asked for; else its build. @param {Record<string, any>} manifest */
const buildPlace = (manifest) => ((quickFixBuild(manifest) ? reviewAsked(manifest) : buildFinished(manifest)) ? 'review' : 'implementation');

/** Whether the unit has come to finish: its build finished, or a quick-fix's fixes begun. @param {Record<string, any>} manifest */
const atFinish = (manifest) => (quickFixBuild(manifest) ? fixesBegun(manifest) : buildFinished(manifest));

/** @param {WaitKind} kind @param {string} id @param {string} text @param {Next} next @param {string|null} [topic] @returns {Wait} */
const wait = (kind, id, text, next, topic = null) => ({ kind, id, text, topic, next });

/** What a raise asks the person of: its question, or the decision its rows would replace. @param {Seal} seal */
const subjectOf = (seal) => /** @type {string} */ (seal.answers ?? seal.replaces?.entry);

/** The kind of a raise sealed at `place`: an investigation's, holding it, or a quick-fix's, parking nothing (the header's). @param {Seal['place']} place @returns {WaitKind} */
const raiseKind = (place) => (place.phase === 'investigation' ? 'raise' : 'raised');

/**
 * Each raise the reading conversation sealed where one waits in the unit,
 * still waiting, parking nothing, but those asked already, by their
 * question's root (the header's); none read in no conversation.
 * @param {Read} read @param {Record<string, any>} manifest @param {Set<string>} asked
 * @returns {Wait[]}
 */
function sealedWaits({ shower: { folded, short }, session }, manifest, asked) {
  if (session === null) return [];
  return raisePlaces(manifest).flatMap((place) => sealsAt(session, place)).sort((a, b) => a.at.localeCompare(b.at))
    .filter((seal) => seal.parks === null && (seal.answers === null || !asked.has(factsOf(folded, seal.answers).root)) && sealWaits(folded, seal))
    .map((seal) => wait(raiseKind(seal.place), short(subjectOf(seal)), seal.call.question, intoPhase(manifest, seal.place.phase)));
}

/**
 * A quick-fix's questions asked in its conversation and parking nothing,
 * each by its short id, and the roots of their questions.
 * @param {Shower} shower @param {Record<string, any>} manifest
 * @returns {{waits: Wait[], roots: Set<string>}}
 */
function askedWaits({ folded, show, short }, manifest) {
  const ids = quickFixBuild(manifest) && fixesBegun(manifest) ? askedOpenIds(folded, manifest.name) : [];
  return {
    waits: ids.map((id) => wait('raised', short(id), String(show(id).text).replace(/\s+/g, ' ').trim(), intoPhase(manifest, factsOf(folded, id).phase))),
    roots: new Set(ids.map((id) => factsOf(folded, id).root)),
  };
}

/** The questions the unit's build and its review wait on, parked in the ledger. @param {Read} read @param {Record<string, any>} manifest @returns {Wait[]} */
function parkedWaits({ shower, now }, manifest) {
  if (!tasksBegun(manifest)) return [];
  const door = intoPhase(manifest, buildPlace(manifest));
  return waitingIn(shower.folded, shower.entryAt, manifest.name, now).map(({ question, asks }) => wait('question', question, asks, door));
}

/** Approve the map, while a map is staged for the epic: its door the epic's discovery. @param {string} cwd @param {Record<string, any>} manifest @returns {Wait[]} */
function mapGate(cwd, manifest) {
  const unit = manifest.name;
  if (manifest.work_type !== 'epic' || stagedOrNone(cwd, unit) === null) return [];
  return [wait('map', 'approve-the-map', 'Approve the map', { kind: 'handoff', skill: 'leeway-discovery', args: ['none', unit] })];
}

/** Each topic of an epic whose decided screen draws. @param {string} cwd @param {Record<string, any>} manifest @returns {Wait[]} */
function decidedGates(cwd, manifest) {
  if (manifest.work_type !== 'epic') return [];
  const topics = Object.keys(manifest.phases?.discussion?.items ?? {});
  return topics.filter((topic) => decidedDraws(cwd, manifest.name, topic))
    .map((topic) => wait('decided', topic, `Decided: ${topicTitle(manifest, topic)}`, intoTopic(manifest, topic), topic));
}

/** Finish once its screen draws — a quick-fix's its close — its door where the unit's tasks are built now. @param {string} cwd @param {Record<string, any>} manifest @returns {Wait[]} */
function finishGate(cwd, manifest) {
  if (!atFinish(manifest) || !finishDraws(cwd, manifest.name)) return [];
  return [wait('finish', 'finish', quickFixBuild(manifest) ? 'Close' : 'Finish', intoPhase(manifest, buildPlace(manifest)))];
}

/** An investigation's conclude once its screen draws, its door the investigation. @param {string} cwd @param {Record<string, any>} manifest @returns {Wait[]} */
function concludeGate(cwd, manifest) {
  if (!investigationUnderWay(manifest) || !concludeDraws(cwd, manifest.name)) return [];
  return [wait('conclude', 'conclude', 'Conclude', intoPhase(manifest, 'investigation'))];
}

/** A unit's spec: its gaps waiting, and ready to build once its screen draws, which it never does while one waits. @param {string} cwd @param {Record<string, any>} manifest @param {string[]} warnings @returns {Wait[]} */
function specWaits(cwd, manifest, warnings) {
  if (!specUnderWay(cwd, manifest)) return [];
  const door = intoPhase(manifest, 'specification');
  return [
    ...waitingGaps(cwd, manifest.name, warnings).map(({ short, text }) => wait('gap', short, text, door)),
    ...(readyDraws(cwd, manifest.name) ? [wait('ready', 'ready-to-build', 'Ready to build', door)] : []),
  ];
}

/**
 * The door to a decided topic a change affected: into where its entry is
 * answered (unit-handoff.cjs, `affectedAnsweredIn`) — the topic's own, or
 * the phase the unit is in.
 * @param {string} cwd @param {Record<string, any>} manifest @returns {(topic: string) => Next}
 */
function affectedDoor(cwd, manifest) {
  const phase = affectedAnsweredIn(cwd, manifest);
  return phase === null ? (topic) => intoTopic(manifest, topic) : () => intoPhase(manifest, phase);
}

/** Each decided topic an answer it relied on, replaced since, holds (10.2.6). @param {string} cwd @param {Shower} shower @param {string} root @param {Record<string, any>} manifest @returns {Wait[]} */
function affectedWaits(cwd, shower, root, manifest) {
  const phase = mailPhase(manifest.work_type);
  if (phase === null) return [];
  const topics = /** @type {string[]} */ (answerAffected(shower, { unit: manifest.name, topic: null }, root).waiting
    .filter((topic) => topic !== null && itemOf(manifest, phase, topic)?.status === 'completed'));
  if (topics.length === 0) return [];
  const door = affectedDoor(cwd, manifest);
  return topics.map((topic) => wait('affected', topic, `${topicTitle(manifest, topic)}: a decision it relies on changed`, door(topic), topic));
}

/**
 * What waits on the person in one unit, in its order (the header's).
 * @param {string} cwd @param {string} root @param {Read} read @param {Record<string, any>} manifest @returns {Wait[]}
 */
function unitWaits(cwd, root, read, manifest) {
  const { shower } = read;
  const asked = askedWaits(shower, manifest);
  const questions = [...parkedWaits(read, manifest), ...asked.waits, ...sealedWaits(read, manifest, asked.roots)];
  return [
    ...mapGate(cwd, manifest),
    ...decidedGates(cwd, manifest),
    ...specWaits(cwd, manifest, read.warnings),
    ...questions,
    ...concludeGate(cwd, manifest),
    ...(questions.length === 0 ? finishGate(cwd, manifest) : []),
    ...affectedWaits(cwd, shower, root, manifest),
    ...inUnit(shower.folded, read.queue, manifest.name).map((id) => wait('verdict', shower.short(id), String(shower.show(id).text), verdictsOf(manifest.name))),
  ];
}

/**
 * What waits on the person in each unit given, in its order (the header's),
 * the ledger read once: the seals of the conversation `session` counted,
 * none with no session; the verdicts with `verdicts`; and, where a caller
 * hands its own read of the ledger, `shower`, that read met. With what the
 * reads said.
 * @param {string} cwd @param {Record<string, any>[]} manifests units in progress
 * @param {{verdicts?: boolean, session?: string|null, shower?: Shower|null}} [opts]
 * @returns {{waits: Map<string, Wait[]>, warnings: string[]}}
 */
function waitsOf(cwd, manifests, { verdicts = false, session = null, shower = null } = {}) {
  /** @type {string[]} */
  const warnings = [];
  const root = stateRoot(cwd);
  /** @param {Shower} shown */
  const readAll = (shown) => {
    /** @type {Read} */
    const read = { shower: shown, session, queue: verdicts ? queueOf(shown.folded, evidenceOf(root)) : [], now: Date.now(), warnings };
    return new Map(manifests.map((manifest) => [manifest.name, unitWaits(cwd, root, read, manifest)]));
  };
  const waits = shower === null ? readShownOnce(root, warnings, readAll) : holdingShown(root, shower, () => readAll(shower));
  return { waits, warnings };
}

module.exports = { WAIT_KINDS, waitsOf };
