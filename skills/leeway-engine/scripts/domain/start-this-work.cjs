'use strict';

// ---------------------------------------------------------------------------
// Domain ring: start this work (8.8.1, 8.8.2) — the authority gate at the
// work-type commit, its screen `render start-this-work` and its yes
// `start-this-work yes`, which creates the unit. Its screen is drawn by
// projections/discovery-gates.cjs.
//
// - Claude's payload is staged in the product's cache with `--file`, and
//   nothing is created before the person's yes (8.S16). It names the work's
//   type — a feature, an epic, a bugfix or a quick-fix, never cross-cutting
//   (8.2.4) — its name, its description, the one-line reason for the type,
//   the inbox items and the roadmap items it starts from, and the places in
//   the product's sessions that shaped it (8.14.3); a feature or a bugfix
//   also its one topic's brief (8.7.7), the topic being the unit, which is
//   refused beside a waiting roadmap item of its name it does not start from
//   (8.1.6). The screen draws from the staged payload again without `--file`.
// - The name is Claude's to derive, with no question (8.8.10): a name a unit
//   has already is refused, and so is a taken name with a number appended,
//   so Claude derives a more specific one (8.8.18).
// - The yes checks the staged payload against the project as it stands, then,
//   as one transaction under the writer lock, writes the unit (workunit-
//   create.cjs) — its manifest, its seeds moved out of the inbox, each
//   roadmap item's note copied in beside them with the item as it stood
//   (4.11.16), and its first discovery log holding a pointer line into the product's sessions
//   for each place that shaped it — its one topic's brief, and then, in one
//   write of the project manifest, the unit's registration, each roadmap item
//   it starts from joined to it, and the product's open session closed
//   (8.14.11). A failure part-way leaves no unit. One commit takes it all.
// - What comes next: a feature into its discussion, a bugfix into its
//   investigation, a quick-fix into its scoping, each a handoff (24.1.2); an
//   epic carries the conversation on into its own discovery, with no handoff,
//   to shape its topics (8.8.13, 24.S15).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { readProjectManifest, writeProjectManifestAtomic, withProjectLock } = require('../kernel/manifest.cjs');
const { PRODUCT } = require('../kernel/manifest-schema.cjs');
const { statePath } = require('../kernel/state-root.cjs');
const { roadmapItems, itemJoin, briefFile } = require('./derivations.cjs');
const { waitingTwin, noteOfSource, notePath } = require('./roadmap.cjs');
const { PRODUCT_SESSIONS } = require('./layout.cjs');
const { commitStateTail, noteCommitOutcome } = require('./commit.cjs');
const { productSession } = require('./discovery-session.cjs');
const { SHAPED_BY } = require('./discovery-entry.cjs');
const { draftIn, writeBrief, twinRefusal } = require('./discovery-map.cjs');
const {
  FIRST_LOG, assertLegalWorkUnitName, workUnitTaken, checkWorkUnit, writeWorkUnit, unwriteWorkUnit, registerWorkUnit, indexLanded, createdPaths, landedSeeds,
} = require('./workunit-create.cjs');
const { filled, shaped, listed, readPayload, stage, stagedAt, refusing } = require('./staged-payload.cjs');
const { startThisWorkScreen } = require('./projections/discovery-gates.cjs');

/** @typedef {import('./projections/surfaces.cjs').Next} Next */

/**
 * Claude's payload as staged: the work's type, name, description and reason;
 * its inbox seeds and roadmap items; the places in the product's sessions
 * that shaped it, state-relative; and a one-topic unit's brief draft.
 * @typedef {{type: string, name: string, description: string, reason: string, seeds: string[], roadmap: string[], shaped_by: string[], brief?: string}} Staged
 */

/** The types start this work creates. */
const STARTS = ['feature', 'epic', 'bugfix', 'quick-fix'];

/** The types whose one topic lands at start this work, with its brief (8.7.7). */
const ONE_TOPIC = ['feature', 'bugfix'];

