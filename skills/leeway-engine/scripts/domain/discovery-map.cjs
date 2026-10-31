'use strict';

// ---------------------------------------------------------------------------
// Domain ring: an epic's map (8.6) — its topics at `phases.discovery.items`,
// each `{source, summary[, description][, title][, prior]}` with its place in
// the order, and the names struck from it, `dismissed` — and the writes that
// change it, the `topic` verbs. Each does what the person asked, commits what
// it wrote, and answers one line (8.8.6, 8.8.7):
// - add: a topic, its brief installed at `topics/{topic}/brief.md` from
//   Claude's draft in the cache, which it consumes — the brief's only writer
//   (8.7.6). Refused: a name that is not a lowercase slug (8.8.18), one on
//   the map, one struck from it unless the person asks for it back
//   (8.10.11), and the twin of a waiting roadmap item, unless the topic takes
//   that item in, the item then leaving the roadmap and the topic's source
//   naming it (8.1.6). add-batch is the same for several, in one
//   transaction; the decided gate lands its candidates by the same checks,
//   inside its own (decided.cjs).
// - edit: a topic's summary or description, at any lifecycle.
// - rename: an unstarted topic moves whole — its key, its folder and its
//   place in the order, a roadmap item it took in following it; one that has
//   started takes the new name as its title on every screen, its key, folder,
//   mail and ledger entries keeping the name it started under (8.8.17). A
//   waiting roadmap item's name is refused as add refuses it, and a name
//   struck from the map is taken back.
// - remove: an unstarted topic only, a started one cancelled instead, with
//   its confirm (8.8.8). Its waiting mail goes to the inbox as ideas, a
//   roadmap item it took in goes back on its horizon (8.8.16, 18.8.20), and
//   its name is struck from the map (8.10.11).
// - order: the topics' order (8.6.2).
// - brief: a brief rewritten before its topic starts; once it has, what bears
//   on it goes as a message (8.7.6).
// A verb naming a topic on the map takes its key or the title a rename gave
// it. A topic is unstarted while its lifecycle reads fresh: no conversation
// on it yet, whether or not mail waits for it. A topic a ledger event names keeps
// that name for good (ledger-fold.cjs), so it is neither removed nor moved.
// Rename and remove take the writer lock first, then read the manifest, the
// ledger and the mailbox under it, so no entry or message lands between the
// check and the write. A topic's lifecycle is computed at render time with
// the join every map consumer uses (computeTopicLifecycle), never stored.
// Pivot, absorb and the pull forward land their topic through `addItem`,
// inside transactions of their own, which commit.
// ---------------------------------------------------------------------------

const fs = require('fs');
const { loadWorkUnitManifest, saveWorkUnitManifest, withWorkUnitLock, ensureContainer, readProjectManifest } = require('../kernel/manifest.cjs');
const { commitStateTail, noteCommitOutcome, discoveryScope, PROJECT_MANIFEST_SPEC } = require('./commit.cjs');
const { computeTopicLifecycle, lifecyclePhrase, CLOSED_LIFECYCLES, itemOf, topicDir, briefFile, dismissedNames, topicTitle, topicKeyOf } = require('./derivations.cjs');
const { KEBAB_SLUG_PATTERN } = require('../kernel/manifest-schema.cjs');
const { stateRoot, statePath, cacheScratch } = require('../kernel/state-root.cjs');
const { namesTopic } = require('./ledger-fold.cjs');
const { takeInRefusal, waitingTwin, joinTakenIn, reaimJoins, revertJoins } = require('./roadmap.cjs');
const { moveWaitingToInbox } = require('./mail.cjs');

/**
 * @typedef {object} MapChange  what a `topic` verb did, for its response and its one-line report
 * @property {string} work_unit
 * @property {string} op                 add|add-batch|edit|rename|remove|brief
 * @property {string} [name]             the topic's key after the change
 * @property {string} [title]            how screens title it after the change
 * @property {string} [lifecycle]
 * @property {string} [summary]          add/edit: the value written
 * @property {string} [description]      add/edit: the value written
 * @property {string} [source]           add: the provenance written
 * @property {string} [brief]            add/brief: the brief, absolute
 * @property {string} [from_roadmap]     add: the roadmap item the topic took in
 * @property {{work_unit: string, topic: string}} [prior]  add/set-prior: the epic the topic's earlier record sits in
 * @property {boolean} [re_added]        add, rename: a name struck from the map, taken back
 * @property {{name: string, title: string, from_roadmap?: string}[]} [added]  add-batch
 * @property {string[]} [readded]        add-batch: the names struck from the map, added back
 * @property {string} [renamed_from]     rename: the key before
 * @property {string} [was]              rename: how screens titled it before
 * @property {string} [renamed_to]       rename: the name asked for
 * @property {boolean} [moved]           rename: the key and folder moved — false where the topic had started, its title taking the name
 * @property {string[]} [roadmap_reaimed] rename: the roadmap items following the topic
 * @property {string[]} [inbox]          remove: each waiting message's idea in the inbox, absolute
 * @property {{name: string, horizon: string}[]} [roadmap_returned] remove: the roadmap items back on their horizons
 * @property {number} [map_total]        topics on the map after the change
 * @property {string|null} [committed]
 * @property {string} [note]
 * @property {string[]} [warnings]
 */

