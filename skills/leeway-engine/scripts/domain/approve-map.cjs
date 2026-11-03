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
//   (8.S52), or beside a roadmap item the epic was started from that it is
//   not bound to; and a live topic left out, since renames and removals
//   happen at the person's word alone (8.8.21).
// - On a re-shape — the map approved before, its topics holding their order
//   — the screen marks each topic the approved map did not order as new, and
//   each it did that moved as moved, a topic moved the one marked (8.8.21,
//   8.S48). A first map is drawn unmarked, topics the person added while it
//   was shaped among it.
// - The yes checks the staged payload against the map and the roadmap as
//   they stand, then, as one transaction under the writer lock, writes each
//   new topic's brief, the roadmap — the items taken in and bound joined to
//   their topics, the parks on their horizons, each with its origin and the
//   logs that shaped it — and the epic's manifest: the new topics, every
//   topic's order (8.S10), and the epic's open discovery session closed
//   (8.14.11). A failure part-way leaves no change. One commit takes it all.
// - What comes next is the epic's menu, the first topic in the map's order
//   marked next there (8.8.13).
//
// After the sweep before the spec (8.8.4, 8.10.9), the candidates come from
// the sweep taken (`sweep take`, sweep-take.cjs), which stages them, and
// `render approve-map <unit> --sweep` stages them again from its record
// (sweep.cjs): every live topic in its order, each marked decided or not,
// and the candidates below them, each with its reason, to be taken or
// struck. It is refused where the sweep is not taken, where it found no
// candidate, there being nothing to approve, and for a candidate standing
// as `topic add-batch` refuses one — on the map now, or beside a waiting
// roadmap item it does not take in — as the yes refuses it. The candidates
// add topics and never rename one. A restage keeps the strike of every
// candidate it still names, and Claude's map staged with `--file` after the
// take carries the candidates staged and their strikes over, a topic named
// as a candidate refused. `approve-map strike <unit> <n>` strikes the n-th
// candidate in the staged payload alone, answering the screen again as
// what comes next, and
// `approve-map unstrike <unit> <n>` undoes it; with more than one standing,
// the screen's strike goes through `render approve-map-strike <unit>`, the
// pick (P8). The yes checks the candidates not struck as their landing
// does, then, in the same transaction, lands each as a topic with its
// brief, after the map's topics, its summary its reason and its source the
// sweep, takes in the roadmap item it names, and records each struck name
// as the person's answer. What comes next is the epic's menu where a topic
// is no longer decided — a candidate taken, or a topic one of the sweep's
// messages reopened — and otherwise the spec carries on.
// ---------------------------------------------------------------------------

const fs = require('fs');
const { loadWorkUnitManifest, saveWorkUnitManifest, readProjectManifest, writeProjectManifestAtomic, withProjectLock } = require('../kernel/manifest.cjs');
const { assertLegalName } = require('../kernel/manifest-schema.cjs');
const { statePath } = require('../kernel/state-root.cjs');
const { unitInProgress, discoveryStanding } = require('./topic-standing.cjs');
const { computeTopicLifecycle, CLOSED_LIFECYCLES, dismissedNames, itemOf, topicKey, topicTitle, roadmapItems, itemJoin, briefFile } = require('./derivations.cjs');
const {
  topicNameRefusal, draftIn, writeBrief, addBatchTo, checkBatchEntries, discoveryItems, roadmapRefusal, entryTakeIn, dismiss,
} = require('./discovery-map.cjs');
const { topicsSettled } = require('./spec-standing.cjs');
const { readTaken } = require('./sweep.cjs');
const {
  DEFAULT_KIND, becomesTopic, validateKind, joinToTopic, ensureRoadmap, ensureHorizon, validateSummary, validateSources, requireSourcesOnDisk,
} = require('./roadmap.cjs');
const { commitStateTail, noteCommitOutcome, discoveryScope, PROJECT_MANIFEST_SPEC } = require('./commit.cjs');
const { filled, shaped, listed, readPayload, stage, stagedAt, refusing } = require('./staged-payload.cjs');
const { approveMapScreen, sweptMapScreen, sweptStrikePick } = require('./projections/discovery-gates.cjs');

