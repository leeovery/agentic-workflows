'use strict';

// ---------------------------------------------------------------------------
// Domain ring: start this work (8.8.1, 8.8.2) — the authority gate at the
// work-type commit, its screen `render start-this-work` and its yes
// `start-this-work yes`, which creates the unit. Its screen is drawn by
// projections/discovery-gates.cjs.
//
// - Claude's payload, written where the entry's DATA names it (discovery-
//   entry.cjs), is staged in the product's cache with `--file`, each a file
//   of the conversation's own, so a start one window writes or stages is
//   never the one another window's yes lands; nothing is created before the
//   person's yes (8.S16). It names the work's type — a feature, an epic, a
//   bugfix or a quick-fix (8.2.4, 19.1.1) — its name, its description, the one-line
//   reason for the type, the inbox items and the roadmap items it starts
//   from, and the places in the product's sessions that shaped it (8.14.3),
//   at least one where the conversation's place is the product's
//   conversation, which a type call's (discovery-entry.cjs) never is; a
//   feature or a bugfix
//   also its one topic's brief (8.7.7), the topic being the unit, which is
//   refused beside a waiting roadmap item of its name it does not start from
//   (8.1.6); an epic also the points from before and the shared files that
//   bear on it, where any do (from-before.cjs); and, in the product's
//   conversation, the picture thinned as the work leaves it, a draft in the
//   cache, which a type call, only reading the picture, never gives, and
//   which is refused, at the stage and at the yes, once the picture is
//   written after it, so the draft never lands over what it gained. The
//   screen draws from the staged payload again without `--file`.
// - The name is Claude's to derive, with no question (8.8.10): a name a unit
//   has already is refused, and so is a taken name with a number appended,
//   so Claude derives a more specific one (8.8.18).
// - The yes checks the staged payload against the project as it stands, then,
//   as one transaction under the writer lock, writes the unit (workunit-
//   create.cjs) — its manifest, its seeds moved out of the inbox, each
//   roadmap item's note copied in beside them (4.11.16), and its first
//   discovery log holding a pointer line into the product's sessions for
//   each place that shaped it — its one topic's brief, an epic's points from
//   before and shared files in its own place, whichever way it started, the
//   thinned picture, and then, in one
//   write of the project manifest, the unit's registration, each roadmap item
//   it starts from joined to it, and the product's open session closed
//   where the work leaves this conversation's talk there — a feature, a
//   bugfix, an epic started where its place is the product's conversation
//   — and no other live window is in that conversation, by its presence
//   row there (presence.cjs) (8.14.11): a quick-fix's yes never closes it,
//   nor a type call's. The yes removes the conversation's payload with its
//   staged copy, and, for work that leaves, its presence row in the
//   product's conversation — its place there kept, which an epic's move
//   departs from; a window in a quick-fix stays in the conversation, and
//   the place it was in, where that is the product's conversation or the
//   roadmap, is kept for the quick-fix's close or cancel to put it back
//   there (topic-leave.cjs). A failure part-way leaves no unit. One commit
//   takes it all.
// - What comes next: a feature into its discussion, a bugfix into its
//   investigation, each a handoff (24.1.2); a quick-fix into its work, its
//   skill invoked in this same conversation, nothing cleared (19.5.1,
//   24.1.5); an epic carries the conversation on into its own discovery,
//   with no handoff, to shape its topics (8.8.13, 24.S15) — moving from the
//   product's conversation, or entering it from a type call, which holds no
//   place to move from.
// - A unit moved to a feature or a bugfix meets the same gate (19.4.22,
//   19.5.9): `workunit move` stages its payload where a start's is staged
//   and draws the same screen, and the yes moves the unit rather than
//   creating one (workunit-move.cjs), handing off as a start of its new type
//   does.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { readProjectManifest, writeProjectManifestAtomic, withProjectLock } = require('../kernel/manifest.cjs');
const { PRODUCT } = require('../kernel/manifest-schema.cjs');
const { statePath } = require('../kernel/state-root.cjs');
const { roadmapItems, roadmapSeedRefusal, briefFile } = require('./derivations.cjs');
const { waitingTwin, isNote } = require('./roadmap.cjs');
const { PRODUCT_SESSIONS, PRODUCT_PICTURE } = require('./layout.cjs');
const { commitStateTail, noteCommitOutcome } = require('./commit.cjs');
const { productSession, inTheProduct } = require('./discovery-session.cjs');
const { SHAPED_BY, conversationFile, payloadFile } = require('./discovery-entry.cjs');
const { peerHold, clearOwnQuietly } = require('./presence.cjs');
const { keepCameFrom } = require('./position.cjs');
const { draftIn, writeBrief, twinRefusal } = require('./discovery-map.cjs');
const {
  FIRST_LOG, assertLegalWorkUnitName, workUnitTaken, checkWorkUnit, writeWorkUnit, unwriteWorkUnit, registerWorkUnit, createdPaths, landedSeeds,
} = require('./workunit-create.cjs');
const { filled, shaped, listed, readPayload, stage, stagedAt, refusing } = require('./staged-payload.cjs');
const { startThisWorkScreen } = require('./projections/discovery-gates.cjs');
const { phaseSkill } = require('./handoff.cjs');
const { pointsFromBefore, sharedFiles, fromBeforeText, fromBeforeFile } = require('./from-before.cjs');