/**
 * @typedef {object} SequenceResult
 * @property {string} work_unit
 * @property {'order'} op
 * @property {Record<string, number>} ordered  topic → order, as applied
 * @property {Record<string, string>} titles   topic → how screens title it
 * @property {string|null} committed  short commit sha, or null when nothing was staged
 * @property {string} [note]          set when committed is null
 * @property {string[]} [warnings]     set when the tail commit failed
 */

/**
 * The map's topics, or a loud error.
 * @param {object} manifest
 * @returns {Record<string, Record<string, any>>}
 */
function discoveryItems(manifest) {
  const discovery = /** @type {Record<string, any>} */ (manifest).phases?.discovery;
  const items = discovery && typeof discovery === 'object' ? discovery.items : undefined;
  if (!items || typeof items !== 'object') {
    throw new Error('no discovery items in the manifest (phases.discovery.items)');
  }
  return items;
}

/**
 * The map's topic `name`, or a loud error.
 * @param {object} manifest @param {string} name
 * @returns {Record<string, any>}
 */
function mapItem(manifest, name) {
  const item = discoveryItems(manifest)[name];
  if (!item || typeof item !== 'object') {
    throw new Error(`no discovery item "${name}" in the manifest (phases.discovery.items)`);
  }
  return item;
}

/**
 * The key of the map's topic going by `said` — its key, or the title a
 * rename gave it (8.8.17) — `said` itself where none does.
 * @param {object} manifest @param {string} said
 */
function mapKey(manifest, said) {
  return topicKeyOf(manifest, said) ?? said;
}

/** The map's container, made where the manifest has none. @param {Record<string, any>} manifest */
function mapOf(manifest) {
  const discovery = ensureContainer(ensureContainer(manifest, 'phases', 'phases'), 'discovery', 'phases.discovery');
  ensureContainer(discovery, 'items', 'phases.discovery.items');
  return discovery;
}

/** Topics on the map. @param {object} manifest */
function mapTotal(manifest) {
  return Object.keys(discoveryItems(manifest)).length;
}

/**
 * Why `name` names no topic, or null where it does: a lowercase slug of
 * letters, digits and hyphens, since it names the topic's folder (8.8.18).
 * @param {unknown} name
 * @returns {string|null}
 */
function topicNameRefusal(name) {
  return typeof name === 'string' && KEBAB_SLUG_PATTERN.test(name)
    ? null
    : `"${name}" is not a topic name — a lowercase slug of letters, digits and hyphens, since it names the topic's folder`;
}

/**
 * The address of an earlier epic's record for this topic — where a pull that
 * landed somewhere other than the epic that postponed it reads the prior
 * conversation from. Shape only; the epic and its topic are the caller's to
 * resolve.
 * @param {*} prior
 * @returns {{work_unit: string, topic: string}}
 */
function validatePrior(prior) {
  if (!prior || typeof prior !== 'object' || Array.isArray(prior)
    || typeof prior.work_unit !== 'string' || prior.work_unit === ''
    || typeof prior.topic !== 'string' || prior.topic === '') {
    throw new Error(`invalid prior ${JSON.stringify(prior ?? null)} — must be {work_unit, topic}`);
  }
  return { work_unit: prior.work_unit, topic: prior.topic };
}

/**
 * A brief's draft: Claude's file under the cache, holding text. Refused,
 * naming it as `what`, where it lies outside the cache, is missing or is
 * empty.
 * @param {string} cwd @param {string} draft @param {string} what
 * @returns {{scratch: string, content: string}}
 */
function draftIn(cwd, draft, what) {
  const scratch = cacheScratch(cwd, draft, what);
  let content;
  try {
    content = fs.readFileSync(scratch, 'utf8');
  } catch {
    throw new Error(`${what} names no draft: ${draft}`);
  }
  if (content.trim() === '') throw new Error(`${what} names an empty draft: ${draft}`);
  return { scratch, content: content.endsWith('\n') ? content : `${content}\n` };
}

/**
 * A topic's brief written, its draft kept. Answers the brief, state-relative.
 * @param {string} cwd @param {string} unit @param {string} topic @param {string} content
 * @returns {string}
 */
function writeBrief(cwd, unit, topic, content) {
  const rel = briefFile(unit, topic);
  fs.mkdirSync(statePath(cwd, topicDir(unit, topic)), { recursive: true });
  fs.writeFileSync(statePath(cwd, rel), content);
  return rel;
}

/**
 * A topic's brief written from its draft, the draft consumed. Answers the
 * brief, state-relative.
 * @param {string} cwd @param {string} unit @param {string} topic @param {{scratch: string, content: string}} draft
 * @returns {string}
 */
function installBrief(cwd, unit, topic, { scratch, content }) {
  const rel = writeBrief(cwd, unit, topic, content);
  fs.rmSync(scratch, { force: true });
  return rel;
}

/**
 * Why a topic can't be removed, or null where it can: started, set aside, or
 * named by the ledger, each with the way to what the person is after.
 * @param {object} manifest @param {string} name @param {boolean} named
 * @returns {string|null}
 */
function removeRefusal(manifest, name, named) {
  const { lifecycle } = computeTopicLifecycle(manifest, name);
  if (lifecycle === 'cancelled') return `${lifecyclePhrase(lifecycle)}; reactivate it from the epic menu first`;
  if (lifecycle === 'postponed') return `${lifecyclePhrase(lifecycle)}; pull it forward from the roadmap first`;
  if (lifecycle !== 'fresh') return `${lifecyclePhrase(lifecycle)}; cancel from the epic menu instead`;
  if (named) return 'the ledger holds entries on it, which name it for good; cancel from the epic menu instead';
  return null;
}