/**
 * A topic as staged: one on the map by its key alone; a new one with its
 * summary, its brief's draft, and optionally its description and the
 * roadmap item it takes in.
 * @typedef {{name: string, summary?: string, description?: string, brief?: string, from_roadmap?: string}} StagedTopic
 */

/** A park as staged: a roadmap item, its horizon the person's. @typedef {{name: string, summary: string, horizon: string, kind: string, sources: string[]}} Park */

/** A roadmap item the epic was started from, bound to the topic it became. @typedef {{item: string, topic: string}} Bind */

/**
 * A candidate of the sweep's as staged, struck or standing.
 * @typedef {import('./sweep.cjs').SweepCandidate & {struck: boolean}} StagedCandidate
 */

/**
 * The payload as staged: Claude's map, or after the sweep the map as it
 * stands with the sweep's candidates.
 * @typedef {{topics: StagedTopic[], parks: Park[], binds: Bind[], candidates?: StagedCandidate[]}} Staged
 */

const PHASE = 'discovery';

const APPROVE_MAP_USAGE = [
  'approve-map yes <work-unit>',
  'approve-map strike <work-unit> <n>',
  'approve-map unstrike <work-unit> <n>',
].join('\n');

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
  const key = typeof said === 'string' ? topicKey(manifest, said) : null;
  if (key !== null && itemOf(manifest, 'discovery', key)) {
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
  const refusal = roadmapRefusal(project, unit, topics.filter(({ brief }) => brief !== undefined), entryTakeIn);
  if (refusal !== null) throw new Error(refusal);
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
  const unbound = topics.find(({ name }) => unboundSeed(project, unit, name) && !binds.some((bind) => bind.item === name && bind.topic === name));
  if (unbound !== undefined) {
    throw new Error(`"${unbound.name}" would stand beside the roadmap item ${unit} was started from, unbound — bind it with {"item": "${unbound.name}", "topic": "${unbound.name}"} in binds, or name the topic apart`);
  }
  return { topics, parks, binds };
}

/**
 * Whether `name` is a roadmap item the epic was started from, not yet bound,
 * which becomes a topic. @param {Record<string, any>} project @param {string} unit @param {string} name
 */
function unboundSeed(project, unit, name) {
  const item = roadmapItems(project)[name];
  const join = item === undefined ? null : itemJoin(item);
  return join?.work_unit === unit && join.topic === undefined && becomesTopic(item);
}

/** How the candidates' refusals open. */
const CANDIDATES = 'the sweep\'s candidates';

/** Why a name struck before is refused as a candidate. */
const STRUCK_BEFORE = 'it is the person\'s answer, so the sweep never proposes it again (8.10.11)';

/** The source a candidate taken lands with. */
const SWEEP_SOURCE = 'sweep';

/**
 * The candidates as the map adds them: each its reason its summary, with
 * the roadmap item it takes in.
 * @param {import('./sweep.cjs').SweepCandidate[]} candidates
 * @returns {import('./discovery-map.cjs').BatchEntry[]}
 */
function candidateEntries(candidates) {
  return candidates.map(({ name, reason, from_roadmap: fromRoadmap }) => ({ name, summary: reason, ...(fromRoadmap === undefined ? {} : { from_roadmap: fromRoadmap }) }));
}

/**
 * Refused where the candidates could not land on the map as it and the
 * roadmap stand, by the checks `topic add-batch` makes: a name that is no
 * topic's or stands twice, the twin of a waiting roadmap item not taken in,
 * a name on the map or struck from it. Writes nothing.
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest @param {import('./sweep.cjs').SweepCandidate[]} candidates
 */
function checkCandidates(cwd, unit, manifest, candidates) {
  if (candidates.length === 0) return;
  const entries = candidateEntries(candidates);
  checkBatchEntries(entries, CANDIDATES);
  const refusal = roadmapRefusal(readProjectManifest(cwd), unit, entries, entryTakeIn);
  if (refusal !== null) throw new Error(`${CANDIDATES}: ${refusal}`);
  addBatchTo(structuredClone(manifest), entries, CANDIDATES, { reAdd: STRUCK_BEFORE });
}

/** The payload staged for the unit, or null where none is. @param {string} cwd @param {string} unit @returns {Staged|null} */
function stagedOrNone(cwd, unit) {
  const file = stagedFile(cwd, unit);
  return fs.existsSync(file) ? /** @type {Staged} */ (stagedAt(file, nothingStaged(unit))) : null;
}

