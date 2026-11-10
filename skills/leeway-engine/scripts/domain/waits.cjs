'use strict';

// ---------------------------------------------------------------------------
// Domain ring: what waits on the person in a unit (18.2.3, 18.2.4, 18.4.2)
// — the one list the menus read, read with no conversation of its own, each
// wait with its door: the `next` a menu's row for it takes, into the phase
// the wait is answered in.
//
// - The authority gates waiting: approve the map while a map is staged
//   (approve-map.cjs); an epic's topic's decided while its close stands and
//   Claude's payload is staged against it (decided.cjs); ready to build
//   once its screen draws, the spec's gaps all answered (ready-to-build.cjs);
//   finish once its screen draws — a quick-fix's close — which it never does
//   while a question of the build waits (D18, finish.cjs).
// - The questions waiting, each read by the module that owns its rule: the
//   spec's gaps while the spec is under way (spec-passes.cjs); the build's
//   and its review's, parked in the ledger, a builder's among them
//   (questions.cjs); a quick-fix's asked in its conversation, parking
//   nothing (questions.cjs); and each raise sealed at a bug's investigation
//   or a quick-fix's places that the person has not answered. The menus
//   read in no conversation that raised anything, so a raise sealed in any
//   conversation counts (E4), the latest seal of a question, or of the
//   replacement of a decision, deciding whether it waits (raise.cjs), and a
//   question counted already as one asked counted once. The seals are this
//   machine's, every project's: one of a subject this project's ledger does
//   not hold is another's.
// - Each decided topic with an entry relying on an answer replaced since
//   (10.2.6, ledger-affected.cjs), its door the topic's discussion.
// - Asked for, the verdicts waiting on the departures that stand in the
//   unit, in the ledger's order (ledger-verdicts.cjs), each its door the
//   verdict page.
// ---------------------------------------------------------------------------