/**
 * Why a topic's brief can't be rewritten, or null where it can: its topic
 * has started or is set aside (8.7.6).
 * @param {object} manifest @param {string} name
 * @returns {string|null}
 */
function briefRefusal(manifest, name) {
  const { lifecycle } = computeTopicLifecycle(manifest, name);
  if (lifecycle === 'fresh') return null;
  return CLOSED_LIFECYCLES.includes(lifecycle) ? `takes no brief — ${lifecyclePhrase(lifecycle)}` : 'started — what bears on it goes as a message';
}

/**
 * Whether the ledger names a topic, read under the lock its caller holds:
 * a fold of the whole ledger, which holds the lock for it — fine at today's
 * sizes. What a landing the read finished said goes to `notes`.
 * @param {string} cwd @param {string} unit @param {string} name @param {string[]} notes
 */
function ledgerNames(cwd, unit, name, notes) {
  return namesTopic(stateRoot(cwd), unit, name, notes);
}

/**
 * The commit of a change and its outcome on the result, generically retried:
 * the paths are narrower than any scope.
 * @param {string} cwd @param {string[]} paths @param {string} message @param {MapChange} result @param {string[]} warnings
 * @returns {MapChange}
 */
function committed(cwd, paths, message, result, warnings) {
  const outcome = commitStateTail(cwd, paths, message, warnings);
  result.committed = outcome.committed;
  if (warnings.length > 0) result.warnings = warnings;
  noteCommitOutcome(result, outcome);
  return result;
}

/**
 * Land a topic on the map inside a transaction of the caller's — pivot,
 * absorb, the pull forward — writing `{source, summary[, description][,
 * prior]}` and committing nothing. `backfill` lands it with neither summary
 * nor description, for a topic arriving with its work done, its next epic
 * entry drafting them; it excludes both. Refuses a name that names no topic,
 * a topic on the map, and one struck from it unless `reAdd`.
 * @param {string} cwd @param {string} workUnit @param {string} name
 * @param {{source?: string, summary?: string, description?: string, prior?: {work_unit: string, topic: string}, reAdd?: boolean, backfill?: boolean}} [fields]
 * @returns {MapChange}
 */
function addItem(cwd, workUnit, name, { source = 'discovery', summary, description, prior, reAdd = false, backfill = false } = {}) {
  if (backfill && (summary !== undefined || description !== undefined)) {
    throw new Error('backfill lands the topic without a summary or description — drop one or the other');
  }
  if (!backfill && summary === undefined) throw new Error('a topic needs its summary');
  const misnamed = topicNameRefusal(name);
  if (misnamed !== null) throw new Error(misnamed);
  const priorRef = prior === undefined ? undefined : validatePrior(prior);
  return withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const [readded] = addBatchTo(manifest, [{ name, summary: summary ?? '', ...(description === undefined ? {} : { description }), re_add: reAdd }], null,
      { source, reAdd: 'add it back only at the person\'s ask — re-run with --force-dismissed' });
    const item = mapItem(manifest, name);
    if (backfill) delete item.summary;
    if (priorRef !== undefined) item.prior = priorRef;
    saveWorkUnitManifest(cwd, workUnit, manifest);
    /** @type {MapChange} */
    const result = { work_unit: workUnit, name, op: 'add', source, lifecycle: computeTopicLifecycle(manifest, name).lifecycle, map_total: mapTotal(manifest) };
    if (summary !== undefined) result.summary = summary;
    if (description !== undefined) result.description = description;
    if (priorRef !== undefined) result.prior = priorRef;
    if (readded !== undefined) result.re_added = true;
    return result;
  });
}

/**
 * A batch entry: a topic to add and its summary, and optionally its
 * description, its brief's draft, the roadmap item it takes in, and the
 * person's ask to add back a name struck from the map.
 * @typedef {{name: string, summary: string, description?: string, brief?: string, from_roadmap?: string, re_add?: boolean}} BatchEntry
 */

/**
 * How a batch's checks name an entry's field: by its place in the batch, or,
 * for `topic add`'s one entry, by its flag.
 * @typedef {(i: number, e: Record<string, any>, field: string) => string} FieldName
 */

/** @type {FieldName} */
const batchField = (i, e, field) => `entry ${i + 1} ("${e.name}") — "${field}"`;

/** @type {FieldName} */
const flagField = (_i, _e, field) => `--${field.replace('_', '-')}`;

/**
 * Refuse, in the words of `said`, a batch that is not a non-empty list of
 * entries each well formed, or that names a topic or a roadmap item twice —
 * checked before the map is read.
 * @param {any} entries @param {string} said @param {FieldName} [fieldName]
 */
