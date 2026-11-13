'use strict';

// ---------------------------------------------------------------------------
// Domain ring: All work on the board (20.16) — the project's units in
// progress, its roadmap, its inbox and its units complete — and the banner
// at the start menu or a project-level place.
//
// - Each unit's phase is its standing's (board-standing.cjs), as its tab
//   and its banner have it. What waits on the person in it is counted from
//   its one list as the start menu's row counts it (start-menu.cjs, 18.2.3),
//   never its verdicts, and its conclude besides (20.12.5); the project's
//   total sums them.
// - How far a unit has come, by the phase it is in: the gate ending it
//   waiting on the person, by its name — finish, a quick-fix's close, or an
//   investigation's conclude; an epic's discovery its topics on the map,
//   its discussion its topics decided of all, and a unit of a type the
//   reshape retires waiting on the migration's cut, as its menu row says
//   them (progress.cjs); a bug's investigation how far its hunt has come;
//   the specification where it stands, as its banner says it; the build its
//   tasks done of all, a quick-fix its fixes done of all, the review its
//   round, as its banner says it — a quick-fix's too — each stopped where
//   nothing can go on; nothing for a linear unit's discussion, nor a build
//   or review not run by its cut — under the old plan, its tracker not the
//   cut's until 29.17. A unit's tracker is read
//   once its build runs by its cut, or a quick-fix's fixes have begun, one
//   copy of its store a call.
// - A session is in a unit where this one is, or another holds a presence
//   in it.
// - The roadmap is its waiting items, those no unit has pulled and none
//   archived, under their horizons in the roadmap's order, those on none
//   last, each by its summary, a topic postponed out of an epic by its title
//   there, with the epic's; the inbox, its captures by kind.
// ---------------------------------------------------------------------------

const { fact, placeFact } = require('../board-model.cjs');
const { readProjectManifest, listWorkUnitManifests } = require('../../kernel/manifest.cjs');
const { loadActiveManifests } = require('../reads.cjs');
const { scanProject } = require('../presence.cjs');
const { discoverInbox } = require('../start.cjs');
const { projectName } = require('../state-checks.cjs');
const { titlecase } = require('../conventions.cjs');
const { roadmapItems, itemWaiting, itemPostponedFrom, topicTitle, buildByCut, quickFixBuild, tasksBegun } = require('../derivations.cjs');
const { counts } = require('../start-menu.cjs');
const { buildView, buildWords } = require('./board-build.cjs');
const { roundWords } = require('./board-review.cjs');
const { groupByHorizon } = require('./roadmap.cjs');
const { specDoing } = require('./board-spec.cjs');
const { waitingOn, standingOf } = require('./board-standing.cjs');
const { nowOf } = require('../unit-phases.cjs');
const { investigationHowFar } = require('./board-investigation.cjs');
const { quickFixWords } = require('./board-quick-fix.cjs');
const { AT_THE_CUT, epicMeasure } = require('../progress.cjs');

/** @typedef {import('../board.cjs').BoardAt} BoardAt */
/** @typedef {import('../board-model.cjs').AllView} AllView */
/** @typedef {import('../board-model.cjs').WorkLine} WorkLine */

/** Where a unit's build or review has stopped, as its row leads with it. @param {BoardAt} at */
const stoppedWords = (at) => (standingOf(at) === 'stopped' ? 'stopped · ' : '');

/** Whether a unit's tasks are its own, read by the cut or a quick-fix's: none under the old plan. @param {Record<string, any>} manifest */
const ownTasks = (manifest) => buildByCut(manifest) || quickFixBuild(manifest);

/** The gates that end a phase, each waiting on the person by its name: finish, a quick-fix's close, an investigation's conclude. */
const GATES = Object.freeze(['finish', 'conclude']);