// The move's yes, loaded at its call: the move stages through this module.
const move = () => require('./workunit-move.cjs');

/** @typedef {import('./projections/surfaces.cjs').Next} Next */

/**
 * Claude's payload as staged: the work's type, name, description and reason;
 * its inbox seeds and roadmap items; the places in the product's sessions
 * that shaped it, state-relative; a one-topic unit's brief draft; an epic's
 * points from before and shared files; and the thinned picture's draft.
 * @typedef {{type: string, name: string, description: string, reason: string, seeds: string[], roadmap: string[], shaped_by: string[], brief?: string, from_before?: import('./from-before.cjs').PointFromBefore[], shared_files?: import('./from-before.cjs').SharedFile[], picture?: string}} Staged
 */

/** The types start this work creates. */
const STARTS = ['feature', 'epic', 'bugfix', 'quick-fix'];

/** The types whose one topic lands at start this work, with its brief (8.7.7). */
const ONE_TOPIC = ['feature', 'bugfix'];

/** Why a type takes no brief at start this work. @type {Readonly<Record<string, string>>} */
const UNBRIEFED = Object.freeze({ epic: 'an epic\'s topics get their briefs as the map is approved', 'quick-fix': 'a quick-fix has no topic to brief' });

/** The phase each type but an epic opens in after its yes. @type {Readonly<Record<string, string>>} */
const OPENS_IN = Object.freeze({ feature: 'discussion', bugfix: 'investigation', 'quick-fix': 'implementation' });

/** A place in the product's sessions: a log, and a section of it where an anchor names one. */
const SHAPING = new RegExp(`^${PRODUCT_SESSIONS.replace(/\./g, '\\.')}/session-\\d+\\.md(#[^\\s()]+)?$`);

/** A taken name with a number appended: its base. */
const NUMBERED = /^(.+)-\d+$/;

const NOTHING_STAGED = 'nothing is staged — render start-this-work --file <payload.json> stages the work';

/** Where the calling conversation's payload is staged, in the product's cache. @param {string} cwd */
const stagedFile = (cwd) => conversationFile(cwd, 'start-this-work');