function checkBatchEntries(entries, said, fieldName = batchField) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error(`${said}: entries must be a non-empty array of {name, summary, brief?, description?, from_roadmap?, re_add?}`);
  }
  entries.forEach((e, i) => {
    if (!e || typeof e !== 'object') throw new Error(`${said}: entry ${i + 1} must be an object`);
    const misnamed = topicNameRefusal(e.name);
    if (misnamed !== null) throw new Error(`${said}: ${misnamed}`);
    if (typeof e.summary !== 'string' || e.summary.trim() === '') {
      throw new Error(`${said}: ${fieldName(i, e, 'summary')} must be a non-empty string`);
    }
    for (const opt of ['description', 'brief', 'from_roadmap']) {
      if (e[opt] !== undefined && (typeof e[opt] !== 'string' || e[opt].trim() === '')) {
        throw new Error(`${said}: ${fieldName(i, e, opt)} must be a non-empty string when present`);
      }
    }
    if (e.re_add !== undefined && typeof e.re_add !== 'boolean') throw new Error(`${said}: ${fieldName(i, e, 're_add')} must be true or false`);
  });
  for (const field of ['name', 'from_roadmap']) {
    const named = entries.map((e) => e[field]).filter((v) => v !== undefined);
    const twice = named.find((v, i) => named.indexOf(v) !== i);
    if (twice !== undefined) throw new Error(`${said}: "${twice}" appears more than once in the batch`);
  }
}

/**
 * The batch added to the map on `manifest`, the whole batch checked against
 * the map as it stands before any of it is applied — refused, in the words
 * of `said` (none for a caller landing one topic), for a name another topic
 * goes by, or one struck from the map that the entry does not ask back,
 * `reAdd` saying how it is asked back. Each topic's source is `source`, with
 * the roadmap item it takes in. The caller saves the manifest.
 * @param {Record<string, any>} manifest @param {BatchEntry[]} entries @param {string|null} said
 * @param {{source?: string, reAdd?: string}} [opts]
 * @returns {string[]} the names struck from the map that the batch added back
 */
function addBatchTo(manifest, entries, said, { source = 'discovery', reAdd = 'add it back only at the person\'s ask — set re_add on the entry' } = {}) {
  const discovery = mapOf(manifest);
  const dismissed = dismissedNames(manifest);
  const lead = said === null ? '' : `${said}: `;
  for (const e of entries) {
    const holder = nameTaken(manifest, null, e.name);
    if (holder === e.name) {
      throw new Error(`${lead}"${e.name}" is already on the map — nothing was added; edit it, or pick a different name`);
    }
    if (holder !== null) throw new Error(`${lead}"${holder}" on the map goes by "${e.name}" — nothing was added; pick a different name`);
    if (dismissed.includes(e.name) && !e.re_add) {
      throw new Error(`${lead}"${e.name}" was previously dismissed from this map — nothing was added; ${reAdd}`);
    }
  }
  const readded = entries.filter((e) => dismissed.includes(e.name)).map((e) => e.name);
  for (const e of entries) {
    /** @type {Record<string, unknown>} */
    const item = { source: sourceOf(source, e.from_roadmap), summary: e.summary };
    if (e.description !== undefined) item.description = e.description;
    discovery.items[e.name] = item;
  }
  if (readded.length > 0) discovery.dismissed = dismissed.filter((n) => !readded.includes(n));
  return readded;
}

/**
 * A topic's provenance, each part `kind:label`, comma-joined: where it came
 * from, and beside it the roadmap item it took in.
 * @param {string} source @param {string|undefined} fromRoadmap
 * @returns {string}
 */
function sourceOf(source, fromRoadmap) {
  if (fromRoadmap === undefined) return source;
  const taken = `roadmap:${fromRoadmap}`;
  return source === 'discovery' ? taken : `${source},${taken}`;
}

/**
 * Why the roadmap stands against a batch (8.1.6), or null: an item taken in
 * that can't be, and a topic beside a waiting item of its name that no entry
 * takes in, naming the way its caller takes one in.
 * @param {Record<string, any>} project @param {string} unit @param {{name: string, from_roadmap?: string}[]} entries @param {TakeIn} takeIn
 * @returns {string|null}
 */
function roadmapRefusal(project, unit, entries, takeIn) {
  const taken = new Set(entries.flatMap((e) => (e.from_roadmap === undefined ? [] : [e.from_roadmap])));
  for (const e of entries) {
    const refusal = e.from_roadmap === undefined ? null : takeInRefusal(project, unit, e.from_roadmap);
    if (refusal !== null) return `"${e.name}" can't take the item in — ${refusal}`;
    const twin = waitingTwin(project, e.name);
    if (twin !== null && !taken.has(twin)) return twinRefusal(e.name, twin, takeIn);
  }
  return null;
}

/**
 * Refuse, in the words of `said`, a batch the roadmap stands against.
 * @param {Record<string, any>} project @param {string} unit @param {BatchEntry[]} entries @param {string} said @param {TakeIn} takeIn
 */
function checkRoadmap(project, unit, entries, said, takeIn) {
  const refusal = roadmapRefusal(project, unit, entries, takeIn);
  if (refusal !== null) throw new Error(`${said}: ${refusal}`);
}

/**
 * Why a topic can't go by `name` while a waiting roadmap item of that name
 * stands (8.1.6), and how its caller takes the item in, where it can.
 * @param {string} name @param {string} twin @param {TakeIn|null} takeIn
 */
function twinRefusal(name, twin, takeIn) {
  return `"${name}" would stand beside the waiting roadmap item of its name — ${takeIn === null ? '' : `take it in with ${takeIn(twin)}, or `}name the topic apart`;
}

/** How a caller takes a waiting roadmap item in: its flag, or its entry's key. @typedef {(twin: string) => string} TakeIn */

/** @type {TakeIn} */
const entryTakeIn = (twin) => `"from_roadmap": "${twin}"`;

/** @type {TakeIn} */
const flagTakeIn = (twin) => `--from-roadmap ${twin}`;

