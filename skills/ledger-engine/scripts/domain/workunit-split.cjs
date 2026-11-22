'use strict';

// ---------------------------------------------------------------------------
// Domain ring: topics leaving a building unit for a new epic — `workunit
// split <unit> --topics a,b,… --into <epic> --description <text>
// --session-log-file <path>`, the cut and the merges' (21.8.9, 21.8.10).
// The other way out, to the roadmap, is `topic postpone`, run before the cut
// begins the unit's build, which postpone refuses.
//
// - When: only while the migration runs (state-worktree.cjs's
//   `migrationRuns`), so its commit is held for the migration's.
// - The epic: made as `workunit create` makes one — its description, and
//   its first discovery log, Claude's, installed verbatim — and registered;
//   its map approved at the split, so its topics start in discussion and no
//   discovery session is open.
// - Each topic moves to it whole, keeping its name: its folder — its log,
//   brief, mail and experiments' records — and every item it holds before
//   the spec, each copied as it stood, its map row numbered among the
//   topics in the order they stood. Its ledger lines are carried to the
//   epic's topic by one `rehomed` line (ledger-rehomed.cjs), so every read
//   and the record copies take them there, each at its own phase, each file
//   they name where the move took it. Every document's links follow the
//   moves (follow-moves.cjs): each of a moved document's links to a file
//   the move left behind — the unit's assets, seeds and spikes — rebased to
//   resolve from where it now sits (21.5.7), and each link of any document
//   into a moved folder following it. Its places in the unit's cache are
//   purged. A roadmap item joined to the topic follows it, and a source
//   under its folder follows its file.
// - The unit keeps the rest: the topics its specs cover, for its cut.
// - Once: each step is one a redo repeats or finds done — the epic made,
//   each folder's move, each topic's carry, of the lines the ledger still
//   reads on it in the unit, the unit's items, the registry and the
//   roadmap — so a session killed part-way finishes on its next run, the
//   epic found holding every topic named on its map once it is made. It
//   renders no copies and tells the knowledge base nothing: no store exists
//   while the migration runs, and its finish renders and indexes the whole
//   set (21.9.1).
// - It refuses, writing nothing: outside the migration; a unit that is no
//   epic; no topic named, or one named twice; a topic not on the unit's map,
//   or set aside on it, cancelled or postponed; a topic the epic a split
//   cut short made lacks on its map; a topic's folder in both units; an
//   epic's name that is no unit's, the unit's own, or one another unit
//   holds; an empty description, or a session log that cannot be read;
//   and lines to carry with no session to tag the carry with.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const {
  loadWorkUnitManifest, saveWorkUnitManifest, withWorkUnitLock, readProjectManifest, writeProjectManifestAtomic, withProjectLock, ensureContainer, copyWhole,
} = require('../kernel/manifest.cjs');
const { isObject, writeTextAtomic } = require('../kernel/manifest-io.cjs');
const { TOPIC_PHASES, workUnitNameRefusal } = require('../kernel/manifest-schema.cjs');
const { stateRoot, statePath } = require('../kernel/state-root.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { withStateLock, assertMigrationRuns } = require('./state-worktree.cjs');
const { appendEntries, commitLedger, carrying } = require('./ledger.cjs');
const { newId } = require('./ledger-ids.cjs');
const { manifestOf } = require('./ledger-units.cjs');
const { linesOf, movedFiles } = require('./workunit-absorb.cjs');
const { FIRST_LOG } = require('./workunit-create.cjs');
const { CLOSED_LIFECYCLES, computeTopicLifecycle, itemJoin, roadmapItems, topicDir } = require('./derivations.cjs');
const { carrySources } = require('./roadmap.cjs');
const { relinkDocuments } = require('./follow-moves.cjs');
const { purgeTopicCache } = require('./cache.cjs');
const { todayStamp } = require('./dates.cjs');
const { commitStateTail, noteCommitOutcome, PROJECT_MANIFEST_SPEC } = require('./commit.cjs');

const SAID = 'workunit split';

/**
 * @typedef {object} WorkUnitSplitResult
 * @property {string} work_unit  the unit the topics left
 * @property {string} epic  the epic they went to
 * @property {string[]} topics
 * @property {string} session_log  the epic's first discovery log (absolute)
 * @property {number} carried  how many ledger lines this run carried to the epic's topics
 * @property {string[]} [roadmap_reaimed]  roadmap items whose joins now name the epic's topic
 * @property {{item: string, from: string, to: string}[]} [roadmap_sources_rewritten]  roadmap sources that followed a moved file
 * @property {string|null} committed  short commit sha, or null — held while the migration runs
 * @property {string} [note]
 * @property {string[]} warnings
 */

/** A phase's items on a manifest, or {}. @param {Record<string, any>|null} manifest @param {string} phase @returns {Record<string, any>} */
const itemsIn = (manifest, phase) => (isObject(manifest?.phases?.[phase]?.items) ? manifest.phases[phase].items : {});

/** Whether a manifest's map holds the topic. @param {Record<string, any>|null} manifest @param {string} topic */
const onMap = (manifest, topic) => isObject(itemsIn(manifest, 'discovery')[topic]);

/**
 * The split as asked, checked before anything is written (the header's
 * refusals): the unit's manifest, the epic's where a split cut short made
 * it, the log, each topic's lines to carry and its folder's move.
 * @typedef {{
 *   unit: string, into: string, topics: string[], description: string, log: string,
 *   manifest: Record<string, any>, made: boolean,
 *   lines: {topic: string, ids: string[], files: Set<string>}[],
 *   moves: [string, string][],
 * }} Split
 */

/** The topics named, refused where none is or one is named twice. @param {string[]} topics */
function namedTopics(topics) {
  if (topics.length === 0 || topics.some((topic) => topic === '')) throw new Error(`${SAID}: --topics names the topics leaving, comma-separated`);
  const twice = topics.find((topic, at) => topics.indexOf(topic) !== at);
  if (twice !== undefined) throw new Error(`${SAID}: --topics names ${twice} twice`);
  return topics;
}

/** The session log's text, refused where it cannot be read. @param {string} cwd @param {string} file */
function logText(cwd, file) {
  try {
    return fs.readFileSync(path.resolve(cwd, file), 'utf8');
  } catch {
    throw new Error(`${SAID}: session log file not found: ${file}`);
  }
}

/**
 * The epic a split cut short made, or null for none: refused where the name
 * is another unit's — no epic, or one whose map holds none of the topics.
 * @param {string} root @param {string} into @param {string[]} topics
 * @returns {Record<string, any>|null}
 */
function epicMade(root, into, topics) {
  const epic = manifestOf(root, into);
  if (epic !== null && (epic.work_type !== 'epic' || !topics.some((topic) => onMap(epic, topic)))) {
    throw new Error(`${SAID}: work unit "${into}" already exists — the topics leave for a new epic`);
  }
  return epic;
}

/**
 * Refuse a topic the split cannot take: on a fresh split, one not on the
 * unit's map or set aside there; cut short, one the epic's map lacks; and
 * either way, one whose folder is in both units.
 * @param {string} root @param {Split} split @param {Record<string, any>|null} epic @param {string} topic
 */
function checkTopic(root, { unit, into, manifest }, epic, topic) {
  if (epic === null) {
    if (!onMap(manifest, topic)) throw new Error(`${SAID}: ${unit}'s map has no topic "${topic}"`);
    const { lifecycle } = computeTopicLifecycle(manifest, topic);
    if (CLOSED_LIFECYCLES.includes(lifecycle)) throw new Error(`${SAID}: ${unit}'s ${topic} is ${lifecycle} — a topic set aside stays where it is`);
  } else if (!onMap(epic, topic)) {
    throw new Error(`${SAID}: ${into}, made by a split cut short, has no topic "${topic}" on its map — split again naming the topics it was made with`);
  }
  if ([unit, into].every((at) => fs.existsSync(path.join(root, topicDir(at, topic))))) {
    throw new Error(`${SAID}: ${topic}'s folder is in both ${unit} and ${into}`);
  }
}

/**
 * The split checked (the header's refusals), nothing written.
 * @param {string} cwd @param {string} root @param {string} unit
 * @param {{topics: string[], into: string, description: string, sessionLogFile: string}} asked @param {string[]} warnings
 * @returns {Split}
 */
function plannedSplit(cwd, root, unit, { topics, into, description, sessionLogFile }, warnings) {
  const misnamed = workUnitNameRefusal(unit) ?? workUnitNameRefusal(into);
  if (misnamed !== null) throw new Error(`${SAID}: ${misnamed}`);
  if (into === unit) throw new Error(`${SAID}: ${unit}'s topics leave for another epic — --into names ${unit} itself`);
  if (typeof description !== 'string' || description.trim() === '') throw new Error(`${SAID}: --description is empty — the new epic's one line`);
  const manifest = manifestOf(root, unit);
  if (manifest === null) throw new Error(`${SAID}: there is no work unit "${unit}"`);
  if (manifest.work_type !== 'epic') throw new Error(`${SAID}: ${unit} is a ${manifest.work_type} unit — only an epic's topics leave for a new epic`);
  const named = namedTopics(topics);
  const epic = epicMade(root, into, named);
  /** @type {Split} */
  const split = {
    unit, into, topics: named, description, log: logText(cwd, sessionLogFile), manifest, made: epic !== null, lines: [], moves: named.map((topic) => [topicDir(unit, topic), topicDir(into, topic)]),
  };
  for (const topic of named) checkTopic(root, split, epic, topic);
  return { ...split, lines: linesToCarry(root, split, warnings) };
}

/**
 * Each topic's lines the ledger still reads on it in the unit, refused where
 * there are any and no session to tag their carry with.
 * @param {string} root @param {Split} split @param {string[]} warnings
 */
function linesToCarry(root, { unit, topics }, warnings) {
  const lines = topics.map((topic) => ({ topic, ...linesOf(root, unit, warnings, (event) => event.topic === topic) })).filter(({ ids }) => ids.length > 0);
  if (lines.length > 0 && handedSession() === null) {
    throw new Error(`${SAID}: ${unit}'s topics hold ledger entries, which the split carries to the new epic in this conversation — Claude Code hands every command it runs a session id, and this one has none`);
  }
  return lines;
}

/**
 * The topics' map rows, each copied whole and numbered from one in the order
 * they stood on the unit's map.
 * @param {Record<string, any>} manifest @param {string[]} topics @returns {Record<string, any>}
 */
function mapRows(manifest, topics) {
  const rows = itemsIn(manifest, 'discovery');
  const at = (/** @type {string} */ topic) => (Number.isInteger(rows[topic].order) ? rows[topic].order : Infinity);
  return Object.fromEntries([...topics].sort((a, b) => at(a) - at(b)).map((topic, n) => [topic, { ...copyWhole(rows[topic]), order: n + 1 }]));
}

/**
 * The epic's manifest: the topics' items, each copied whole, its map rows
 * numbered among themselves and approved now.
 * @param {Split} split @returns {Record<string, any>}
 */
function epicManifest({ into, topics, description, manifest }) {
  /** @type {Record<string, any>} */
  const phases = { discovery: { items: mapRows(manifest, topics), approved_at: new Date().toISOString() } };
  for (const phase of TOPIC_PHASES.filter((name) => name !== 'discovery')) {
    const held = topics.filter((topic) => isObject(itemsIn(manifest, phase)[topic]));
    if (held.length > 0) phases[phase] = { items: Object.fromEntries(held.map((topic) => [topic, copyWhole(itemsIn(manifest, phase)[topic])])) };
  }
  return { name: into, work_type: 'epic', status: 'in-progress', created: todayStamp(), description, phases };
}

/** The epic made, its log before its manifest, where no split cut short made it. @param {string} cwd @param {Split} split */
function makeEpic(cwd, split) {
  if (split.made) return;
  const log = statePath(cwd, split.into, FIRST_LOG);
  fs.mkdirSync(path.dirname(log), { recursive: true });
  writeTextAtomic(log, split.log);
  withWorkUnitLock(cwd, split.into, () => saveWorkUnitManifest(cwd, split.into, epicManifest(split)));
}

/** Each topic's folder moved, where it is still in the unit. @param {string} root @param {Split} split */
function moveFolders(root, { into, moves }) {
  for (const [from, to] of moves) {
    if (!fs.existsSync(path.join(root, from))) continue;
    fs.mkdirSync(path.join(root, into, 'topics'), { recursive: true });
    fs.renameSync(path.join(root, from), path.join(root, to));
  }
}

/** Each topic's lines carried to the epic's topic, every carry in one write: how many lines. @param {string} root @param {Split} split @param {string[]} warnings */
function carryLines(root, { into, lines, moves }, warnings) {
  if (lines.length === 0) return 0;
  const session = handedSession();
  appendEntries(root, lines.map(({ topic, ids, files }) => ({
    fields: { event: 'rehomed', unit: into, topic, phase: 'discussion', session, lines: ids, files: movedFiles(files, moves) },
    id: newId(),
  })), warnings);
  return lines.reduce((sum, { ids }) => sum + ids.length, 0);
}

/** The topics' places in the unit's cache purged, and their items gone from it. @param {string} cwd @param {Split} split */
function leaveUnit(cwd, { unit, topics }) {
  for (const topic of topics) purgeTopicCache(cwd, unit, topic);
  withWorkUnitLock(cwd, unit, () => {
    const manifest = loadWorkUnitManifest(cwd, unit);
    const held = topics.filter((topic) => TOPIC_PHASES.some((phase) => Object.hasOwn(itemsIn(manifest, phase), topic)));
    if (held.length === 0) return;
    for (const topic of held) for (const phase of TOPIC_PHASES) delete itemsIn(manifest, phase)[topic];
    saveWorkUnitManifest(cwd, unit, manifest);
  });
}

/**
 * The epic registered, each roadmap item joined to a topic re-aimed at the
 * epic's, and each source under a moved folder following its file, in one
 * write where any changes: the items re-aimed and the sources rewritten.
 * @param {string} cwd @param {Split} split
 */
function followInProject(cwd, { unit, into, topics, moves }) {
  return withProjectLock(cwd, () => {
    const project = readProjectManifest(cwd);
    const units = ensureContainer(project, 'work_units', 'work_units');
    const registering = !Object.hasOwn(units, into);
    if (registering) units[into] = { work_type: 'epic' };
    const items = roadmapItems(project);
    const reaimed = Object.entries(items).filter(([, item]) => isObject(item) && itemJoin(item)?.work_unit === unit && topics.includes(String(itemJoin(item)?.topic)))
      .map(([name, item]) => {
        item.pulled_to = { work_unit: into, topic: item.pulled_to.topic };
        return name;
      });
    const { rewritten } = carrySources(items, moves);
    if (registering || reaimed.length > 0 || rewritten.length > 0) writeProjectManifestAtomic(cwd, project);
    return { reaimed, rewritten };
  });
}

/**
 * `workunit split <unit> --topics … --into <epic>`: the epic made, each
 * topic moved to it whole with its ledger lines carried, the unit left with
 * the rest, the epic registered and the roadmap following, the commit held
 * for the migration's (the header's).
 * @param {string} cwd @param {string} unit
 * @param {{topics: string[], into: string, description: string, sessionLogFile: string}} asked
 * @returns {WorkUnitSplitResult}
 */
function splitWorkUnit(cwd, unit, asked) {
  /** @type {string[]} */
  const warnings = [];
  try {
    const root = stateRoot(cwd);
    assertMigrationRuns(root, SAID, 'topics leave a unit for a new epic');
    return withStateLock(root, () => {
      const split = plannedSplit(cwd, root, unit, asked, warnings);
      makeEpic(cwd, split);
      moveFolders(root, split);
      relinkDocuments(root, split.moves);
      const carried = carryLines(root, split, warnings);
      leaveUnit(cwd, split);
      const { reaimed, rewritten } = followInProject(cwd, split);
      const paths = [unit, split.into, PROJECT_MANIFEST_SPEC];
      const message = `ledger(${unit}): split ${split.topics.join(', ')} into ${split.into}`;
      const outcome = carried > 0 ? commitLedger(cwd, message, warnings, paths) : commitStateTail(cwd, paths, message, warnings);
      /** @type {WorkUnitSplitResult} */
      const result = {
        work_unit: unit, epic: split.into, topics: split.topics, session_log: statePath(cwd, split.into, FIRST_LOG), carried, committed: outcome.committed, warnings,
      };
      if (reaimed.length > 0) result.roadmap_reaimed = reaimed;
      if (rewritten.length > 0) result.roadmap_sources_rewritten = rewritten;
      noteCommitOutcome(result, outcome);
      return result;
    });
  } catch (err) {
    throw carrying(err, warnings);
  }
}

module.exports = { splitWorkUnit };
