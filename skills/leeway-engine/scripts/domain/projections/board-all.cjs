'use strict';

// ---------------------------------------------------------------------------
// Domain ring: All work on the board (20.16) — the project's units in
// progress, its roadmap, its inbox and its units complete — and the banner
// at the start menu or a project-level place.
//
// - A unit's phase is discovery for an epic with no topic yet; its build or
//   its review once its build has begun, by the cut (P13); else the phase
//   its pipeline is in (derivations.cjs).
// - How far a unit has come: an epic in discovery its topics on the map, any
//   other epic its topics decided of all; the
//   session's unit's build its tasks done of all, its tracker read; no
//   other unit's tracker is read on every call.
// - What waits on the person in each unit is counted as its banner counts
//   it — its build's questions, else its spec's gaps and then ready to
//   build's yes (board-unit.cjs) — every unit from one read of the ledger,
//   and the project's total sums them.
// - A session is in a unit where this one is, or another holds a presence
//   in it.
// - The roadmap is its waiting items, those no unit has pulled, under their
//   horizons in the roadmap's order, each by its summary, a topic postponed
//   out of an epic by its title there, with the epic's; the inbox, its
//   captures by kind.
// ---------------------------------------------------------------------------

const { readProjectManifest, listWorkUnitManifests } = require('../../kernel/manifest.cjs');
const { WORK_TYPE_PIPELINES } = require('../../kernel/manifest-schema.cjs');
const { stateRoot } = require('../../kernel/state-root.cjs');
const { loadActiveManifests } = require('../reads.cjs');
const { scanProject } = require('../presence.cjs');
const { discoverInbox } = require('../start.cjs');
const { pastItsSpec } = require('../spec-standing.cjs');
const { readQuestions, waitingOf } = require('../questions.cjs');
const { raisedIn, gapsIn } = require('../spec-passes.cjs');
const { isCurrent } = require('../ledger-fold.cjs');
const { projectName } = require('../state-checks.cjs');
const { titlecase } = require('../conventions.cjs');
const { computeUnitPhaseState, buildBegun, buildFinished, roadmapItems, itemJoin, itemPostponedFrom, topicTitle } = require('../derivations.cjs');
const { buildView, buildWords } = require('./board-build.cjs');
const { epicWords, waitsOn, hasTopics } = require('./board-unit.cjs');
const { mapCount } = require('./board-discovery.cjs');
const { counted } = require('./map.cjs');
const { readyWaits } = require('./board-spec.cjs');

/** @typedef {import('../board.cjs').BoardAt} BoardAt */
/** @typedef {import('../board-model.cjs').AllView} AllView */
/** @typedef {import('../board-model.cjs').WorkLine} WorkLine */

/** The phases the build's own words name: the plan's two, read as the build. */
const BUILD_WORDS = Object.freeze({ planning: 'build', implementation: 'build' });

/** A unit's phase (the header's). @param {string} cwd @param {Record<string, any>} manifest */
function phaseOf(cwd, manifest) {
  if (manifest.work_type === 'epic' && !hasTopics(manifest)) return 'discovery';
  if (buildFinished(manifest)) return 'review';
  if (buildBegun(manifest)) return 'build';
  const pipeline = WORK_TYPE_PIPELINES[/** @type {keyof typeof WORK_TYPE_PIPELINES} */ (manifest.work_type)] ?? [];
  const next = computeUnitPhaseState(manifest, pipeline, pastItsSpec(cwd, manifest)).next_phase;
  return /** @type {Record<string, string>} */ (BUILD_WORDS)[next] ?? next;
}

/** How far a unit has come (the header's). @param {string} cwd @param {BoardAt|null} own the session's unit, where this is it @param {Record<string, any>} manifest @param {string} phase */
function workStanding(cwd, own, manifest, phase) {
  if (own !== null && phase === 'build') return buildWords(buildView(own).view);
  if (manifest.work_type !== 'epic') return '';
  return phase === 'discovery' ? `${counted(mapCount(cwd, manifest), 'topic')} on the map` : epicWords(manifest);
}

/**
 * How many wait on the person in each of the units, by unit (the header's).
 * @param {string} cwd @param {Record<string, any>[]} manifests @param {string[]} warnings @returns {Map<string, number>}
 */
function waitingCounts(cwd, manifests, warnings) {
  const units = manifests.map((manifest) => ({ unit: String(manifest.name), kind: waitsOn(cwd, manifest) }));
  const raised = new Map(units.filter(({ kind }) => kind === 'spec').map(({ unit }) => [unit, raisedIn(cwd, unit)]));
  const ready = new Set([...raised.keys()].filter((unit) => readyWaits(cwd, unit, warnings)));
  return readQuestions(stateRoot(cwd), warnings, (read) => {
    const current = raised.size === 0 ? [] : [...read.facts.keys()].filter((id) => isCurrent(read, id));
    const atSpec = (/** @type {string} */ unit) => {
      const { asked, raised: waiting } = gapsIn(read, unit, current, raised.get(unit) ?? []);
      return asked.length + waiting.length + (ready.has(unit) ? 1 : 0);
    };
    return new Map(units.map(({ unit, kind }) => [unit, kind === 'question' ? waitingOf(read, unit).length : kind === 'spec' ? atSpec(unit) : 0]));
  });
}