/**
 * How a batch lands: the words its refusals open on, how its checks name an
 * entry's field and take a roadmap item in, each topic's source, and how a name
 * struck from the map is asked back.
 * @typedef {{said: string, fieldName?: FieldName, takeIn?: TakeIn, source?: string, reAddHint?: string}} LandOpts
 */

/** A brief's draft as read. @typedef {{scratch: string, content: string}} Draft */

/**
 * The batch's shape and each entry's draft, checked before the map is read.
 * @param {string} cwd @param {BatchEntry[]} entries @param {LandOpts} opts
 * @returns {Draft[]}
 */
function batchDrafts(cwd, entries, { said, fieldName = batchField }) {
  checkBatchEntries(entries, said, fieldName);
  return entries.map((e, i) => {
    if (e.brief === undefined) throw new Error(`${said}: a topic lands with its brief — ${fieldName(i, e, 'brief')} names its draft`);
    return draftIn(cwd, e.brief, `${said}: ${fieldName(i, e, 'brief')}`);
  });
}

/**
 * Refused where the batch could not land on the loaded map as it and the
 * roadmap stand, by every check `topic add-batch` makes — its shape, its
 * drafts, the roadmap and the map — writing nothing. Answers the drafts as
 * read.
 * @param {string} cwd @param {string} workUnit @param {Record<string, any>} manifest @param {BatchEntry[]} entries @param {LandOpts} opts
 * @returns {Draft[]}
 */
function checkTopics(cwd, workUnit, manifest, entries, opts) {
  const drafts = batchDrafts(cwd, entries, opts);
  checkRoadmap(readProjectManifest(cwd), workUnit, entries, opts.said, opts.takeIn ?? entryTakeIn);
  addBatchTo(structuredClone(manifest), entries, opts.said, { source: opts.source, reAdd: opts.reAddHint });
  return drafts;
}

/**
 * The batch put on the loaded map under the writer lock its caller holds:
 * every entry checked against the roadmap and the map as they stand before
 * any of it is applied, then each topic added and each roadmap item taken in
 * joined to its topic. The caller saves the manifest, then installs the
 * briefs.
 * @param {string} cwd @param {string} workUnit @param {Record<string, any>} manifest @param {BatchEntry[]} entries @param {LandOpts} opts
 */
function placeTopics(cwd, workUnit, manifest, entries, { said, takeIn = entryTakeIn, source = 'discovery', reAddHint }) {
  checkRoadmap(readProjectManifest(cwd), workUnit, entries, said, takeIn);
  const readded = addBatchTo(manifest, entries, said, { source, reAdd: reAddHint });
  const takes = entries.flatMap((e) => (e.from_roadmap === undefined ? [] : [{ item: e.from_roadmap, topic: e.name }]));
  const priors = takes.length > 0 ? joinTakenIn(cwd, workUnit, takes) : {};
  for (const [topic, prior] of Object.entries(priors)) mapItem(manifest, topic).prior = prior;
  return { readded, priors, takes };
}

/**
 * Each entry's brief installed from its draft. Answers the briefs,
 * state-relative.
 * @param {string} cwd @param {string} workUnit @param {BatchEntry[]} entries @param {Draft[]} drafts
 * @returns {string[]}
 */
function installBriefs(cwd, workUnit, entries, drafts) {
  return entries.map((e, i) => installBrief(cwd, workUnit, e.name, drafts[i]));
}

/**
 * What a landing wrote, for its commit: the manifest, each brief, and the
 * project manifest where a roadmap item was taken in.
 * @param {string} workUnit @param {{briefs: string[], takes: unknown[]}} landed
 */
function landedPaths(workUnit, { briefs, takes }) {
  return [`${workUnit}/manifest.json`, ...briefs, ...(takes.length > 0 ? [PROJECT_MANIFEST_SPEC] : [])];
}

/**
 * Topics landed on an epic's map, each with its brief, as one transaction:
 * every entry checked — its name, its draft, the map and the roadmap — before
 * anything is written, then the map saved, each brief installed, each
 * roadmap item taken in joined to its topic, and the paths for one commit.
 * @param {string} cwd @param {string} workUnit @param {BatchEntry[]} entries @param {LandOpts} opts
 */
function landTopics(cwd, workUnit, entries, opts) {
  const drafts = batchDrafts(cwd, entries, opts);
  /** @type {string[]} */
  const warnings = [];
  const landed = withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const placed = placeTopics(cwd, workUnit, manifest, entries, opts);
    saveWorkUnitManifest(cwd, workUnit, manifest);
    return { manifest, ...placed, briefs: installBriefs(cwd, workUnit, entries, drafts) };
  });
  return { ...landed, paths: landedPaths(workUnit, landed), warnings };
}

/**
 * `topic add`: a topic landed on an epic's map with its brief (8.7.6),
 * taking a roadmap item in where `fromRoadmap` names one (8.1.6), a name
 * struck from the map added back at the person's ask (8.10.11), and
 * committed.
 * @param {string} cwd @param {string} workUnit @param {string} name
 * @param {{summary?: string, description?: string, brief?: string, fromRoadmap?: string, reAdd?: boolean, source?: string}} [fields]
 * @returns {MapChange}
 */
