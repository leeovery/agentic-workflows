'use strict';

// ---------------------------------------------------------------------------
// Domain ring: manage and the closed units (18.3), each drawn in the menus'
// frame (menus.cjs), which drops the conversation's position as the start
// menu does (20.3.3).
//
// - `render manage`: every unit the project holds, in progress, completed
//   and cancelled, in that order and by type within each as the start menu
//   lists them, each with its type and, closed, how it closed; a number
//   opens the unit's own, and b/back draws the start menu (18.3.4). Setup,
//   the drivers and the matrix join it with their phases.
// - `render manage-unit <unit> [--from closed]`: the unit under the rule,
//   "{Unit} ({type})",
//   and what can be done to it as it stands (18.3.4–18.3.6): a feature in
//   progress before its spec, p/pivot, and o/absorb while an epic before its
//   spec can take it in — the same rules the verbs refuse by (spec-standing.cjs,
//   workunit-absorb.cjs) — then c/cancel for any unit in progress, through
//   its confirm (8.8.8); a cancelled unit, r/reactivate; a completed one,
//   nothing yet. b/back draws the list it was opened from — manage, or with
//   `--from closed` the closed units — and Ask leads into the conversation.
// - `render closed`: the completed units, then the cancelled, each opening
//   its own in manage, from the closed units; b/back draws the start menu
//   (18.2.10).
// - `render absorb-target <feature>`, the absorb's gate: the epics in
//   progress before their spec that could take the feature in, numbered,
//   their names by number in a DATA section, each carrying on in the
//   conversation where Claude drafts the topic; b/back draws the feature's
//   own in manage.
// - `render absorb-confirm-gate <feature> --into <epic> --topic <name>
//   --summary <text> [--description <text>]`: what the absorb moves, read
//   off the feature, then its confirm, refused where the absorb would be
//   (`absorbStands`) — its yes the absorb as given, its no the feature's own
//   in manage.
// ---------------------------------------------------------------------------

const { titlecase } = require('../conventions.cjs');
const { loadAllManifests, loadActiveManifests } = require('../reads.cjs');
const { knownUnit, noUnit } = require('../topic-standing.cjs');
const { pastItsSpec } = require('../spec-standing.cjs');
const { itemOf } = require('../derivations.cjs');
const { isParentExperimentId } = require('../../kernel/manifest-schema.cjs');
const { absorbStands, absorbableFeature, absorbedMaterial } = require('../workunit-absorb.cjs');
const { stands } = require('../staged-payload.cjs');
const { MENUS, drawMenu } = require('../menus.cjs');
const { typeRank } = require('./start-menu.cjs');
const { absorbSummary } = require('./transactions.cjs');
const { section, dataSection, menu, cmdOption, bareOption, MENU_INSTRUCTION } = require('./surfaces.cjs');

/** @typedef {import('../menus.cjs').MenuRow} MenuRow */
/** @typedef {import('../menus.cjs').MenuScreen} MenuScreen */
/** @typedef {import('./surfaces.cjs').Next} Next */

/** The order units are listed in, by status. */
const STATUS_ORDER = Object.freeze(['in-progress', 'completed', 'cancelled']);

/** How a closed unit's status reads beside its type. @type {Readonly<Record<string, string>>} */
const CLOSED_AS = Object.freeze({ completed: 'complete', cancelled: 'cancelled' });

/** A row leading into the conversation. @type {Next} */
const CARRY_ON = Object.freeze({ kind: 'continue' });

/** @param {...string} argv @returns {Next} */
const engine = (...argv) => ({ kind: 'engine', argv });

const BACK_TO_START = Object.freeze({ label: 'Back to the start menu', next: engine('render', 'start-menu') });

/** What a unit is, as its row and its heading say it: its type, and how it closed where it has. @param {Record<string, any>} manifest */
function kindOf({ work_type: type, status }) {
  return Object.hasOwn(CLOSED_AS, status) ? `${type}, ${CLOSED_AS[status]}` : String(type);
}

/**
 * The units as manage lists them (the header's).
 * @param {Record<string, any>[]} manifests @returns {Record<string, any>[]}
 */
const listed = (manifests) => manifests
  .filter((m) => STATUS_ORDER.includes(m.status))
  .map((m, at) => ({ m, at }))
  .sort((a, b) => STATUS_ORDER.indexOf(a.m.status) - STATUS_ORDER.indexOf(b.m.status) || typeRank(a.m.work_type) - typeRank(b.m.work_type) || a.at - b.at)
  .map(({ m }) => m);