/** Why a type takes no brief at start this work. @type {Readonly<Record<string, string>>} */
const UNBRIEFED = Object.freeze({ epic: 'an epic\'s topics get their briefs as the map is approved', 'quick-fix': 'a quick-fix has no topic to brief' });

/** The phase each type but an epic opens in after its yes. @type {Readonly<Record<string, string>>} */
const OPENS_IN = Object.freeze({ feature: 'discussion', bugfix: 'investigation', 'quick-fix': 'scoping' });

/** A place in the product's sessions: a log, and a section of it where an anchor names one. */
const SHAPING = new RegExp(`^${PRODUCT_SESSIONS.replace(/\./g, '\\.')}/session-\\d+\\.md(#[^\\s()]+)?$`);

/** A taken name with a number appended: its base. */
const NUMBERED = /^(.+)-\d+$/;

const NOTHING_STAGED = 'nothing is staged — render start-this-work --file <payload.json> stages the work';

/** Where the payload is staged, in the product's cache. @param {string} cwd */
function stagedFile(cwd) {
  return statePath(cwd, '.cache', PRODUCT, 'discovery', PRODUCT, 'start-this-work.json');
}

/** Refuses a type start this work does not create. @param {unknown} type @returns {string} */
function startType(type) {
  if (type === 'cross-cutting') throw new Error('discovery never calls work cross-cutting — it is a feature, an epic, a bugfix or a quick-fix');
  if (typeof type !== 'string' || !STARTS.includes(type)) throw new Error(`the type is one of ${STARTS.join(', ')} — got ${JSON.stringify(type)}`);
  return type;
}

/**
 * Refuses a name a unit has already, and a taken name with a number
 * appended: Claude derives a more specific one, never a number (8.8.18).
 * @param {string} cwd @param {unknown} given @returns {string}
 */
function freeName(cwd, given) {
  const name = /** @type {string} */ (given);
  assertLegalWorkUnitName(name);
  if (workUnitTaken(cwd, name)) throw new Error(`a work unit is named "${name}" already — derive a more specific name from the work, never a number`);
  const base = NUMBERED.exec(name)?.[1];
  if (base !== undefined && workUnitTaken(cwd, base)) throw new Error(`"${name}" numbers the taken name "${base}" — derive a more specific name from the work, never a number`);
  return name;
}

/**
 * The places in the product's sessions that shaped the work: at least one,
 * each a log there, a section of it named by an anchor, on disk.
 * @param {string} cwd @param {unknown} given @returns {string[]}
 */
function shapingPlaces(cwd, given) {
  const places = listed(given, 'shaped_by');
  if (places.length === 0) throw new Error(`shaped_by names at least one place in ${PRODUCT_SESSIONS}/ — the talk that shaped the work`);
  return places.map((place) => {
    if (typeof place !== 'string' || !SHAPING.test(place)) throw new Error(`shaped_by: ${JSON.stringify(place)} is no place in the product's sessions — ${PRODUCT_SESSIONS}/session-NNN.md, a section of it named by #anchor`);
    if (!fs.existsSync(statePath(cwd, place.split('#')[0]))) throw new Error(`shaped_by: ${place} names no log on disk`);
    return place;
  });
}

/**
 * The roadmap items the work starts from: each on the roadmap, waiting,
 * named once.
 * @param {Record<string, any>} project @param {unknown} given @returns {string[]}
 */
function roadmapSeeds(project, given) {
  const names = listed(given, 'roadmap');
  return names.map((name, at) => {
    const item = typeof name === 'string' ? roadmapItems(project)[name] : undefined;
    if (item === undefined) throw new Error(`roadmap: the roadmap has no item ${JSON.stringify(name)}`);
    const join = itemJoin(item);
    if (join !== null) throw new Error(`roadmap: "${name}" is joined to work unit "${join.work_unit}" already`);
    if (names.indexOf(name) < at) throw new Error(`roadmap: "${name}" is named twice`);
    return /** @type {string} */ (name);
  });
}