/** How far a unit has come, by the phase it is in (the header's). @type {Readonly<Record<string, (at: BoardAt) => string>>} */
const HOW_FAR = Object.freeze({
  discovery: (at) => epicMeasure(at.cwd, at.manifest, 'discovery') ?? '',
  discussion: (at) => epicMeasure(at.cwd, at.manifest, 'discussion') ?? '',
  investigation: investigationHowFar,
  specification: (at) => specDoing(at, waitingOn(at)),
  build: (at) => (buildByCut(at.manifest) ? `${stoppedWords(at)}${buildWords(buildView(at).view)}` : ''),
  implementation: (at) => (quickFixBuild(at.manifest) && tasksBegun(at.manifest) ? `${stoppedWords(at)}${quickFixWords(at)}` : ''),
  review: (at) => {
    if (!ownTasks(at.manifest)) return '';
    const { round, words } = roundWords(at);
    return `${stoppedWords(at)}${words ?? `round ${round} reading`}`;
  },
  cut: () => AT_THE_CUT,
});

/** What waits on the person in a unit, counted (the header's). @param {BoardAt} at */
function waitingCount(at) {
  const waits = waitingOn(at);
  const { gates, questions, topics } = counts(waits);
  return gates + questions + topics + waits.filter(({ kind }) => kind === 'conclude').length;
}

/** How far a unit has come (the header's). @param {BoardAt} at @param {string} phase */
function workStanding(at, phase) {
  const gate = waitingOn(at).find(({ kind }) => GATES.includes(kind));
  if (gate !== undefined) return `${gate.id} waits on you`;
  return /** @type {Record<string, (at: BoardAt) => string>} */ (HOW_FAR)[phase]?.(at) ?? '';
}

/**
 * A unit in progress, as All work lists it.
 * @param {BoardAt} at @param {BoardAt|null} here @param {Set<string>} others
 * @returns {WorkLine}
 */
function workLine(at, here, others) {
  const own = here?.unit === at.unit;
  const { phase } = nowOf(at);
  return {
    unit: at.unit,
    title: at.title,
    type: at.manifest.work_type,
    phase,
    standing: workStanding(at, phase),
    waiting: waitingCount(at),
    session: own ? 'this' : others.has(at.unit) ? 'other' : null,
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

/**
 * The roadmap's waiting items under their horizons, in its order, those on
 * none of them last, as the roadmap's own view groups them.
 * @param {string} cwd @param {Record<string, any>} project @returns {AllView['roadmap']}
 */
function roadmapOf(cwd, project) {
  const waiting = Object.entries(roadmapItems(project)).filter(([, item]) => itemWaiting(item)).map(([name, item]) => ({ name, item, horizon: item.horizon }));
  const units = waiting.some(({ item }) => itemPostponedFrom(item) !== null) ? new Map(listWorkUnitManifests(cwd).map((manifest) => [manifest.name, manifest])) : new Map();
  const horizons = Array.isArray(project.roadmap?.horizons) ? project.roadmap.horizons : [];
  return groupByHorizon(horizons, waiting).map(({ horizon, rows }) => ({ horizon, items: rows.map(({ name, item }) => roadmapLine(units, name, item)) }));
}

/**
 * All work (the header's).
 * @param {string} cwd @param {(unit: string) => BoardAt} at what the board reads for a unit @param {BoardAt|null} here the session's unit @param {boolean} atStart whether the session is at the start menu
 * @returns {{view: AllView}}
 */
function allView(cwd, at, here, atStart) {
  const others = new Set(scanProject(cwd).sessions.filter(({ held, session_id: session }) => held && session !== here?.session).map(({ work_unit: unit }) => unit));
  const inbox = discoverInbox(cwd);
  const units = loadActiveManifests(cwd).map((manifest) => workLine(at(manifest.name), here, others));
  return {
    view: {
      kind: 'all',
      project: projectName(cwd),
      at_start: atStart,
      waiting: units.reduce((sum, { waiting }) => sum + waiting, 0),
      units,
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
  if (finished !== null) return { name: finished.title, state: 'done', facts: [fact(finished.manifest.work_type), fact('complete'), placeFact('at the start menu')] };
  return { name: projectName(cwd), state: 'idle', facts: [placeFact(position === null ? 'at the start menu' : position.name)] };
}

module.exports = { allView, allBanner };
