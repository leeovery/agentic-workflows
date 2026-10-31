'use strict';

// ---------------------------------------------------------------------------
// Domain ring: approve the map (8.8.3, 8.8.4) — the authority gate at the end
// of an epic's shaping, its screen `render approve-map <unit>` and its yes
// `approve-map yes <unit>`. Its screen is drawn by
// projections/discovery-gates.cjs.
//
// - Claude's payload is staged in the epic's discovery cache with `--file`,
//   and nothing reaches the map or the roadmap before the person's yes. It
//   holds every live topic of the map in its order, foundations first (8.6.2)
//   — a topic already on the map by its name alone, a new one with its
//   summary and brief, and the waiting roadmap item it takes in where it
//   takes one (8.1.6); the parks, each with the horizon the person gave it;
//   and the binds, each roadmap item the epic was started from to the topic
//   it became. The screen draws from the staged payload again without
//   `--file`.
// - Refused as it is staged: a park with no horizon, which Claude asks the
//   person for first, Claude naming none (8.8.4, 8.S49); a name struck from
//   the map, which comes back only at the person's ask (8.10.11); a new topic
//   beside a waiting roadmap item of its name that it does not take in
//   (8.S52); and a live topic left out, since renames and removals happen at
//   the person's word alone (8.8.21).
// - On a re-shape, the screen marks each topic that is new and each that
//   moved among the topics the map held (8.8.21, 8.S48).
// - The yes checks the staged payload against the map and the roadmap as
//   they stand, then, as one transaction under the writer lock, writes each
//   new topic's brief, the roadmap — the items taken in and bound joined to
//   their topics, the parks on their horizons, each with its origin and the
//   logs that shaped it — and the epic's manifest: the new topics, every
//   topic's order (8.S10), and the epic's open discovery session closed
//   (8.14.11). A failure part-way leaves no change. One commit takes it all.
// - What comes next is the epic's menu, the first topic in the map's order
//   marked next there (8.8.13).
// ---------------------------------------------------------------------------

const fs = require('fs');
const { loadWorkUnitManifest, saveWorkUnitManifest, readProjectManifest, writeProjectManifestAtomic, withProjectLock } = require('../kernel/manifest.cjs');
const { assertLegalName } = require('../kernel/manifest-schema.cjs');
const { statePath } = require('../kernel/state-root.cjs');
const { unitInProgress, discoveryStanding } = require('./topic-standing.cjs');
const { computeTopicLifecycle, CLOSED_LIFECYCLES, dismissedNames, topicKeyOf, topicTitle, roadmapItems, itemJoin, itemPostponedFrom, briefFile } = require('./derivations.cjs');
const { topicNameRefusal, draftIn, writeBrief, addBatchTo, discoveryItems } = require('./discovery-map.cjs');
const {
  DEFAULT_KIND, becomesTopic, validateKind, takeInRefusal, waitingTwin, ensureRoadmap, ensureHorizon, validateSummary, validateSources, requireSourcesOnDisk,
} = require('./roadmap.cjs');
const { commitStateTail, noteCommitOutcome, discoveryScope, PROJECT_MANIFEST_SPEC } = require('./commit.cjs');
const { filled, shaped, listed, readPayload, stage, stagedAt, refusing } = require('./staged-payload.cjs');
const { approveMapScreen } = require('./projections/discovery-gates.cjs');

/**
 * A topic as staged: one on the map by its key alone; a new one with its
 * summary, its brief's draft, and optionally its description and the
 * roadmap item it takes in.
 * @typedef {{name: string, summary?: string, description?: string, brief?: string, from_roadmap?: string}} StagedTopic
 */

/** A park as staged: a roadmap item, its horizon the person's. @typedef {{name: string, summary: string, horizon: string, kind: string, sources: string[]}} Park */

/** A roadmap item the epic was started from, bound to the topic it became. @typedef {{item: string, topic: string}} Bind */

/** Claude's payload as staged. @typedef {{topics: StagedTopic[], parks: Park[], binds: Bind[]}} Staged */

const PHASE = 'discovery';

/** Where the payload is staged, in the epic's discovery cache. @param {string} cwd @param {string} unit */
function stagedFile(cwd, unit) {
  return statePath(cwd, '.cache', unit, PHASE, unit, 'approve-map.json');
}