/**
 * Refuses a one-topic unit named like a waiting roadmap item it does not
 * start from: its topic would stand beside the item as a twin (8.1.6).
 * @param {Record<string, any>} project @param {string} type @param {string} name @param {string[]} roadmap
 */
function refuseTwin(project, type, name, roadmap) {
  const twin = ONE_TOPIC.includes(type) ? waitingTwin(project, name) : null;
  if (twin !== null && !roadmap.includes(twin)) throw new Error(twinRefusal(name, twin, (item) => `"roadmap": ["${item}"]`));
}

/**
 * A one-topic unit's brief draft, which it must have; any other type's,
 * which it must not.
 * @param {string} cwd @param {string} type @param {unknown} brief @returns {string|undefined}
 */
function briefDraft(cwd, type, brief) {
  if (!ONE_TOPIC.includes(type)) {
    if (brief !== undefined) throw new Error(`${UNBRIEFED[type]} — drop the brief`);
    return undefined;
  }
  if (!filled(brief)) throw new Error(`a ${type}'s one topic lands with its brief — brief names its draft`);
  draftIn(cwd, brief, 'the brief');
  return brief;
}

/**
 * Claude's payload checked against the project as it stands, as it is
 * staged, with its seeds as inbox items: refused where any part of it could
 * not be created.
 * @param {string} cwd @param {unknown} given
 * @returns {{staged: Staged, seedItems: import('./inbox.cjs').InboxItem[]}}
 */
function checked(cwd, given) {
  const fields = shaped(given, 'the payload', ['type', 'name', 'description', 'reason', 'shaped_by'], ['seeds', 'roadmap', 'brief']);
  const type = startType(fields.type);
  const name = freeName(cwd, fields.name);
  if (!filled(fields.description) || !filled(fields.reason)) throw new Error('the description and the reason are each a non-empty string');
  const seeds = listed(fields.seeds ?? [], 'seeds');
  if (seeds.some((seed) => typeof seed !== 'string')) throw new Error('seeds are inbox paths');
  const seedItems = checkWorkUnit(cwd, name, type, { seeds: /** @type {string[]} */ (seeds) });
  const project = readProjectManifest(cwd);
  const roadmap = roadmapSeeds(project, fields.roadmap ?? []);
  refuseTwin(project, type, name, roadmap);
  const staged = {
    type,
    name,
    description: fields.description,
    reason: fields.reason,
    seeds: /** @type {string[]} */ (seeds),
    roadmap,
    shaped_by: shapingPlaces(cwd, fields.shaped_by),
  };
  const brief = briefDraft(cwd, type, fields.brief);
  return { staged: brief === undefined ? staged : { ...staged, brief }, seedItems };
}

/**
 * The first discovery log: a line for each place in the product's sessions
 * that shaped the unit, linked from the log's folder (8.14.3).
 * @param {string} unit @param {string[]} places state-relative
 */
function firstLogOf(unit, places) {
  const from = path.posix.dirname(`${unit}/${FIRST_LOG}`);
  return places.map((place) => `${SHAPED_BY}[${place}](${path.posix.relative(from, place)})\n`).join('');
}

/**
 * The notes of the roadmap items the unit starts from, each on disk with the
 * item as it stood, for its seeds (4.11.16).
 * @param {string} cwd @param {string[]} roadmap
 * @returns {import('./workunit-create.cjs').NoteSeed[]}
 */
function noteSeedsOf(cwd, roadmap) {
  const items = roadmapItems(readProjectManifest(cwd));
  return roadmap.flatMap((name) => {
    const item = items[name];
    const note = (Array.isArray(item.sources) ? item.sources : []).map(noteOfSource).find((found) => found !== null);
    const at = note ? notePath(note.folder, note.file) : null;
    return at !== null && fs.existsSync(statePath(cwd, at)) ? [{ name, note: at, item: structuredClone(item) }] : [];
  });
}

/** What comes after the yes. @param {string} type @param {string} unit @returns {Next} */
function nextAfter(type, unit) {
  return type === 'epic'
    ? { kind: 'engine', argv: ['enter', 'discovery', unit, '--move'] }
    : { kind: 'handoff', skill: `leeway-${OPENS_IN[type]}-process`, args: [type, unit] };
}