function addTopic(cwd, workUnit, name, { summary, description, brief, fromRoadmap, reAdd = false, source } = {}) {
  /** @type {BatchEntry} */
  const entry = {
    name,
    summary: /** @type {string} */ (summary),
    ...(description === undefined ? {} : { description }),
    ...(brief === undefined ? {} : { brief }),
    ...(fromRoadmap === undefined ? {} : { from_roadmap: fromRoadmap }),
    re_add: reAdd,
  };
  const { manifest, readded, priors, briefs, paths, warnings } = landTopics(cwd, workUnit, [entry],
    { said: 'topic add', fieldName: flagField, takeIn: flagTakeIn, source, reAddHint: 'add it back only at the person\'s ask — pass --re-add' });
  const item = mapItem(manifest, name);
  /** @type {MapChange} */
  const result = { work_unit: workUnit, op: 'add', name, title: topicTitle(manifest, name), source: item.source, summary: item.summary, lifecycle: computeTopicLifecycle(manifest, name).lifecycle, map_total: mapTotal(manifest) };
  if (description !== undefined) result.description = description;
  result.brief = statePath(cwd, briefs[0]);
  if (fromRoadmap !== undefined) result.from_roadmap = fromRoadmap;
  if (priors[name] !== undefined) result.prior = priors[name];
  if (readded.length > 0) result.re_added = true;
  return committed(cwd, paths, `discovery(${workUnit}): add ${name} to the map`, result, warnings);
}

/**
 * `topic add-batch`: several topics landed as `topic add` lands one, in one
 * transaction — a failing entry means nothing was added.
 * @param {string} cwd @param {string} workUnit @param {BatchEntry[]} entries
 * @param {{source?: string}} [opts]
 * @returns {MapChange}
 */
function addTopics(cwd, workUnit, entries, { source } = {}) {
  const { manifest, readded, paths, warnings } = landTopics(cwd, workUnit, entries, { said: 'topic add-batch', source });
  /** @type {MapChange} */
  const result = {
    work_unit: workUnit,
    op: 'add-batch',
    added: entries.map((e) => ({ name: e.name, title: topicTitle(manifest, e.name), ...(e.from_roadmap === undefined ? {} : { from_roadmap: e.from_roadmap }) })),
    readded,
    map_total: mapTotal(manifest),
  };
  return committed(cwd, paths, `discovery(${workUnit}): add ${entries.length} topic${entries.length === 1 ? '' : 's'} to the map`, result, warnings);
}

/**
 * `topic edit`: a topic's summary, its description, or both, at any
 * lifecycle, committed. The topic is named by its key or its title.
 * @param {string} cwd @param {string} workUnit @param {string} said
 * @param {{summary?: string, description?: string}} fields
 * @returns {MapChange}
 */
function editTopic(cwd, workUnit, said, { summary, description } = {}) {
  if (summary === undefined && description === undefined) {
    throw new Error('at least one of --summary/--description is required');
  }
  const result = withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const name = mapKey(manifest, said);
    const item = mapItem(manifest, name);
    if (summary !== undefined) item.summary = summary;
    if (description !== undefined) item.description = description;
    saveWorkUnitManifest(cwd, workUnit, manifest);
    /** @type {MapChange} */
    const out = { work_unit: workUnit, op: 'edit', name, title: topicTitle(manifest, name), lifecycle: computeTopicLifecycle(manifest, name).lifecycle, map_total: mapTotal(manifest) };
    if (summary !== undefined) out.summary = summary;
    if (description !== undefined) out.description = description;
    return out;
  });
  return committed(cwd, [`${workUnit}/manifest.json`], `discovery(${workUnit}): edit ${result.name}`, result, []);
}

/**
 * The record of `items` with one key swapped in place, so every other key
 * keeps its position.
 * @param {Record<string, any>} items @param {string} from @param {string} to
 */
function rekeyed(items, from, to) {
  return Object.fromEntries(Object.entries(items).map(([key, value]) => [key === from ? to : key, value]));
}

/**
 * An unstarted topic moved to a new key: its map row in place, with its
 * order; the stub a message parked it with; and its folder — the brief and
 * any waiting mail. Mutates the loaded manifest; moves the folder.
 * @param {string} cwd @param {Record<string, any>} manifest @param {string} from @param {string} to
 */
function moveTopic(cwd, manifest, from, to) {
  const unit = manifest.name;
  if (fs.existsSync(statePath(cwd, topicDir(unit, to)))) {
    throw new Error(`"${from}" can't be renamed — a folder already stands at ${topicDir(unit, to)}`);
  }
  const discovery = manifest.phases.discovery;
  discovery.items = rekeyed(discovery.items, from, to);
  const parked = manifest.phases.discussion?.items;
  if (parked && Object.hasOwn(parked, from)) manifest.phases.discussion.items = rekeyed(parked, from, to);
}

/**
 * The topic on the map, other than `topic`, that goes by `name` — its key or
 * its title — or null.
 * @param {object} manifest @param {string|null} topic @param {string} name
 * @returns {string|null}
 */
function nameTaken(manifest, topic, name) {
  const holder = Object.entries(discoveryItems(manifest)).find(([key, item]) => key !== topic && (key === name || item.title === name));
  return holder ? holder[0] : null;
}

/**
 * `topic rename`: an unstarted topic, one the ledger names not, moved whole
 * to the new name — its key, its folder and its place in the order, a
 * roadmap item it took in re-aimed, and any title it took while set aside
 * dropped; any other given the new name as the title every screen shows,
 * its key, folder, mail and ledger entries keeping the name it started under
 * (8.8.17). A rename to the key drops the title, whatever the topic's
 * lifecycle. A name struck from the map leaves the struck names, the person
 * having asked for it (8.10.11). Refused for the name the topic goes by
 * already, one another topic goes by, and one a waiting roadmap item
 * carries (8.1.6). The writer lock is taken first, the ledger read under
 * it. The topic is named by its key or its title. Committed.
 * @param {string} cwd @param {string} workUnit @param {string} said @param {string} newName
 * @returns {MapChange}
 */
