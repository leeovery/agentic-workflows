'use strict';

// ---------------------------------------------------------------------------
// Domain ring: All work on the board (20.16) — the project's units in
// progress, its roadmap, its inbox and its units complete — and the banner
// at the start menu or a project-level place.
//
// - Each unit's phase, and what waits on the person in it, counted, are its
//   standing's (board-standing.cjs), as its tab and its banner have them,
//   and the project's total sums them.
// - How far a unit has come: an epic in discovery its topics on the map, any
//   other epic its topics decided of all; finish waiting on the person; the
//   session's unit's build its tasks done of all. A unit's tracker is read
//   for the session's unit's build, and for another's only where a round
//   has ended its review, whose finish may wait on the person.
// - A session is in a unit where this one is, or another holds a presence
//   in it.
// - The roadmap is its waiting items, those no unit has pulled, under their
//   horizons in the roadmap's order, each by its summary, a topic postponed
//   out of an epic by its title there, with the epic's; the inbox, its
//   captures by kind.
// ---------------------------------------------------------------------------

const { readProjectManifest, listWorkUnitManifests } = require('../../kernel/manifest.cjs');
const { loadActiveManifests } = require('../reads.cjs');
const { scanProject } = require('../presence.cjs');
const { discoverInbox } = require('../start.cjs');
const { projectName } = require('../state-checks.cjs');
const { titlecase } = require('../conventions.cjs');
const { roadmapItems, itemJoin, itemPostponedFrom, topicTitle } = require('../derivations.cjs');
const { buildView, buildWords } = require('./board-build.cjs');
const { epicWords } = require('./board-unit.cjs');
const { nowOf, waitingOn } = require('./board-standing.cjs');
const { mapCount } = require('./board-discovery.cjs');
const { counted } = require('./map.cjs');

/** @typedef {import('../board.cjs').BoardAt} BoardAt */
/** @typedef {import('../board-model.cjs').AllView} AllView */
/** @typedef {import('../board-model.cjs').WorkLine} WorkLine */

/** How far a unit has come (the header's). @param {BoardAt} at @param {boolean} own whether it is the session's unit @param {string} phase */
function workStanding(at, own, phase) {
  if (waitingOn(at).some(({ kind }) => kind === 'finish')) return 'finish waits on you';
  if (own && phase === 'build') return buildWords(buildView(at).view);
  if (at.manifest.work_type !== 'epic') return '';
  return phase === 'discovery' ? `${counted(mapCount(at.cwd, at.manifest), 'topic')} on the map` : epicWords(at.manifest);
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
    standing: workStanding(at, own, phase),
    waiting: waitingOn(at).length,
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
  const fact = (/** @type {string} */ text) => ({ text, needs: false });
  if (finished !== null) return { name: finished.title, state: 'done', facts: [fact(finished.manifest.work_type), fact('complete'), fact('at the start menu')] };
  return { name: projectName(cwd), state: 'idle', facts: [fact(position === null ? 'at the start menu' : position.name)] };
}

module.exports = { allView, allBanner };