/**
 * Whether the map after the sweep is staged for the unit — the sweep's
 * candidates, or Claude's map restaged over them at Keep shaping — which
 * `render approve-map <unit>` reads back as staged.
 * @param {string} cwd @param {string} unit
 */
const sweptStaged = (cwd, unit) => stagedOrNone(cwd, unit)?.candidates !== undefined;

/** The candidates standing, none of them struck. @param {StagedCandidate[]} candidates */
const standing = (candidates) => candidates.filter(({ struck }) => !struck);

/**
 * The map after the sweep: every live topic in its order, and the sweep
 * taken's candidates, each struck where the candidate of its name staged
 * before was. Refused where the sweep is not taken, it found no candidate,
 * or a candidate standing could not land.
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest
 * @returns {Staged}
 */
function sweptMap(cwd, unit, manifest) {
  const taken = readTaken(cwd, unit);
  if (taken === null) throw new Error(`${unit}'s sweep is not taken — engine sweep take ${unit} takes its report in`);
  if (taken.candidates.length === 0) throw new Error('the sweep found no candidate holding the person\'s call — nothing comes to the map, so there is nothing to approve');
  const struck = new Set((stagedOrNone(cwd, unit)?.candidates ?? []).filter((candidate) => candidate.struck).map(({ name }) => name));
  const candidates = taken.candidates.map((candidate) => ({ ...candidate, struck: struck.has(candidate.name) }));
  checkCandidates(cwd, unit, manifest, standing(candidates));
  return { topics: liveInOrder(manifest).map((name) => ({ name })), parks: [], binds: [], candidates };
}

/**
 * Stage the map after the sweep for the unit, as `render approve-map
 * --sweep` stages it.
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest
 * @returns {Staged}
 */
function stageSwept(cwd, unit, manifest) {
  return stage(stagedFile(cwd, unit), sweptMap(cwd, unit, manifest));
}

/**
 * The sweep's candidates staged for the unit, refused where none are.
 * @param {string} cwd @param {string} unit @returns {{staged: Staged, candidates: StagedCandidate[]}}
 */
function stagedCandidates(cwd, unit) {
  const staged = /** @type {Staged} */ (stagedAt(stagedFile(cwd, unit), `nothing is staged for ${unit} — engine sweep take ${unit} stages the sweep's candidates`));
  if (staged.candidates === undefined) throw new Error(`no candidate of the sweep's is staged for ${unit} — render approve-map ${unit} --sweep stages them`);
  return { staged, candidates: staged.candidates };
}

/**
 * Claude's map staged after the sweep: the candidates staged carried over
 * with their strikes, refused where a topic of the map is named as one.
 * @param {Staged} map @param {StagedCandidate[]|undefined} candidates
 * @returns {Staged}
 */
function withCandidates(map, candidates) {
  if (candidates === undefined) return map;
  const named = candidates.find(({ name }) => map.topics.some((topic) => topic.name === name));
  if (named !== undefined) throw new Error(`"${named.name}" is staged as a candidate of the sweep's — name the topic apart`);
  return { ...map, candidates };
}

/**
 * The longest run of `b` standing in `a`'s order. @param {string[]} a @param {string[]} b @returns {string[]}
 */
function longestCommon(a, b) {
  /** @type {string[][][]} */
  const runs = Array.from({ length: a.length + 1 }, () => Array.from({ length: b.length + 1 }, () => /** @type {string[]} */ ([])));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      const [down, across] = [runs[i + 1][j], runs[i][j + 1]];
      runs[i][j] = a[i] === b[j] ? [a[i], ...runs[i + 1][j + 1]] : (down.length >= across.length ? down : across);
    }
  }
  return runs[0][0];
}

/**
 * The marks of a re-shape — the map approved before, `approved` its topics in
 * the order approved — on the topics in their order now: new, a topic the
 * approved map did not order; moved, an ordered one off the longest run kept
 * in its order, so a topic moved is the one marked (8.8.21, 8.S48).
 * @param {string[]} approved @param {string[]} now @returns {Map<string, 'new'|'moved'|null>}
 */