function renameTopic(cwd, workUnit, said, newName) {
  const misnamed = topicNameRefusal(newName);
  if (misnamed !== null) throw new Error(`topic rename: ${misnamed}`);
  /** @type {string[]} */
  const warnings = [];
  const renamed = withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const oldName = mapKey(manifest, said);
    const item = mapItem(manifest, oldName);
    const was = topicTitle(manifest, oldName);
    if (newName === (item.title ?? oldName)) throw new Error(`topic rename: "${oldName}" goes by "${newName}" already`);
    const holder = nameTaken(manifest, oldName, newName);
    if (holder !== null) throw new Error(`topic rename: "${holder}" on the map goes by "${newName}" — pick a different name`);
    const twin = newName === oldName ? null : waitingTwin(readProjectManifest(cwd), newName);
    if (twin !== null) throw new Error(`topic rename: ${twinRefusal(newName, twin, null)}`);
    const moved = newName !== oldName && computeTopicLifecycle(manifest, oldName).lifecycle === 'fresh' && !ledgerNames(cwd, workUnit, oldName, warnings);
    if (moved) moveTopic(cwd, manifest, oldName, newName);
    if (moved || newName === oldName) delete item.title;
    else item.title = newName;
    const dismissed = dismissedNames(manifest);
    const reAdded = dismissed.includes(newName);
    if (reAdded) manifest.phases.discovery.dismissed = dismissed.filter((n) => n !== newName);
    saveWorkUnitManifest(cwd, workUnit, manifest);
    if (moved && fs.existsSync(statePath(cwd, topicDir(workUnit, oldName)))) {
      fs.renameSync(statePath(cwd, topicDir(workUnit, oldName)), statePath(cwd, topicDir(workUnit, newName)));
    }
    const reaimed = moved ? reaimJoins(cwd, workUnit, oldName, newName) : [];
    const key = moved ? newName : oldName;
    /** @type {MapChange} */
    const out = {
      work_unit: workUnit, op: 'rename', name: key, title: topicTitle(manifest, key), was, renamed_from: oldName, renamed_to: newName, moved,
      lifecycle: computeTopicLifecycle(manifest, key).lifecycle, map_total: mapTotal(manifest),
    };
    if (reaimed.length > 0) out.roadmap_reaimed = reaimed;
    if (reAdded) out.re_added = true;
    return out;
  });
  const from = /** @type {string} */ (renamed.renamed_from);
  const paths = [`${workUnit}/manifest.json`, ...(renamed.moved ? [topicDir(workUnit, from), topicDir(workUnit, newName)] : []), ...(renamed.roadmap_reaimed ? [PROJECT_MANIFEST_SPEC] : [])];
  return committed(cwd, paths, `discovery(${workUnit}): rename ${from} to ${newName}`, renamed, warnings);
}

/**
 * `names` recorded on the loaded manifest as the person's answer, struck
 * from the map or from a one-topic unit's candidates, so nothing proposes
 * them again (8.10.11). The caller saves the manifest.
 * @param {Record<string, any>} manifest @param {string[]} names
 */
function dismiss(manifest, names) {
  const discovery = ensureContainer(ensureContainer(manifest, 'phases', 'phases'), 'discovery', 'phases.discovery');
  discovery.dismissed = [...dismissedNames(manifest).filter((n) => !names.includes(n)), ...names];
}

/**
 * `topic remove`: an unstarted topic, one the ledger names not, off the map
 * (8.8.6) — a started one is cancelled instead, with its confirm (8.8.8).
 * Under the writer lock, taken first: the manifest, the ledger and the
 * mailbox read, each waiting message moved to the inbox as an idea, the map
 * row and any stub a message parked it with deleted, its name struck from
 * the map (8.10.11), its folder deleted, and a roadmap item it took in put
 * back on its horizon (8.8.16, 18.8.20). The topic is named by its key or
 * its title. Committed.
 * @param {string} cwd @param {string} workUnit @param {string} said
 * @returns {MapChange}
 */
function removeTopic(cwd, workUnit, said) {
  /** @type {string[]} */
  const warnings = [];
  const removed = withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const name = mapKey(manifest, said);
    mapItem(manifest, name);
    const title = topicTitle(manifest, name);
    const refusal = removeRefusal(manifest, name, ledgerNames(cwd, workUnit, name, warnings));
    if (refusal !== null) throw new Error(`"${name}" can't be removed — ${refusal}`);
    const mail = moveWaitingToInbox(cwd, workUnit, name);
    const discovery = manifest.phases.discovery;
    delete discovery.items[name];
    if (itemOf(manifest, 'discussion', name)) delete manifest.phases.discussion.items[name];
    dismiss(manifest, [name]);
    saveWorkUnitManifest(cwd, workUnit, manifest);
    fs.rmSync(statePath(cwd, topicDir(workUnit, name)), { recursive: true, force: true });
    const reverted = revertJoins(cwd, workUnit, { topic: name });
    const items = readProjectManifest(cwd).roadmap?.items ?? {};
    return {
      mail,
      result: /** @type {MapChange} */ ({
        work_unit: workUnit, op: 'remove', name, title, lifecycle: 'fresh', map_total: mapTotal(manifest),
        inbox: mail.map(({ idea }) => statePath(cwd, idea)),
        roadmap_returned: reverted.map((item) => ({ name: item, horizon: items[item]?.horizon })),
      }),
    };
  });
  const name = /** @type {string} */ (removed.result.name);
  const paths = [
    `${workUnit}/manifest.json`, topicDir(workUnit, name), ...removed.mail.map(({ idea }) => idea),
    ...(removed.result.roadmap_returned?.length ? [PROJECT_MANIFEST_SPEC] : []),
  ];
  return committed(cwd, paths, `discovery(${workUnit}): remove ${name} from the map`, removed.result, warnings);
}