/** The refusal where nothing is staged for the epic. @param {string} unit */
const nothingStaged = (unit) => `nothing is staged for ${unit} — render approve-map ${unit} --file <payload.json> stages the map`;

/**
 * The epic's manifest, its map open: refused for a unit not in progress, one
 * that is no epic, and an epic past its spec.
 * @param {string} cwd @param {string} unit @returns {Record<string, any>}
 */
function openMap(cwd, unit) {
  const manifest = unitInProgress(cwd, unit);
  const shut = discoveryStanding({ cwd, phase: PHASE, unit, manifest });
  if (shut !== null) throw new Error(shut);
  return manifest;
}

/** Whether a topic on the map is live: neither cancelled nor postponed. @param {Record<string, any>} manifest @param {string} key */
function isLive(manifest, key) {
  return !CLOSED_LIFECYCLES.includes(computeTopicLifecycle(manifest, key).lifecycle);
}

/**
 * The map's live topics in the order they stand, a topic never ordered after
 * every ordered one.
 * @param {Record<string, any>} manifest @returns {string[]}
 */
function liveInOrder(manifest) {
  const items = manifest.phases?.discovery?.items ?? {};
  const rank = (/** @type {string} */ key) => (Number.isInteger(items[key].order) ? items[key].order : Infinity);
  return Object.keys(items).filter((key) => isLive(manifest, key)).sort((a, b) => rank(a) - rank(b));
}

/**
 * A topic as the payload gives it, staged: one on the map, live, named alone;
 * a new one with its summary and brief, its name a topic's and never one
 * struck from the map.
 * @param {string} cwd @param {Record<string, any>} manifest @param {unknown} given @param {number} at
 * @returns {StagedTopic}
 */
function stagedTopic(cwd, manifest, given, at) {
  const what = `topic ${at + 1}`;
  const fields = shaped(given, what, ['name'], ['summary', 'description', 'brief', 'from_roadmap']);
  const said = fields.name;
  const key = typeof said === 'string' ? topicKeyOf(manifest, said) : null;
  if (key !== null) {
    if (!isLive(manifest, key)) throw new Error(`${what}: "${said}" is ${computeTopicLifecycle(manifest, key).lifecycle} — it stands in no order`);
    if (Object.keys(fields).length > 1) throw new Error(`${what}: "${said}" is on the map already, so it is named alone — its summary and brief change at the person's word: topic edit, topic brief`);
    return { name: key };
  }
  const { name, summary, description, brief, from_roadmap: fromRoadmap } = shaped(given, `${what}, new to the map,`, ['name', 'summary', 'brief'], ['description', 'from_roadmap']);
  const misnamed = topicNameRefusal(name);
  if (misnamed !== null) throw new Error(`${what}: ${misnamed}`);
  if (dismissedNames(manifest).includes(/** @type {string} */ (name))) throw new Error(`${what}: "${name}" was struck from the map — it comes back only at the person's ask, through topic add --re-add`);
  for (const [field, value] of Object.entries({ summary, brief, description, from_roadmap: fromRoadmap })) {
    if (value !== undefined && !filled(value)) throw new Error(`${what}'s ${field} is a non-empty string`);
  }
  draftIn(cwd, /** @type {string} */ (brief), `${what}'s brief`);
  return {
    name: /** @type {string} */ (name),
    summary: /** @type {string} */ (summary),
    brief: /** @type {string} */ (brief),
    ...(description === undefined ? {} : { description: /** @type {string} */ (description) }),
    ...(fromRoadmap === undefined ? {} : { from_roadmap: /** @type {string} */ (fromRoadmap) }),
  };
}

/** Refused where any of `values` stands twice, naming `what` it is. @param {unknown[]} values @param {string} what */
function once(values, what) {
  const twice = values.find((v, i) => v !== undefined && values.indexOf(v) !== i);
  if (twice !== undefined) throw new Error(`${what} "${twice}" stands twice`);
}

/**
 * The topics as staged, checked against the map and the roadmap: every live
 * topic of the map among them, none twice, each new one free of a waiting
 * roadmap item of its name unless it takes that item in (8.1.6).
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest @param {Record<string, any>} project @param {unknown} given
 * @returns {StagedTopic[]}
 */