/**
 * `render start-this-work [--file <payload.json>]`: the screen, Claude's
 * payload staged from `--file` or read back as staged.
 * @param {string} cwd @param {{dotpath?: string, file?: string}} args
 * @returns {string}
 */
function startThisWorkSurface(cwd, { dotpath, file }) {
  return refusing('render start-this-work', () => {
    if (dotpath !== undefined) throw new Error(`it takes no address — the unit is the payload's to name, got "${dotpath}"`);
    const staged = file === undefined
      ? /** @type {Staged} */ (stagedAt(stagedFile(cwd), NOTHING_STAGED))
      : stage(stagedFile(cwd), checked(cwd, readPayload(cwd, file)).staged);
    return startThisWorkScreen(staged);
  });
}

/**
 * The project manifest's half of the yes, in one write: the unit
 * registered, each roadmap item it starts from joined to it, and the
 * product's open session closed. Answers the session closed, or null.
 * @param {string} cwd @param {Staged} staged @returns {string|null}
 */
function writeProject(cwd, { type, name, roadmap }) {
  return withProjectLock(cwd, () => {
    const project = readProjectManifest(cwd);
    registerWorkUnit(project, name, type);
    for (const item of roadmap) roadmapItems(project)[item].pulled_to = { work_unit: name };
    const closed = productSession(project);
    delete project.product_session;
    writeProjectManifestAtomic(cwd, project);
    return closed;
  });
}

/**
 * `start-this-work yes`: the person's yes, creating the unit from the
 * staged payload as one transaction.
 * @param {string} cwd
 */
function startThisWorkYes(cwd) {
  const { staged, seedItems } = checked(cwd, stagedAt(stagedFile(cwd), NOTHING_STAGED));
  const { type, name } = staged;
  const draft = staged.brief === undefined ? null : draftIn(cwd, staged.brief, 'the brief');
  const landed = writeWorkUnit(cwd, name, type, {
    description: staged.description, firstLog: firstLogOf(name, staged.shaped_by), seedItems, noteSeeds: noteSeedsOf(cwd, staged.roadmap),
  });
  /** @type {string|null} */
  let closed;
  try {
    if (draft !== null) writeBrief(cwd, name, name, draft.content);
    closed = writeProject(cwd, staged);
  } catch (err) {
    unwriteWorkUnit(cwd, name, landed.seeds);
    throw err;
  }
  if (draft !== null) fs.rmSync(draft.scratch, { force: true });
  fs.rmSync(stagedFile(cwd), { force: true });

  /** @type {string[]} */
  const warnings = [];
  indexLanded(cwd, name, landed, warnings);
  const paths = [...createdPaths(name, landed), ...(closed === null ? [] : [PRODUCT_SESSIONS])];
  const outcome = commitStateTail(cwd, paths, `discovery(${name}): start this work (${type})`, warnings);
  /** @type {Record<string, unknown>} */
  const result = {
    work_unit: name,
    work_type: type,
    seeds: landedSeeds(cwd, name, landed),
    roadmap: staged.roadmap,
    session_log: statePath(cwd, name, FIRST_LOG),
    ...(draft === null ? {} : { brief: statePath(cwd, briefFile(name, name)) }),
    product_session_closed: closed,
    committed: outcome.committed,
    next: nextAfter(type, name),
  };
  if (warnings.length > 0) result.warnings = warnings;
  noteCommitOutcome(result, outcome);
  return result;
}

/**
 * `start-this-work yes`: the verb's answer, its refusal opening on its
 * command.
 * @param {string} cwd @param {string[]} argv
 * @returns {Record<string, unknown>}
 */
function runStartThisWorkVerb(cwd, argv) {
  if (argv.length !== 1 || argv[0] !== 'yes') throw new Error('Usage: engine start-this-work yes');
  return refusing('start-this-work yes', () => startThisWorkYes(cwd));
}

module.exports = { runStartThisWorkVerb, startThisWorkSurface };