/**
 * A unit in progress, as All work lists it.
 * @param {string} cwd @param {BoardAt|null} here @param {Set<string>} others @param {Map<string, number>} waiting @param {Record<string, any>} manifest
 * @returns {WorkLine}
 */
function workLine(cwd, here, others, waiting, manifest) {
  const own = here?.unit === manifest.name ? here : null;
  const phase = phaseOf(cwd, manifest);
  return {
    unit: manifest.name,
    title: titlecase(manifest.name),
    type: manifest.work_type,
    phase,
    standing: workStanding(cwd, own, manifest, phase),
    waiting: waiting.get(manifest.name) ?? 0,
    session: own !== null ? 'this' : others.has(manifest.name) ? 'other' : null,
  };
}

/**
 * A roadmap item as ROADMAP lists it: by its summary, or — a topic postponed
 * out of an epic — by the topic's title in the epic, with the epic's.
 * @param {Map<string, Record<string, any>>} units every unit's manifest, by name @param {string} name @param {Record<string, any>} item
 */
function roadmapLine(units, name, item) {
  const from = itemPostponedFrom(item);
  if (from === null) return { title: String(item.summary ?? name), from: null };
  return { title: topicTitle(units.get(from.work_unit) ?? {}, from.topic), from: titlecase(from.work_unit) };
}

/** The roadmap's waiting items under their horizons, in its order. @param {string} cwd @param {Record<string, any>} project @returns {AllView['roadmap']} */
function roadmapOf(cwd, project) {
  const waiting = Object.entries(roadmapItems(project)).filter(([, item]) => itemJoin(item) === null);
  const units = waiting.some(([, item]) => itemPostponedFrom(item) !== null) ? new Map(listWorkUnitManifests(cwd).map((manifest) => [manifest.name, manifest])) : new Map();
  const horizons = Array.isArray(project.roadmap?.horizons) ? project.roadmap.horizons : [];
  return horizons.flatMap((/** @type {string} */ horizon) => {
    const items = waiting.filter(([, item]) => item.horizon === horizon).map(([name, item]) => roadmapLine(units, name, item));
    return items.length === 0 ? [] : [{ horizon, items }];
  });
}

/**
 * All work (the header's).
 * @param {string} cwd @param {BoardAt|null} here the session's unit @param {boolean} atStart whether the session is at the start menu @param {string[]} warnings
 * @returns {{view: AllView}}
 */
function allView(cwd, here, atStart, warnings) {
  const others = new Set(scanProject(cwd).sessions.filter(({ held, session_id: session }) => held && session !== here?.session).map(({ work_unit: unit }) => unit));
  const inbox = discoverInbox(cwd);
  const active = loadActiveManifests(cwd);
  const waiting = waitingCounts(cwd, active, warnings);
  return {
    view: {
      kind: 'all',
      project: projectName(cwd),
      at_start: atStart,
      waiting: [...waiting.values()].reduce((sum, count) => sum + count, 0),
      units: active.map((manifest) => workLine(cwd, here, others, waiting, manifest)),
      roadmap: roadmapOf(cwd, readProjectManifest(cwd)),
      inbox: [
        ...inbox.ideas.map(({ title }) => ({ kind: 'idea', title })),
        ...inbox.bugs.map(({ title }) => ({ kind: 'bug', title })),
        ...inbox.quickfixes.map(({ title }) => ({ kind: 'quick-fix', title })),
      ],
      complete: listWorkUnitManifests(cwd).filter(({ status }) => status === 'completed').map(({ name, work_type: type }) => ({ unit: name, title: titlecase(name), type })),
    },
  };
}

/**
 * The banner at no unit: the project's, at the start menu or the
 * project-level place the session is at; and, once a unit's finish hands the
 * session to the start menu, that unit's close (D38).
 * @param {string} cwd @param {import('../conversation.cjs').Position|null} position @param {BoardAt|null} finished
 * @returns {import('../board-model.cjs').Banner}
 */
function allBanner(cwd, position, finished) {
  const fact = (/** @type {string} */ text) => ({ text, needs: false });
  if (finished !== null) return { name: finished.title, state: 'done', facts: [fact(finished.manifest.work_type), fact('complete'), fact('at the start menu')] };
  return { name: projectName(cwd), state: 'idle', facts: [fact(position === null ? 'at the start menu' : position.name)] };
}

module.exports = { allView, allBanner };