function stagedTopics(cwd, unit, manifest, project, given) {
  const topics = listed(given, 'topics').map((topic, at) => stagedTopic(cwd, manifest, topic, at));
  if (topics.length === 0) throw new Error('topics names the map\'s topics in their order — at least one');
  once(topics.map(({ name }) => name), 'the topic');
  once(topics.map((topic) => topic.from_roadmap), 'the roadmap item taken in');
  const left = liveInOrder(manifest).find((key) => !topics.some(({ name }) => name === key));
  if (left !== undefined) throw new Error(`the map's "${left}" is left out — every live topic stands in the order, and a topic leaves the map at the person's word alone: topic remove`);
  for (const { name, from_roadmap: fromRoadmap } of topics.filter(({ brief }) => brief !== undefined)) {
    const refusal = fromRoadmap === undefined ? null : takeInRefusal(project, unit, fromRoadmap);
    if (refusal !== null) throw new Error(`"${name}" can't take the item in — ${refusal}`);
    const twin = waitingTwin(project, name);
    if (twin !== null && twin !== fromRoadmap) throw new Error(`"${name}" would stand beside the waiting roadmap item of its name — the topic takes it in with from_roadmap, or is named apart`);
  }
  return topics;
}

/**
 * A park as the payload gives it, staged: a new roadmap item on the horizon
 * the person gave it — none refused, the person asked first — with the logs
 * that shaped it.
 * @param {string} cwd @param {Record<string, any>} project @param {unknown} given @param {number} at
 * @returns {Park}
 */
function stagedPark(cwd, project, given, at) {
  const { name, summary, horizon, kind = DEFAULT_KIND, sources } = shaped(given, `park ${at + 1}`, ['name', 'summary', 'sources'], ['horizon', 'kind']);
  const what = `park "${name}"`;
  try {
    assertLegalName('item', name);
    if (!filled(horizon)) throw new Error(`it has no horizon — the horizon is the person's: ask with render horizon-pick --park ${name}, before the screen`);
    assertLegalName('horizon', horizon);
    validateSummary(summary);
    validateKind(kind);
    validateSources(sources);
    if (/** @type {string[]} */ (sources).length === 0) throw new Error('sources names the logs that shaped it — at least one');
    requireSourcesOnDisk(cwd, /** @type {string[]} */ (sources));
    if (roadmapItems(project)[/** @type {string} */ (name)] !== undefined) throw new Error('the roadmap has an item of its name already');
  } catch (err) {
    throw new Error(`${what}: ${err instanceof Error ? err.message : String(err)}`);
  }
  return { name: /** @type {string} */ (name), summary: /** @type {string} */ (summary), horizon: /** @type {string} */ (horizon), kind: /** @type {string} */ (kind), sources: /** @type {string[]} */ (sources) };
}

/**
 * A bind as the payload gives it, staged: a roadmap item the epic was started
 * from, which becomes a topic, bound to a topic staged.
 * @param {string} unit @param {Record<string, any>} project @param {StagedTopic[]} topics @param {unknown} given @param {number} at
 * @returns {Bind}
 */
function stagedBind(unit, project, topics, given, at) {
  const { item, topic } = shaped(given, `bind ${at + 1}`, ['item', 'topic']);
  const found = typeof item === 'string' ? roadmapItems(project)[item] : undefined;
  const join = found === undefined ? null : itemJoin(found);
  if (found === undefined || join?.work_unit !== unit || join.topic !== undefined) throw new Error(`bind ${at + 1}: ${JSON.stringify(item)} is no roadmap item ${unit} was started from and not yet bound`);
  if (!becomesTopic(found)) throw new Error(`bind ${at + 1}: "${item}" is a ${found.kind} — it rides with the work as material, never a topic`);
  if (!topics.some(({ name }) => name === topic)) throw new Error(`bind ${at + 1}: "${topic}" is no topic of the map staged`);
  return { item: /** @type {string} */ (item), topic: /** @type {string} */ (topic) };
}

/**
 * Claude's payload checked against the map and the roadmap as they stand, as
 * it is staged: refused where any part of it could not land.
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest @param {unknown} given
 * @returns {Staged}
 */