/** Refuses a type start this work does not create. @param {unknown} type @returns {string} */
function startType(type) {
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
 * The places in the product's sessions that shaped the work, each a log
 * there, a section of it named by an anchor, on disk: at least one where
 * the conversation's place is the product's conversation.
 * @param {string} cwd @param {unknown} given @returns {string[]}
 */
function shapingPlaces(cwd, given) {
  const places = listed(given, 'shaped_by');
  if (places.length === 0 && inTheProduct()) throw new Error(`shaped_by names at least one place in ${PRODUCT_SESSIONS}/ — the talk in the product's conversation that shaped the work`);
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
  const refusal = roadmapSeedRefusal(project, names);
  if (refusal !== null) throw new Error(`roadmap: ${refusal}`);
  return /** @type {string[]} */ (names);
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
 * An epic's points from before and shared files; refused for any other
 * type, whose brief carries them or whose picture keeps them.
 * @param {string} cwd @param {string} type @param {Record<string, unknown>} fields
 * @returns {import('./from-before.cjs').FromBefore}
 */
function epicCarries(cwd, type, fields) {
  const held = {
    points: fields.from_before === undefined ? [] : pointsFromBefore(fields.from_before),
    files: fields.shared_files === undefined ? [] : sharedFiles(cwd, fields.shared_files),
  };
  for (const [field, given] of [['from_before', held.points], ['shared_files', held.files]]) {
    if (given.length > 0 && type !== 'epic') throw new Error(`${field} is an epic's — a ${type}'s ${ONE_TOPIC.includes(type) ? 'brief carries them' : 'stay in the picture'}: drop ${field}`);
  }
  return held;
}

/**
 * The picture thinned as the work leaves the product's conversation, a
 * draft in the cache; refused from a type call, which only reads it, and
 * where the picture was written after the draft, which would land over
 * what the picture gained since — at the stage and again at the yes.
 * @param {string} cwd @param {unknown} picture @returns {string|undefined}
 */
function thinnedPicture(cwd, picture) {
  if (picture === undefined) return undefined;
  if (!inTheProduct()) throw new Error('a type call only reads the picture — drop picture: the next return to the product\'s conversation brings it up to date');
  if (!filled(picture)) throw new Error('picture names the thinned picture\'s draft');
  const { scratch } = draftIn(cwd, picture, 'the picture');
  const live = statePath(cwd, PRODUCT_PICTURE);
  if (fs.existsSync(live) && fs.statSync(live).mtimeMs > fs.statSync(scratch).mtimeMs) {
    throw new Error('the picture was rewritten after its thinned draft — draft the thinning again from the picture as it stands, then stage again');
  }
  return /** @type {string} */ (picture);
}

/**
 * Claude's payload checked against the project as it stands, as it is
 * staged, with its seeds as inbox items: refused where any part of it could
 * not be created.
 * @param {string} cwd @param {unknown} given
 * @returns {{staged: Staged, seedItems: import('./inbox.cjs').InboxItem[]}}
 */
function checked(cwd, given) {
  const fields = shaped(given, 'the payload', ['type', 'name', 'description', 'reason'], ['shaped_by', 'seeds', 'roadmap', 'brief', 'from_before', 'shared_files', 'picture']);
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
    shaped_by: shapingPlaces(cwd, fields.shaped_by ?? []),
  };
  const brief = briefDraft(cwd, type, fields.brief);
  const { points, files } = epicCarries(cwd, type, fields);
  const picture = thinnedPicture(cwd, fields.picture);
  return {
    staged: {
      ...staged,
      ...(brief === undefined ? {} : { brief }),
      ...(points.length === 0 ? {} : { from_before: points }),
      ...(files.length === 0 ? {} : { shared_files: files }),
      ...(picture === undefined ? {} : { picture }),
    },
    seedItems,
  };
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
 * The notes of the roadmap items the unit starts from, each on disk, for its
 * seeds (4.11.16).
 * @param {string} cwd @param {string[]} roadmap
 * @returns {import('./workunit-create.cjs').NoteSeed[]}
 */
function noteSeedsOf(cwd, roadmap) {
  const items = roadmapItems(readProjectManifest(cwd));
  return roadmap.flatMap((name) => {
    const item = items[name];
    const note = (Array.isArray(item.sources) ? item.sources : []).find(isNote);
    return note !== undefined && fs.existsSync(statePath(cwd, note)) ? [{ name, note }] : [];
  });
}

/**
 * What comes after the yes: an epic's own discovery, moved to from the
 * product's conversation where `moving`; a quick-fix's skill, invoked in
 * this conversation (19.5.1); any other type's first phase, by a handoff.
 * @param {string} type @param {string} unit @param {boolean} [moving] @returns {Next}
 */
function nextAfter(type, unit, moving = false) {
  if (type === 'epic') return { kind: 'engine', argv: ['enter', 'discovery', unit, ...(moving ? ['--move'] : [])] };
  const skill = phaseSkill(OPENS_IN[type], type);
  return { kind: type === 'quick-fix' ? 'invoke' : 'handoff', skill, args: [type, unit] };
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
      ? /** @type {Staged|import('./workunit-move.cjs').StagedMove} */ (stagedAt(stagedFile(cwd), NOTHING_STAGED))
      : stage(stagedFile(cwd), checked(cwd, readPayload(cwd, file)).staged);
    return startThisWorkScreen(staged);
  });
}