/**
 * `topic brief`: a topic's brief rewritten from Claude's draft, the draft
 * consumed — refused once the topic has started, when what bears on it goes
 * as a message (8.7.6). The topic is named by its key or its title.
 * Committed.
 * @param {string} cwd @param {string} workUnit @param {string} said @param {string|undefined} draft
 * @returns {MapChange}
 */
function rewriteBrief(cwd, workUnit, said, draft) {
  if (draft === undefined) throw new Error('topic brief: --brief names the draft');
  const drafted = draftIn(cwd, draft, 'topic brief: --brief');
  const rewritten = withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const name = mapKey(manifest, said);
    mapItem(manifest, name);
    const refusal = briefRefusal(manifest, name);
    if (refusal !== null) throw new Error(`topic brief: "${name}" ${refusal}`);
    const rel = installBrief(cwd, workUnit, name, drafted);
    return { rel, result: /** @type {MapChange} */ ({ work_unit: workUnit, op: 'brief', name, title: topicTitle(manifest, name), brief: statePath(cwd, rel) }) };
  });
  return committed(cwd, [rewritten.rel], `discovery(${workUnit}): rewrite ${rewritten.result.name}'s brief`, rewritten.result, []);
}

/**
 * `topic order`: the map's order (8.6.2), each topic's `order` set and the
 * discovery scope committed. Choosing the order is the caller's; every topic must
 * be on the map and live, every order a positive integer — checked before
 * anything is written. A topic is named by its key or its title.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {Record<string, number>} orders  topic → order
 * @returns {SequenceResult}
 */
function sequenceMap(cwd, workUnit, orders) {
  const { ordered, titles } = withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const items = discoveryItems(manifest);
    const entries = Object.entries(orders).map(([said, order]) => /** @type {[string, number]} */ ([mapKey(manifest, said), order]));
    if (entries.length === 0) {
      throw new Error('no {topic}={order} assignments given');
    }
    for (const [topic, order] of entries) {
      if (!items[topic] || typeof items[topic] !== 'object') {
        throw new Error(`no discovery item "${topic}" in the manifest (phases.discovery.items)`);
      }
      if (!Number.isInteger(order) || order < 1) {
        throw new Error(`order for "${topic}" must be a positive integer (got ${JSON.stringify(order)})`);
      }
      // A closed row's order is stashed as `previous_order` and returns with
      // it; writing one beside the stash would put the row back in the
      // sequence without bringing the topic back.
      const { lifecycle } = computeTopicLifecycle(manifest, topic);
      if (CLOSED_LIFECYCLES.includes(lifecycle)) {
        throw new Error(`"${topic}" takes no order — ${lifecyclePhrase(lifecycle)}`);
      }
    }
    for (const [topic, order] of entries) {
      items[topic].order = order;
    }
    saveWorkUnitManifest(cwd, workUnit, manifest);
    return { ordered: Object.fromEntries(entries), titles: Object.fromEntries(entries.map(([topic]) => [topic, topicTitle(manifest, topic)])) };
  });

  /** @type {string[]} */
  const warnings = [];
  const outcome = commitStateTail(cwd, discoveryScope(cwd, workUnit), `discovery(${workUnit}): sequence topic map`, warnings);
  /** @type {SequenceResult} */
  const result = { work_unit: workUnit, op: 'order', ordered, titles, committed: outcome.committed };
  if (warnings.length > 0) result.warnings = warnings;
  noteCommitOutcome(result, outcome, `${workUnit} --discovery`);
  return result;
}

/**
 * Record the earlier epic whose record a topic carries — the address a pull
 * of a postponed item copies onto the receiving epic's row when it lands
 * anywhere but the epic that postponed it. Allowed at any lifecycle: the
 * bind that writes it runs after the topic is on the map and may run again.
 * No git commit — the calling transaction stages the manifest.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} name
 * @param {{work_unit: string, topic: string}} prior
 * @returns {MapChange}
 */
function setPrior(cwd, workUnit, name, prior) {
  const priorRef = validatePrior(prior);
  return withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const item = mapItem(manifest, name);
    item.prior = priorRef;

    saveWorkUnitManifest(cwd, workUnit, manifest);
    const { lifecycle } = computeTopicLifecycle(manifest, name);
    return { work_unit: workUnit, name, op: 'set-prior', prior: priorRef, lifecycle, map_total: mapTotal(manifest) };
  });
}

module.exports = {
  sequenceMap, addItem, addTopic, addTopics, editTopic, renameTopic, removeTopic, rewriteBrief, setPrior, topicNameRefusal,
  checkTopics, placeTopics, installBriefs, landedPaths, dismiss,
  addBatchTo, draftIn, writeBrief, discoveryItems, roadmapRefusal, twinRefusal, entryTakeIn,
};