function reshapeMarks(approved, now) {
  const kept = new Set(longestCommon(approved, now.filter((name) => approved.includes(name))));
  return new Map(now.map((name) => [name, !approved.includes(name) ? 'new' : kept.has(name) ? null : 'moved']));
}

/**
 * The map as the screen draws it: each topic by its title, marked on a
 * re-shape — a map approved before, its topics holding their order — and
 * each park.
 * @param {string} unit @param {Record<string, any>} manifest @param {Staged} staged
 * @returns {import('./projections/discovery-gates.cjs').MapView}
 */
function mapView(unit, manifest, { topics, parks }) {
  const items = manifest.phases?.discovery?.items ?? {};
  const approved = liveInOrder(manifest).filter((key) => Number.isInteger(items[key].order));
  const names = topics.map(({ name }) => name);
  const marks = approved.length === 0 ? new Map() : reshapeMarks(approved, names);
  return {
    unit,
    topics: names.map((name) => ({ title: topicTitle(manifest, name), mark: marks.get(name) ?? null })),
    parks: parks.map(({ summary, horizon }) => ({ summary, horizon })),
  };
}

/**
 * The map after the sweep as the screen draws it: each topic by its title,
 * marked decided or not, and each candidate by its title with its reason,
 * marked where struck.
 * @param {string} unit @param {Record<string, any>} manifest @param {Staged} staged
 * @returns {import('./projections/discovery-gates.cjs').SweptView}
 */
function sweptView(unit, manifest, { topics, candidates = [] }) {
  return {
    unit,
    topics: topics.map(({ name }) => ({ title: topicTitle(manifest, name), decided: computeTopicLifecycle(manifest, name).lifecycle === 'decided' })),
    candidates: candidates.map(({ name, reason, struck }) => ({ title: topicTitle(manifest, name), reason, struck })),
  };
}

/**
 * The payload the screen draws: the map after the sweep staged from the
 * sweep taken, Claude's staged from `file` with any candidates staged
 * carried over, or either read back as staged.
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest @param {{file?: string, sweep?: string}} args
 * @returns {Staged}
 */
function stagedFrom(cwd, unit, manifest, { file, sweep }) {
  if (sweep !== undefined) return stageSwept(cwd, unit, manifest);
  if (file !== undefined) {
    const map = checked(cwd, unit, manifest, readPayload(cwd, file));
    return stage(stagedFile(cwd, unit), withCandidates(map, stagedOrNone(cwd, unit)?.candidates));
  }
  return /** @type {Staged} */ (stagedAt(stagedFile(cwd, unit), nothingStaged(unit)));
}

/**
 * `render approve-map <unit> [--file <payload.json> | --sweep]`: the screen,
 * Claude's payload staged from `--file`, the map after the sweep staged from
 * the sweep taken with `--sweep`, or either read back as staged.
 * @param {string} cwd @param {{dotpath?: string, file?: string, sweep?: string}} args
 * @returns {string}
 */
function approveMapSurface(cwd, { dotpath: unit = '', file, sweep }) {
  return refusing('render approve-map', () => {
    if (file !== undefined && sweep !== undefined) throw new Error('--file stages Claude\'s map and --sweep the map after the sweep — one or the other');
    const manifest = openMap(cwd, unit);
    const staged = stagedFrom(cwd, unit, manifest, { file, sweep });
    return staged.candidates === undefined ? approveMapScreen(mapView(unit, manifest, staged)) : sweptMapScreen(sweptView(unit, manifest, staged));
  });
}

/**
 * `render approve-map-strike <unit>`: the pick of the sweep's candidate to
 * strike, from the staged payload, where more than one stands.
 * @param {string} cwd @param {{dotpath?: string}} args
 * @returns {string}
 */
function approveMapStrikeSurface(cwd, { dotpath: unit = '' }) {
  return refusing('render approve-map-strike', () => {
    const manifest = openMap(cwd, unit);
    const { candidates } = stagedCandidates(cwd, unit);
    if (standing(candidates).length < 2) throw new Error('the pick is for more than one candidate standing — the screen strikes a lone one itself');
    return sweptStrikePick({ unit, candidates: candidates.map(({ name, struck }) => ({ title: topicTitle(manifest, name), struck })) });
  });
}