/**
 * The project manifest's half of the yes, in one write: the unit
 * registered, each roadmap item it starts from joined to it, and the
 * product's open session closed where `closing`. Answers the session
 * closed, or null.
 * @param {string} cwd @param {Staged} staged @param {boolean} closing
 * @returns {string|null}
 */
function writeProject(cwd, { type, name, roadmap }, closing) {
  return withProjectLock(cwd, () => {
    const project = readProjectManifest(cwd);
    registerWorkUnit(project, name, type);
    for (const item of roadmap) roadmapItems(project)[item].pulled_to = { work_unit: name };
    const closed = closing ? productSession(project) : null;
    if (closed !== null) delete project.product_session;
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
  const given = stagedAt(stagedFile(cwd), NOTHING_STAGED);
  if (move().isMove(given)) return move().moveYes(cwd, given);
  const { staged, seedItems } = checked(cwd, given);
  const { type, name } = staged;
  const inProduct = inTheProduct();
  const closing = type !== 'quick-fix' && inProduct && peerHold(cwd, PRODUCT, 'discovery', PRODUCT) === null;
  const draft = staged.brief === undefined ? null : draftIn(cwd, staged.brief, 'the brief');
  const picture = staged.picture === undefined ? null : draftIn(cwd, staged.picture, 'the picture');
  const carried = { points: staged.from_before ?? [], files: staged.shared_files ?? [] };
  const landed = writeWorkUnit(cwd, name, type, {
    description: staged.description, firstLog: firstLogOf(name, staged.shaped_by), seedItems, noteSeeds: noteSeedsOf(cwd, staged.roadmap),
  });
  /** @type {string|null} */
  let closed;
  try {
    if (draft !== null) writeBrief(cwd, name, name, draft.content);
    if (carried.points.length + carried.files.length > 0) fs.writeFileSync(fromBeforeFile(cwd, name), fromBeforeText(carried));
    closed = writeProject(cwd, staged, closing);
  } catch (err) {
    unwriteWorkUnit(cwd, name, landed.seeds);
    throw err;
  }
  if (draft !== null) fs.rmSync(draft.scratch, { force: true });
  if (picture !== null) {
    fs.writeFileSync(statePath(cwd, PRODUCT_PICTURE), picture.content);
    fs.rmSync(picture.scratch, { force: true });
  }
  fs.rmSync(stagedFile(cwd), { force: true });
  fs.rmSync(payloadFile(cwd), { force: true });
  // Work that leaves the product's talk takes the conversation's row there, its place kept for an epic's move.
  if (type !== 'quick-fix') clearOwnQuietly(cwd, PRODUCT, 'discovery', PRODUCT);
  else keepCameFrom(name);

  /** @type {string[]} */
  const warnings = [];
  const paths = [...createdPaths(name, landed), ...(closed === null ? [] : [PRODUCT_SESSIONS]), ...(picture === null ? [] : [PRODUCT_PICTURE])];
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
    next: nextAfter(type, name, inProduct),
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

module.exports = { runStartThisWorkVerb, startThisWorkSurface, stagedFile, nextAfter, OPENS_IN };