/** The lists a unit is opened from, each the unit's way back. */
const LISTS = Object.freeze({
  manage: Object.freeze({ label: 'Back to manage', next: engine('render', 'manage'), flag: /** @type {string[]} */ ([]) }),
  closed: Object.freeze({ label: 'Back to the closed units', next: engine('render', 'closed'), flag: ['--from', 'closed'] }),
});

/** @typedef {keyof typeof LISTS} List */

/** A unit's row on `list`, opening its own in manage. @param {List} list */
const unitRowOn = (list) => (/** @type {Record<string, any>} */ manifest, /** @type {number} */ at) => /** @type {MenuRow} */ ({
  key: at + 1,
  label: { head: titlecase(manifest.name), tail: kindOf(manifest) },
  next: engine('render', 'manage-unit', manifest.name, ...LISTS[list].flag),
});

/** Manage's screen over the project's units (the header's). @param {Record<string, any>[]} manifests @returns {MenuScreen} */
function manageScreen(manifests) {
  return { shows: [], question: 'What would you like to manage?', rows: listed(manifests).map(unitRowOn('manage')), back: BACK_TO_START };
}

/** The closed units' screen (the header's). @param {Record<string, any>[]} manifests @returns {MenuScreen} */
function closedScreen(manifests) {
  const closed = listed(manifests.filter((m) => Object.hasOwn(CLOSED_AS, m.status)));
  return {
    shows: [],
    ...(closed.length === 0 ? { statement: 'Nothing has finished or been cancelled yet.' } : {}),
    question: 'Which work unit?',
    rows: closed.map(unitRowOn('closed')),
    back: BACK_TO_START,
  };
}

/**
 * The epics that could take `feature` in: in progress, before their spec
 * (spec-standing.cjs), the epic's spec standing read, never its phase.
 * @param {string} cwd @param {string} feature @returns {string[]}
 */
function absorbTargets(cwd, feature) {
  return loadActiveManifests(cwd).filter((m) => m.work_type === 'epic' && m.name !== feature && !pastItsSpec(cwd, m)).map((m) => m.name);
}

/** Whether a feature in progress before its spec can be absorbed: its discussion there, and an epic to take it. @param {string} cwd @param {Record<string, any>} manifest */
const absorbable = (cwd, manifest) => stands(() => absorbableFeature(cwd, manifest.name, manifest)) && absorbTargets(cwd, manifest.name).length > 0;

/**
 * What can be done to the unit as it stands (the header's).
 * @param {string} cwd @param {Record<string, any>} manifest @returns {MenuRow[]}
 */
function unitRows(cwd, manifest) {
  const unit = manifest.name;
  if (manifest.status === 'cancelled') return [{ key: 'r', word: 'reactivate', label: 'Bring it back — in progress again', next: engine('workunit', 'reactivate', unit) }];
  if (manifest.status !== 'in-progress') return [];
  const reshaped = manifest.work_type === 'feature' && !pastItsSpec(cwd, manifest);
  return [
    ...(reshaped ? [{ key: 'p', word: 'pivot', label: 'Make it an epic — before its spec', next: CARRY_ON }] : []),
    ...(reshaped && absorbable(cwd, manifest) ? [{ key: 'o', word: 'absorb', label: 'Join an epic as one of its topics', next: engine('render', 'absorb-target', unit) }] : []),
    { key: 'c', word: 'cancel', label: 'Mark as cancelled', next: engine('render', 'cancel-gate', unit) },
  ];
}

/**
 * A unit's screen in manage (the header's), opened from `list`.
 * @param {string} cwd @param {Record<string, any>} manifest @param {List} [list] @returns {MenuScreen}
 */
function manageUnitScreen(cwd, manifest, list = 'manage') {
  const { label, next } = LISTS[list];
  return {
    shows: [],
    statement: `${titlecase(manifest.name)} (${kindOf(manifest)})`,
    rows: unitRows(cwd, manifest),
    back: { label, next },
    prompt: { label: 'Ask', description: 'Ask a question about this work unit', next: CARRY_ON },
  };
}

/** The unit a render names, refused where the project has none. @param {string} cwd @param {string|undefined} unit @param {string} usage */
function unitNamed(cwd, unit, usage) {
  if (unit === undefined) throw new Error(`Usage: engine ${usage}`);
  const manifest = knownUnit(cwd, unit);
  if (manifest === null) throw new Error(noUnit(unit));
  return manifest;
}