/**
 * The roadmap's half of the yes, on the project manifest given: each item
 * taken in or bound joined to its topic — a candidate taken's among them —
 * and each park on its horizon. Answers, by topic, the earlier epic's
 * record an item postponed from another epic carries.
 * @param {Record<string, any>} project @param {string} unit @param {Staged} staged
 * @returns {Record<string, {work_unit: string, topic: string}>}
 */
function landOnRoadmap(project, unit, { topics, parks, binds, candidates = [] }) {
  /** @type {Record<string, {work_unit: string, topic: string}>} */
  const priors = {};
  const taking = [...topics, ...standing(candidates)];
  const joins = [...taking.flatMap(({ name, from_roadmap: item }) => (item === undefined ? [] : [{ item, topic: name }])), ...binds];
  for (const { item, topic } of joins) {
    const prior = joinToTopic(project, unit, item, topic);
    if (prior !== null) priors[topic] = prior;
  }
  const roadmap = ensureRoadmap(project);
  for (const { name, summary, horizon, kind, sources } of parks) {
    ensureHorizon(roadmap, horizon);
    roadmap.items[name] = { horizon, summary, kind, origin: `park:${unit}`, sources };
  }
  return priors;
}

/**
 * The epic's half of the yes, on the manifest given: the new topics, then
 * the candidates taken, their source the sweep, and the struck ones' names
 * recorded as the person's answer; the earlier record each carries; every
 * topic's order, the candidates after the map's topics; and the open
 * discovery session closed. Answers the session closed, or null.
 * @param {Record<string, any>} manifest @param {Staged} staged @param {Record<string, {work_unit: string, topic: string}>} priors
 * @returns {string|null}
 */
function landOnMap(manifest, { topics, candidates = [] }, priors) {
  const added = topics.filter(({ brief }) => brief !== undefined);
  if (added.length > 0) addBatchTo(manifest, added.map(({ name, summary, description, from_roadmap: fromRoadmap }) => ({ name, summary: /** @type {string} */ (summary), description, from_roadmap: fromRoadmap })), 'approve-map yes');
  const taken = standing(candidates);
  if (taken.length > 0) addBatchTo(manifest, candidateEntries(taken), 'approve-map yes', { source: SWEEP_SOURCE });
  const struck = candidates.filter((candidate) => candidate.struck).map(({ name }) => name);
  if (struck.length > 0) dismiss(manifest, struck);
  const items = discoveryItems(manifest);
  for (const [topic, prior] of Object.entries(priors)) items[topic].prior = prior;
  [...topics, ...taken].forEach(({ name }, at) => { items[name].order = at + 1; });
  const closed = typeof manifest.phases.discovery.active_session === 'string' ? manifest.phases.discovery.active_session : null;
  delete manifest.phases.discovery.active_session;
  return closed;
}

/**
 * Write the yes: each new topic's brief, the project manifest, then the
 * epic's — every one put back as it was where a later one fails.
 * @param {string} cwd @param {string} unit @param {Staged} staged @param {Map<string, string>} briefs topic → its brief's content
 * @returns {{closed: string|null, manifest: Record<string, any>}} the discovery session closed, and the epic's manifest as saved
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
    return { closed, manifest };
  });
}

/**
 * The staged payload checked again against the map and the roadmap as they
 * stand: Claude's map whole, and the sweep's candidates not struck.
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest
 * @returns {Staged}
 */
function stagedForYes(cwd, unit, manifest) {
  const { candidates, ...map } = /** @type {Staged} */ (stagedAt(stagedFile(cwd, unit), nothingStaged(unit)));
  const staged = checked(cwd, unit, manifest, map);
  if (candidates === undefined) return staged;
  checkCandidates(cwd, unit, manifest, standing(candidates));
  return { ...staged, candidates };
}

/**
 * What comes after the yes: after the sweep, the epic's menu where a topic
 * is no longer decided — a candidate taken, or a topic a message reopened —
 * else the spec carrying on; after Claude's map, the epic's menu.
 * @param {string} unit @param {Record<string, any>} manifest as the yes saved it @param {boolean} swept
 * @returns {import('./projections/surfaces.cjs').Next}
 */
function nextAfter(unit, manifest, swept) {
  return swept && topicsSettled(manifest) ? { kind: 'continue' } : { kind: 'handoff', skill: 'leeway-continue-epic', args: [unit] };
}