const { BUILD_PHASES } = require('../kernel/manifest-schema.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { readShown } = require('./ledger-read.cjs');
const { factsOf, standingOf } = require('./ledger-fold.cjs');
const { answerAffected } = require('./ledger-affected.cjs');
const { queueOf } = require('./ledger-verdicts.cjs');
const { evidenceOf } = require('./trust-evidence.cjs');
const { everySeal, sealWaits } = require('./raise.cjs');
const { waitingQuestions, askedOpenIds } = require('./questions.cjs');
const { waitingGaps } = require('./spec-passes.cjs');
const { stagedOrNone } = require('./approve-map.cjs');
const { decidedWaits } = require('./decided.cjs');
const { readyDraws } = require('./ready-to-build.cjs');
const { finishDraws } = require('./finish.cjs');
const { topicsSettled, pastItsSpec } = require('./spec-standing.cjs');
const { phaseSkill } = require('./handoff.cjs');
const {
  buildBegun, buildFinished, quickFixBuild, fixesBegun, reviewAsked, tasksBegun, itemOf, mailPhase, topicTitle,
} = require('./derivations.cjs');

/** @typedef {import('./projections/surfaces.cjs').Next} Next */
/** @typedef {import('./ledger-read.cjs').Shower} Shower */
/** @typedef {import('./raise.cjs').Seal} Seal */

/** @typedef {'map'|'decided'|'ready'|'finish'|'question'|'affected'|'verdict'} WaitKind */
/**
 * A wait (the header's): its kind; its id — a question's number or short
 * id, a topic's name, a gate's own; its words; the topic it is about, where
 * it is a topic's; and its door.
 * @typedef {{kind: WaitKind, id: string, text: string, topic: string|null, next: Next}} Wait
 */

/**
 * The door into a phase of the unit, at its topic where one is named.
 * @param {Record<string, any>} manifest @param {string} phase @param {string|null} [topic] @returns {Next}
 */
const intoPhase = (manifest, phase, topic = null) => ({
  kind: 'handoff', skill: phaseSkill(phase, manifest.work_type), args: [manifest.work_type, manifest.name, ...(topic === null ? [] : [topic])],
});

/** The verdict page's door. @type {Next} */
const VERDICTS = Object.freeze({ kind: 'engine', argv: ['render', 'verdicts'] });

/** The phase a unit's tasks are built in now: its review once its build has finished, or a quick-fix's review asked for; else its build. @param {Record<string, any>} manifest */
const buildPlace = (manifest) => ((quickFixBuild(manifest) ? reviewAsked(manifest) : buildFinished(manifest)) ? 'review' : 'implementation');

/** Whether the unit's spec is under way: its topics settled or its spec written, its build not begun. @param {string} cwd @param {Record<string, any>} manifest */
const specUnderWay = (cwd, manifest) => !buildBegun(manifest) && !quickFixBuild(manifest) && (topicsSettled(manifest) || pastItsSpec(cwd, manifest));

/** Whether the unit has come to finish: its build finished, or a quick-fix's fixes begun. @param {Record<string, any>} manifest */
const atFinish = (manifest) => (quickFixBuild(manifest) ? fixesBegun(manifest) : buildFinished(manifest));

/** @param {WaitKind} kind @param {string} id @param {string} text @param {Next} next @param {string|null} [topic] @returns {Wait} */
const wait = (kind, id, text, next, topic = null) => ({ kind, id, text, topic, next });

/**
 * The places a unit's raises wait at, where a raise sealed there is read: a
 * bug's investigation under way, its topic and its own level; a
 * quick-fix's fixes under way, its build and its review.
 * @param {Record<string, any>} manifest @returns {{phase: string, topic: string|null}[]}
 */
function raisePlaces(manifest) {
  const unit = manifest.name;
  if (manifest.work_type === 'bugfix' && itemOf(manifest, 'investigation', unit)?.status === 'in-progress') {
    return [{ phase: 'investigation', topic: unit }, { phase: 'investigation', topic: null }];
  }
  return quickFixBuild(manifest) && fixesBegun(manifest) ? BUILD_PHASES.map((phase) => ({ phase, topic: null })) : [];
}

/** What a raise asks the person of: its question, or the decision its rows would replace. @param {Seal} seal */
const subjectOf = (seal) => /** @type {string} */ (seal.answers ?? seal.replaces?.entry);

/**
 * Each raise sealed at the unit's places still waiting (the header's): the
 * latest seal of each subject the ledger holds, read from every
 * conversation, but those asked already, by their question's root.
 * @param {Shower} shower @param {Record<string, any>} manifest @param {Seal[]} seals @param {Set<string>} asked
 * @returns {Wait[]}
 */
function sealedWaits({ folded, short }, manifest, seals, asked) {
  const places = raisePlaces(manifest);
  /** @type {Map<string, Seal>} */
  const latest = new Map();
  for (const seal of seals) {
    const { unit, phase, topic } = seal.place;
    if (unit !== manifest.name || seal.parks !== null || !folded.facts.has(subjectOf(seal)) || !places.some((p) => p.phase === phase && p.topic === topic)) continue;
    const subject = seal.answers === null ? subjectOf(seal) : factsOf(folded, seal.answers).root;
    const held = latest.get(subject);
    if (held === undefined || held.at < seal.at) latest.set(subject, seal);
  }
  return [...latest].filter(([subject, seal]) => !asked.has(subject) && sealWaits(folded, seal))
    .map(([, seal]) => wait('question', short(subjectOf(seal)), seal.call.question, intoPhase(manifest, seal.place.phase)));
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
    waits: ids.map((id) => wait('question', short(id), String(show(id).text).replace(/\s+/g, ' ').trim(), intoPhase(manifest, factsOf(folded, id).phase))),
    roots: new Set(ids.map((id) => factsOf(folded, id).root)),
  };
}

/** Approve the map, while a map is staged for the epic: its door the epic's discovery. @param {string} cwd @param {Record<string, any>} manifest @returns {Wait[]} */
function mapGate(cwd, manifest) {
  const unit = manifest.name;
  if (manifest.work_type !== 'epic' || stagedOrNone(cwd, unit) === null) return [];
  return [wait('map', 'approve-the-map', 'Approve the map', { kind: 'handoff', skill: 'leeway-discovery', args: ['none', unit] })];
}