function checked(cwd, unit, manifest, given) {
  const fields = shaped(given, 'the payload', ['topics'], ['parks', 'binds']);
  const project = readProjectManifest(cwd);
  const topics = stagedTopics(cwd, unit, manifest, project, fields.topics);
  const parks = listed(fields.parks ?? [], 'parks').map((park, at) => stagedPark(cwd, project, park, at));
  once(parks.map(({ name }) => name), 'the park');
  const parkedTopic = parks.find(({ name }) => topics.some((topic) => topic.name === name));
  if (parkedTopic !== undefined) throw new Error(`"${parkedTopic.name}" is a topic and a park at once`);
  const binds = listed(fields.binds ?? [], 'binds').map((bind, at) => stagedBind(unit, project, topics, bind, at));
  once(binds.map(({ item }) => item), 'the bound item');
  return { topics, parks, binds };
}

/**
 * The map as the screen draws it: each topic by its title, marked on a
 * re-shape where it is new or moved among the topics the map held; and each
 * park.
 * @param {string} unit @param {Record<string, any>} manifest @param {Staged} staged
 * @returns {import('./projections/discovery-gates.cjs').MapView}
 */
function mapView(unit, manifest, { topics, parks }) {
  const held = liveInOrder(manifest);
  const kept = topics.map(({ name }) => name).filter((name) => held.includes(name));
  /** @param {string} name @returns {'new'|'moved'|null} */
  const markOf = (name) => {
    if (held.length === 0) return null;
    if (!held.includes(name)) return 'new';
    return held.indexOf(name) === kept.indexOf(name) ? null : 'moved';
  };
  return {
    unit,
    topics: topics.map(({ name }) => ({ title: topicTitle(manifest, name), mark: markOf(name) })),
    parks: parks.map(({ summary, horizon }) => ({ summary, horizon })),
  };
}

/**
 * `render approve-map <unit> [--file <payload.json>]`: the screen, Claude's
 * payload staged from `--file` or read back as staged.
 * @param {string} cwd @param {{dotpath?: string, file?: string}} args
 * @returns {string}
 */
function approveMapSurface(cwd, { dotpath: unit = '', file }) {
  return refusing('render approve-map', () => {
    const manifest = openMap(cwd, unit);
    const staged = file === undefined
      ? /** @type {Staged} */ (stagedAt(stagedFile(cwd, unit), nothingStaged(unit)))
      : stage(stagedFile(cwd, unit), checked(cwd, unit, manifest, readPayload(cwd, file)));
    return approveMapScreen(mapView(unit, manifest, staged));
  });
}

/**
 * The roadmap's half of the yes, on the project manifest given: each item
 * taken in or bound joined to its topic, and each park on its horizon.
 * Answers, by topic, the earlier epic's record an item postponed from
 * another epic carries.
 * @param {Record<string, any>} project @param {string} unit @param {Staged} staged
 * @returns {Record<string, {work_unit: string, topic: string}>}
 */
function landOnRoadmap(project, unit, { topics, parks, binds }) {
  /** @type {Record<string, {work_unit: string, topic: string}>} */
  const priors = {};
  const joins = [...topics.flatMap(({ name, from_roadmap: item }) => (item === undefined ? [] : [{ item, topic: name }])), ...binds];
  for (const { item, topic } of joins) {
    const found = roadmapItems(project)[item];
    const from = itemPostponedFrom(found);
    if (from && from.work_unit !== unit) priors[topic] = { work_unit: from.work_unit, topic: from.topic };
    found.pulled_to = { work_unit: unit, topic };
  }
  const roadmap = ensureRoadmap(project);
  for (const { name, summary, horizon, kind, sources } of parks) {
    ensureHorizon(roadmap, horizon);
    roadmap.items[name] = { horizon, summary, kind, origin: `park:${unit}`, sources };
  }
  return priors;
}

/**
 * The epic's half of the yes, on the manifest given: the new topics, the
 * earlier record each carries, every topic's order, and the open discovery
 * session closed. Answers the session closed, or null.
 * @param {Record<string, any>} manifest @param {Staged} staged @param {Record<string, {work_unit: string, topic: string}>} priors
 * @returns {string|null}
 */