/** A brief's text, ending on a newline. @param {string} text */
const withNewline = (text) => (text.endsWith('\n') ? text : `${text}\n`);

/**
 * `approve-map yes <unit>`: the person's yes, landing the staged map as one
 * transaction.
 * @param {string} cwd @param {string} unit
 */
function approveMapYes(cwd, unit) {
  const staged = stagedForYes(cwd, unit, openMap(cwd, unit));
  const candidates = staged.candidates ?? [];
  const taken = standing(candidates);
  const drafts = staged.topics.flatMap(({ name, brief }) => (brief === undefined ? [] : [{ name, ...draftIn(cwd, brief, `"${name}"'s brief`) }]));
  /** @type {Map<string, string>} */
  const briefs = new Map(drafts.map(({ name, content }) => [name, content]));
  for (const { name, brief } of taken) briefs.set(name, withNewline(brief));
  const { closed, manifest } = writeYes(cwd, unit, staged, briefs);
  for (const { scratch } of drafts) fs.rmSync(scratch, { force: true });
  fs.rmSync(stagedFile(cwd, unit), { force: true });

  /** @type {string[]} */
  const warnings = [];
  const outcome = commitStateTail(cwd, [...discoveryScope(cwd, unit), PROJECT_MANIFEST_SPEC], `discovery(${unit}): approve the map`, warnings);
  const swept = staged.candidates !== undefined;
  /** @type {Record<string, unknown>} */
  const result = {
    unit,
    topics: [...staged.topics, ...taken].map(({ name }) => name),
    added: [...briefs.keys()].map((name) => ({ name, brief: statePath(cwd, briefFile(unit, name)) })),
    parked: staged.parks.map(({ name, horizon }) => ({ name, horizon })),
    bound: staged.binds,
    ...(swept ? { candidates: taken.map(({ name }) => name), struck: candidates.filter(({ struck }) => struck).map(({ name }) => name) } : {}),
    session_closed: closed,
    committed: outcome.committed,
    next: nextAfter(unit, manifest, swept),
  };
  if (warnings.length > 0) result.warnings = warnings;
  noteCommitOutcome(result, outcome);
  return result;
}

/**
 * `approve-map strike|unstrike <unit> <n>`: the n-th of the sweep's
 * candidates struck, or its strike undone, in the staged payload alone,
 * answering the screen as what comes next.
 * @param {string} cwd @param {string} unit @param {string} n @param {boolean} struck
 */
function approveMapStrike(cwd, unit, n, struck) {
  openMap(cwd, unit);
  const { staged, candidates } = stagedCandidates(cwd, unit);
  const at = /^[1-9][0-9]*$/.test(n) ? Number(n) : 0;
  const candidate = candidates[at - 1];
  if (candidate === undefined) throw new Error(`there is no candidate ${n} — the candidates are 1 to ${candidates.length}`);
  if (candidate.struck === struck) throw new Error(`"${candidate.name}" is ${struck ? 'struck already' : 'not struck'}`);
  candidate.struck = struck;
  stage(stagedFile(cwd, unit), staged);
  return { unit, [struck ? 'struck' : 'unstruck']: candidate.name, next: { kind: 'engine', argv: ['render', 'approve-map', unit] } };
}

/**
 * `approve-map yes|strike|unstrike …`: the verb's answer, its refusal
 * opening on its command.
 * @param {string} cwd @param {string[]} argv
 * @returns {Record<string, unknown>}
 */
function runApproveMapVerb(cwd, [verb, ...args]) {
  if (verb === 'yes' && args.length === 1) return refusing('approve-map yes', () => approveMapYes(cwd, args[0]));
  if ((verb === 'strike' || verb === 'unstrike') && args.length === 2) return refusing(`approve-map ${verb}`, () => approveMapStrike(cwd, args[0], args[1], verb === 'strike'));
  throw new Error(`Usage: ${APPROVE_MAP_USAGE.split('\n').map((line) => `engine ${line}`).join(' | ')}`);
}

module.exports = { APPROVE_MAP_USAGE, runApproveMapVerb, approveMapSurface, approveMapStrikeSurface, openMap, isLive, checkCandidates, stageSwept, sweptStaged, stagedOrNone, liveInOrder };