/** Each topic of an epic whose decided gate waits. @param {string} cwd @param {Record<string, any>} manifest @returns {Wait[]} */
function decidedGates(cwd, manifest) {
  if (manifest.work_type !== 'epic') return [];
  const topics = Object.keys(manifest.phases?.discussion?.items ?? {});
  return topics.filter((topic) => decidedWaits(cwd, manifest, topic))
    .map((topic) => wait('decided', topic, `Decided: ${topicTitle(manifest, topic)}`, intoPhase(manifest, 'discussion', topic), topic));
}

/** Finish once its screen draws — a quick-fix's its close — its door where the unit's tasks are built now. @param {string} cwd @param {Record<string, any>} manifest @returns {Wait[]} */
function finishGate(cwd, manifest) {
  if (!atFinish(manifest) || !finishDraws(cwd, manifest.name)) return [];
  return [wait('finish', 'finish', quickFixBuild(manifest) ? 'Close' : 'Finish', intoPhase(manifest, buildPlace(manifest)))];
}

/** A unit's spec: its gaps waiting, and ready to build once its screen draws, which it never does while one waits. @param {string} cwd @param {Record<string, any>} manifest @param {string[]} warnings @returns {Wait[]} */
function specWaits(cwd, manifest, warnings) {
  if (!specUnderWay(cwd, manifest)) return [];
  const door = intoPhase(manifest, 'specification');
  return [
    ...waitingGaps(cwd, manifest.name, warnings).map(({ short, text }) => wait('question', short, text, door)),
    ...(readyDraws(cwd, manifest.name) ? [wait('ready', 'ready-to-build', 'Ready to build', door)] : []),
  ];
}

/** The questions the unit's build and its review wait on, parked in the ledger. @param {string} cwd @param {Record<string, any>} manifest @returns {Wait[]} */
function parkedWaits(cwd, manifest) {
  if (!tasksBegun(manifest)) return [];
  const door = intoPhase(manifest, buildPlace(manifest));
  return waitingQuestions(cwd, [manifest.name]).waiting.map(({ question, asks }) => wait('question', question, asks, door));
}

/** Each decided topic an answer it relied on, replaced since, holds (10.2.6). @param {Shower} shower @param {string} root @param {Record<string, any>} manifest @returns {Wait[]} */
function affectedWaits(shower, root, manifest) {
  const phase = mailPhase(manifest.work_type);
  if (phase === null) return [];
  const unit = manifest.name;
  return answerAffected(shower, { unit, topic: null }, root).waiting
    .filter((topic) => topic !== null && itemOf(manifest, phase, topic)?.status === 'completed')
    .map((topic) => wait('affected', /** @type {string} */ (topic), `"${topicTitle(manifest, /** @type {string} */ (topic))}": a decision it relies on changed`, intoPhase(manifest, phase, topic), topic));
}

/**
 * What waits on the person in each unit given, in its order (the header's):
 * read in one pass of the ledger and one read of the conversations' seals,
 * the verdicts with `verdicts`; and what the reads said.
 * @param {string} cwd @param {Record<string, any>[]} manifests units in progress
 * @param {{verdicts?: boolean}} [opts]
 * @returns {{waits: Map<string, Wait[]>, warnings: string[]}}
 */
function waitsOf(cwd, manifests, { verdicts = false } = {}) {
  /** @type {string[]} */
  const warnings = [];
  const root = stateRoot(cwd);
  /** @type {Seal[]|undefined} */
  let seals;
  const waits = readShown(root, warnings, (shower) => {
    const queue = verdicts ? queueOf(shower.folded, evidenceOf(root)) : [];
    return new Map(manifests.map((manifest) => {
      const unit = manifest.name;
      const asked = askedWaits(shower, manifest);
      const sealed = raisePlaces(manifest).length === 0 ? [] : sealedWaits(shower, manifest, seals ??= everySeal(), asked.roots);
      return [unit, [
        ...mapGate(cwd, manifest),
        ...decidedGates(cwd, manifest),
        ...specWaits(cwd, manifest, warnings),
        ...parkedWaits(cwd, manifest),
        ...asked.waits,
        ...sealed,
        ...finishGate(cwd, manifest),
        ...affectedWaits(shower, root, manifest),
        ...queue.filter((id) => standingOf(shower.folded, id).unit === unit).map((id) => wait('verdict', shower.short(id), String(shower.show(id).text), VERDICTS)),
      ]];
    }));
  });
  return { waits, warnings };
}

module.exports = { waitsOf };