function landOnMap(manifest, { topics }, priors) {
  const added = topics.filter(({ brief }) => brief !== undefined);
  if (added.length > 0) addBatchTo(manifest, added.map(({ name, summary, description, from_roadmap: fromRoadmap }) => ({ name, summary: /** @type {string} */ (summary), description, from_roadmap: fromRoadmap })), 'approve-map yes');
  const items = discoveryItems(manifest);
  for (const [topic, prior] of Object.entries(priors)) items[topic].prior = prior;
  topics.forEach(({ name }, at) => { items[name].order = at + 1; });
  const closed = typeof manifest.phases.discovery.active_session === 'string' ? manifest.phases.discovery.active_session : null;
  delete manifest.phases.discovery.active_session;
  return closed;
}

/**
 * Write the yes: each new topic's brief, the project manifest, then the
 * epic's — every one put back as it was where a later one fails.
 * @param {string} cwd @param {string} unit @param {Staged} staged @param {Map<string, string>} briefs topic → its brief's content
 * @returns {string|null} the discovery session closed
 */
function writeYes(cwd, unit, staged, briefs) {
  return withProjectLock(cwd, () => {
    const unitBefore = loadWorkUnitManifest(cwd, unit);
    const projectBefore = readProjectManifest(cwd);
    const manifest = structuredClone(unitBefore);
    const project = structuredClone(projectBefore);
    const closed = landOnMap(manifest, staged, landOnRoadmap(project, unit, staged));
    /** @type {string[]} */
    const written = [];
    let projectWritten = false;
    try {
      for (const [topic, content] of briefs) written.push(writeBrief(cwd, unit, topic, content));
      writeProjectManifestAtomic(cwd, project);
      projectWritten = true;
      saveWorkUnitManifest(cwd, unit, manifest);
    } catch (err) {
      for (const brief of written) fs.rmSync(statePath(cwd, brief), { force: true });
      if (projectWritten) writeProjectManifestAtomic(cwd, projectBefore);
      throw err;
    }
    return closed;
  });
}

/**
 * `approve-map yes <unit>`: the person's yes, landing the staged map as one
 * transaction.
 * @param {string} cwd @param {string} unit
 */
function approveMapYes(cwd, unit) {
  const staged = checked(cwd, unit, openMap(cwd, unit), stagedAt(stagedFile(cwd, unit), nothingStaged(unit)));
  const drafts = staged.topics.flatMap(({ name, brief }) => (brief === undefined ? [] : [{ name, ...draftIn(cwd, brief, `"${name}"'s brief`) }]));
  const closed = writeYes(cwd, unit, staged, new Map(drafts.map(({ name, content }) => [name, content])));
  for (const { scratch } of drafts) fs.rmSync(scratch, { force: true });
  fs.rmSync(stagedFile(cwd, unit), { force: true });

  /** @type {string[]} */
  const warnings = [];
  const outcome = commitStateTail(cwd, [...discoveryScope(cwd, unit), PROJECT_MANIFEST_SPEC], `discovery(${unit}): approve the map`, warnings);
  /** @type {Record<string, unknown>} */
  const result = {
    unit,
    topics: staged.topics.map(({ name }) => name),
    added: drafts.map(({ name }) => ({ name, brief: statePath(cwd, briefFile(unit, name)) })),
    parked: staged.parks.map(({ name, horizon }) => ({ name, horizon })),
    bound: staged.binds,
    session_closed: closed,
    committed: outcome.committed,
    next: { kind: 'handoff', skill: 'leeway-continue-epic', args: [unit] },
  };
  if (warnings.length > 0) result.warnings = warnings;
  noteCommitOutcome(result, outcome);
  return result;
}

/**
 * `approve-map yes <unit>`: the verb's answer, its refusal opening on its
 * command.
 * @param {string} cwd @param {string[]} argv
 * @returns {Record<string, unknown>}
 */
function runApproveMapVerb(cwd, argv) {
  if (argv.length !== 2 || argv[0] !== 'yes') throw new Error('Usage: engine approve-map yes <work-unit>');
  return refusing('approve-map yes', () => approveMapYes(cwd, argv[1]));
}

module.exports = { runApproveMapVerb, approveMapSurface };