/** `render manage`. @param {string} cwd @returns {string} */
const manageSurface = (cwd) => drawMenu(cwd, MENUS.manage, {}, manageScreen(loadAllManifests(cwd)));

/** `render closed`. @param {string} cwd @returns {string} */
const closedSurface = (cwd) => drawMenu(cwd, MENUS.closed, {}, closedScreen(loadAllManifests(cwd)));

/**
 * `render manage-unit <unit> [--from closed]`.
 * @param {string} cwd @param {string|undefined} unit @param {string|undefined} from @returns {string}
 */
function manageUnitSurface(cwd, unit, from) {
  const usage = 'render manage-unit <work-unit> [--from closed]';
  if (from !== undefined && from !== 'closed') throw new Error(`Usage: engine ${usage}`);
  const manifest = unitNamed(cwd, unit, usage);
  return drawMenu(cwd, MENUS['manage-unit'], { arg: manifest.name, flags: { from } }, manageUnitScreen(cwd, manifest, from ?? 'manage'));
}

/** A feature the absorb's gates draw for, refused where it cannot be absorbed. @param {string} cwd @param {string|undefined} feature @param {string} usage */
function featureToAbsorb(cwd, feature, usage) {
  const manifest = unitNamed(cwd, feature, usage);
  if (manifest.status !== 'in-progress') throw new Error(`${manifest.name} is ${manifest.status} — only work in progress is absorbed`);
  absorbableFeature(cwd, manifest.name, manifest);
  return manifest;
}

/** Back to the feature's own in manage. @param {string} feature */
const backToUnit = (feature) => engine('render', 'manage-unit', feature);

/**
 * `render absorb-target <feature>` (the header's).
 * @param {string} cwd @param {string|undefined} feature @returns {string}
 */
function absorbTargetSurface(cwd, feature) {
  const { name } = featureToAbsorb(cwd, feature, 'render absorb-target <feature>');
  const epics = absorbTargets(cwd, name);
  if (epics.length === 0) throw new Error(`no epic can take ${name} in — absorb goes into an epic in progress, before its spec`);
  return dataSection(epics.map((epic, at) => `epic ${at + 1}: ${epic}`)) + section('MENU: absorb target', MENU_INSTRUCTION, menu(
    `Absorbing ${titlecase(name)} moves its discussion, experiments, seeds, assets and spikes into the epic as a new topic, and removes it as a feature.`,
    [
      ...epics.map((epic, at) => cmdOption(String(at + 1), null, titlecase(epic), { next: CARRY_ON })),
      cmdOption('b', 'back', `Back to ${titlecase(name)}`, { next: backToUnit(name) }),
    ],
    { question: 'Which epic should take it in?' },
  ));
}

/**
 * `render absorb-confirm-gate <feature> --into <epic> --topic <name>
 * --summary <text> [--description <text>]` (the header's).
 * @param {string} cwd @param {{dotpath?: string, into?: string, topic?: string, summary?: string, description?: string}} args
 * @returns {string}
 */
function absorbConfirmSurface(cwd, { dotpath, into, topic, summary, description }) {
  const usage = 'render absorb-confirm-gate <feature> --into <epic> --topic <name> --summary <text> [--description <text>]';
  if (into === undefined || topic === undefined || summary === undefined) throw new Error(`Usage: engine ${usage}`);
  const manifest = featureToAbsorb(cwd, dotpath, usage);
  const feature = manifest.name;
  absorbStands(cwd, feature, { into, topic, summary, description });
  const series = itemOf(manifest, 'experiment', feature);
  const facts = {
    discussion: /** @type {Record<string, any>} */ (itemOf(manifest, 'discussion', feature)).status,
    experiments: Object.keys(series?.experiments ?? {}).filter(isParentExperimentId).length,
    seeds: Array.isArray(manifest.seeds) ? manifest.seeds.length : 0,
    ...absorbedMaterial(cwd, feature),
  };
  const absorb = ['workunit', 'absorb', feature, '--into', into, '--topic', topic, '--summary', summary, ...(description === undefined ? [] : ['--description', description])];
  return absorbSummary(feature, into, topic, facts) + section('MENU: absorb confirm gate', MENU_INSTRUCTION, menu('', [
    bareOption('y', 'yes', { next: engine(...absorb) }),
    bareOption('n', 'no', { next: backToUnit(feature) }),
  ], { question: 'Absorb it?' }));
}

module.exports = { manageScreen, closedScreen, manageUnitScreen, manageSurface, closedSurface, manageUnitSurface, absorbTargetSurface, absorbConfirmSurface };
