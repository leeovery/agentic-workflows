'use strict';

// ---------------------------------------------------------------------------
// Domain ring: All work on the board (20.16) — the project's units in
// progress, its roadmap, its inbox and its units complete — and the banner
// at the start menu or a project-level place.
//
// - A unit's phase is its build or its review once its build has begun, by
//   the cut (P13); else the phase its pipeline is in (derivations.cjs).
// - How far a unit has come: an epic's topics decided of all; the
//   session's unit's build its tasks done of all, its tracker read; no
//   other unit's tracker is read on every call.
// - The questions waiting on the person in each unit, and across them all,
//   are read in one read of the ledger (questions.cjs).
// - A session is in a unit where this one is, or another holds a presence
//   in it.
// - The roadmap is its waiting items, those no unit has pulled, under their
//   horizons in the roadmap's order; the inbox, its captures by kind.
// ---------------------------------------------------------------------------

const { readProjectManifest, listWorkUnitManifests } = require('../../kernel/manifest.cjs');
const { WORK_TYPE_PIPELINES } = require('../../kernel/manifest-schema.cjs');
const { stateRoot } = require('../../kernel/state-root.cjs');
const { loadActiveManifests } = require('../reads.cjs');
const { scanProject } = require('../presence.cjs');
const { discoverInbox } = require('../start.cjs');
const { pastItsSpec } = require('../spec-standing.cjs');
const { waitingCounts } = require('../questions.cjs');
const { projectName } = require('../state-checks.cjs');
const { titlecase } = require('../conventions.cjs');
const { computeUnitPhaseState, buildBegun, buildFinished, roadmapItems, itemJoin } = require('../derivations.cjs');
const { buildView, buildWords } = require('./board-build.cjs');
const { epicWords } = require('./board-unit.cjs');

/** @typedef {import('../board.cjs').BoardAt} BoardAt */
/** @typedef {import('../board-model.cjs').AllView} AllView */
/** @typedef {import('../board-model.cjs').WorkLine} WorkLine */

/** The phases the build's own words name: the plan's two, read as the build. */
const BUILD_WORDS = Object.freeze({ planning: 'build', implementation: 'build' });

/** A unit's phase (the header's). @param {string} cwd @param {Record<string, any>} manifest */
function phaseOf(cwd, manifest) {
  if (buildFinished(manifest)) return 'review';
  if (buildBegun(manifest)) return 'build';
  const pipeline = WORK_TYPE_PIPELINES[/** @type {keyof typeof WORK_TYPE_PIPELINES} */ (manifest.work_type)] ?? [];
  const next = computeUnitPhaseState(manifest, pipeline, pastItsSpec(cwd, manifest)).next_phase;
  return /** @type {Record<string, string>} */ (BUILD_WORDS)[next] ?? next;
}

/** How far a unit has come (the header's). @param {BoardAt|null} own the session's unit, where this is it @param {Record<string, any>} manifest @param {string} phase */
function workStanding(own, manifest, phase) {
  if (own !== null && phase === 'build') return buildWords(buildView(own).view);
  return manifest.work_type === 'epic' ? epicWords(manifest) : '';
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
    standing: workStanding(own, manifest, phase),
    waiting: waiting.get(manifest.name) ?? 0,
    session: own !== null ? 'this' : others.has(manifest.name) ? 'other' : null,
  };
}

/** The roadmap's waiting items under their horizons, in its order. @param {Record<string, any>} project @returns {AllView['roadmap']} */
function roadmapOf(project) {
  const waiting = Object.entries(roadmapItems(project)).filter(([, item]) => itemJoin(item) === null);
  const horizons = Array.isArray(project.roadmap?.horizons) ? project.roadmap.horizons : [];
  return horizons.flatMap((/** @type {string} */ horizon) => {
    const items = waiting.filter(([, item]) => item.horizon === horizon).map(([name, item]) => ({ title: String(item.summary ?? name), from: item.postponed_from ?? null }));
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
  const waiting = waitingCounts(stateRoot(cwd), active.map(({ name }) => name), warnings);
  return {
    view: {
      kind: 'all',
      project: projectName(cwd),
      at_start: atStart,
      waiting: [...waiting.values()].reduce((sum, count) => sum + count, 0),
      units: active.map((manifest) => workLine(cwd, here, others, waiting, manifest)),
      roadmap: roadmapOf(readProjectManifest(cwd)),
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
 * The banner at no unit: at the start menu, or the project-level place the
 * session is at.
 * @param {import('../conversation.cjs').Position|null} position @returns {{state: 'idle', facts: {text: string, needs: boolean}[]}}
 */
function allBanner(position) {
  return { state: 'idle', facts: [{ text: position === null ? 'at the start menu' : position.name, needs: false }] };
}

module.exports = { allView, allBanner };
