'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the discovery map — the epic's manifest-backed topic map at
// `phases.discovery.items`. Sequencing records a suggested execution order
// across its topics as a single transaction: manifest write, scoped git
// commit. The Tier-2 map operations (add/edit/remove/rename/reroute/handle/
// unhandle) are per-item writes with NO git commit — the calling session's
// commit cadence picks the manifest change up. An added item is
// `{routing, source, summary[, description]}` — never a `status` field:
// map-item lifecycle is computed at render time, not stored.
//
// Judgment decides, code records: the conversation proposes every move; these
// ops validate and write it. Lifecycle gates are enforced here with the SAME
// render-time join the epic detail builder uses (computeTopicLifecycle in
// domain/derivations) — one computation, two consumers, no
// drift, and the engine can never be the permissive path around the prose's
// conversational pre-validation. A topic the ledger names keeps its name for
// good (ledger-fold.cjs): remove and rename refuse it, whatever its
// lifecycle, the ledger read before the lock is taken. All errors throw loud
// and specific, before anything is written. Every load→mutate→save runs
// under the work unit's manifest lock (the same lock every manifest writer
// honours).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { loadWorkUnitManifest, saveWorkUnitManifest, withWorkUnitLock, ensureContainer } = require('../kernel/manifest.cjs');
const { commitStateTail, noteCommitOutcome, discoveryScope } = require('./commit.cjs');
const { computeTopicLifecycle, phaseItems, lifecyclePhrase, CLOSED_LIFECYCLES, mailboxDepth } = require('./derivations.cjs');
const { VALID_ROUTINGS } = require('../kernel/manifest-schema.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { namesTopic } = require('./ledger-fold.cjs');

/**
 * @typedef {object} SequenceResult
 * @property {Record<string, number>} ordered  topic → order, as applied
 * @property {string|null} committed  short commit sha, or null when nothing was staged
 * @property {string} [note]          set when committed is null
 * @property {string[]} [warnings]     set when the tail commit failed
 */

/**
 * @typedef {object} MapOpResult
 * @property {string} work_unit
 * @property {string} name       the item's (current) map name
 * @property {string} op         add|edit|remove|rename|reroute|handle|unhandle
 * @property {string} lifecycle  the item's lifecycle after the op (pre-removal for remove)
 * @property {string} [summary]           add/edit: the value written
 * @property {string} [description]       add/edit: the value written
 * @property {string} [brief_path]        add: the brief pointer written
 * @property {{work_unit: string, topic: string}} [prior]  add/set-prior: the epic the topic's prior record sits in
 * @property {boolean} [dismissed]        remove: name pushed onto the dismissed list
 * @property {boolean} [brief_removed]    remove: the topic's brief file was deleted
 * @property {string} [renamed_from]      rename: the old name
 * @property {string[]} [preserved_fields] rename: every field carried across
 * @property {boolean} [matches_dismissed] rename: new name matches a dismissed entry (left alone)
 * @property {boolean} [brief_moved]      rename: the brief file moved to the new name
 * @property {string} [routing]           add/reroute: the value written
 * @property {string} [source]            add: the provenance tag written
 * @property {boolean} [handled]          handle/unhandle: the marker after the op
 * @property {boolean} [undismissed]      add: a dismissed entry was cleared (--force-dismissed)
 * @property {boolean} [backfill]         add: item landed without summary/description for summary-backfill
 * @property {string[]} [roadmap_reverted] remove: roadmap items un-pulled (their joins named this topic)
 * @property {string[]} [warnings]         remove/rename: what a landing the ledger's read finished said; remove: the un-pull's tail commit failed
 * @property {number} map_total           items on the map after the op — no follow-up read needed
 */

/**
 * The discovery items record, or a loud error.
 * @param {object} manifest
 * @returns {Record<string, object>}
 */
function discoveryItems(manifest) {
  const discovery = manifest.phases && typeof manifest.phases === 'object' ? manifest.phases.discovery : undefined;
  const items = discovery && typeof discovery === 'object' ? discovery.items : undefined;
  if (!items || typeof items !== 'object') {
    throw new Error('no discovery items in the manifest (phases.discovery.items)');
  }
  return items;
}

/**
 * The discovery item for `name`, or a loud error.
 * @param {object} manifest @param {string} name
 * @returns {object}
 */
function mapItem(manifest, name) {
  const items = discoveryItems(manifest);
  const item = items[name];
  if (!item || typeof item !== 'object') {
    throw new Error(`no discovery item "${name}" in the manifest (phases.discovery.items)`);
  }
  return item;
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

/** What a refusal over a topic with mail waiting says to do instead. */
const MAIL_WAITING = 'messages wait in its mailbox; open the topic to answer them, or cancel the topic from the epic menu instead';

/**
 * Why a topic whose lifecycle derives `fresh` still holds something a
 * destructive op (remove/rename/reroute) would orphan, or null where it
 * holds nothing: messages waiting in its mailbox — a postponed topic's
 * mail makes no phase item, and stays through a pull-forward — or any
 * per-phase item, on record outside the lifecycle join (superseded
 * research beside a parked discussion stub), whose historical anchor the
 * map item is. The one source the transactions and the map-operation gate
 * read.
 * @param {string} cwd @param {object} manifest @param {string} name
 * @returns {string|null}
 */
function freshRefusal(cwd, manifest, name) {
  if (mailboxDepth(stateRoot(cwd), /** @type {{name: string}} */ (manifest).name, name) > 0) return MAIL_WAITING;
  const phaseWork = ['research', 'discussion'].some((phase) => phaseItems(manifest, phase).some((it) => it.name === name));
  return phaseWork ? 'per-phase work exists on record and it stays on the map as historical anchor' : null;
}

/**
 * Gate a destructive op (remove/rename/reroute) on a fresh topic holding
 * nothing (`freshRefusal`). The error names the blocker and points at the
 * recovery path.
 * @param {string} cwd @param {object} manifest @param {string} name @param {string} verbPhrase  "removed" | "renamed" | "re-routed"
 */
function assertFresh(cwd, manifest, name, verbPhrase) {
  const { lifecycle, research_state } = computeTopicLifecycle(manifest, name);
  if (lifecycle === 'fresh') {
    const held = freshRefusal(cwd, manifest, name);
    if (held === null) return;
    throw new Error(`"${name}" can't be ${verbPhrase} — ${held}`);
  }
  const recovery = lifecycle === 'handled'
    ? 'reopen it to make it actionable again'
    : lifecycle === 'cancelled'
      ? 'reactivate it from the epic menu first'
      : lifecycle === 'postponed'
        ? 'pull it forward from the roadmap first'
        : 'cancel from the epic menu instead';
  throw new Error(`"${name}" can't be ${verbPhrase} — ${lifecyclePhrase(lifecycle, research_state)}; ${recovery}`);
}

/**
 * Gate remove and rename on the ledger: a topic any of its events names is
 * refused, its entries naming it for good.
 * @param {boolean} named @param {string} name @param {string} verbPhrase  "removed" | "renamed"
 */
function assertUnnamed(named, name, verbPhrase) {
  if (named) throw new Error(`"${name}" can't be ${verbPhrase} — the ledger holds entries on it, which name it for good; cancel from the epic menu instead`);
}

/**
 * The ledger's say on a topic, read before the work unit's lock is taken:
 * whether it names the topic, and what a landing its read finished said.
 * @param {string} cwd @param {string} workUnit @param {string} name
 */
function ledgerOn(cwd, workUnit, name) {
  /** @type {string[]} */
  const notes = [];
  return { named: namesTopic(stateRoot(cwd), workUnit, name, notes), notes };
}

/**
 * Record a suggested execution order across discovery-map topics: set each
 * topic's `order`, commit scoped to the work unit. Judgment (choosing the
 * order) is the caller's; this validates and writes it. Every topic must
 * exist under `phases.discovery.items` and every order must be a positive
 * integer — checked before anything is written.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {Record<string, number>} orders  topic → order
 * @returns {SequenceResult}
 */
function sequenceMap(cwd, workUnit, orders) {
  withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const items = discoveryItems(manifest);
    const entries = Object.entries(orders);
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
      const { lifecycle, research_state } = computeTopicLifecycle(manifest, topic);
      if (CLOSED_LIFECYCLES.includes(lifecycle)) {
        throw new Error(`"${topic}" takes no order — ${lifecyclePhrase(lifecycle, research_state)}`);
      }
    }
    for (const [topic, order] of entries) {
      items[topic].order = order;
    }

    saveWorkUnitManifest(cwd, workUnit, manifest);
  });

  /** @type {string[]} */
  const warnings = [];
  const outcome = commitStateTail(cwd, discoveryScope(workUnit), `discovery(${workUnit}): sequence topic map`, warnings);
  /** @type {SequenceResult} */
  const result = { ordered: orders, committed: outcome.committed };
  if (warnings.length > 0) result.warnings = warnings;
  noteCommitOutcome(result, outcome, `${workUnit} --discovery`);
  return result;
}

/**
 * Add a new map item: `{routing, source, summary[, description][, brief_path][, prior]}`
 * — never a `status` field; map-item lifecycle is computed at render time, not
 * stored. `briefPath` records the topic's brief pointer with the row, as the
 * harvest's batch form does; `prior` records the earlier epic whose record
 * this topic carries, which a pull of a postponed item landing elsewhere
 * writes. `backfill` lands the item without summary, description or brief
 * pointer (keys absent, not "") so the next epic entry's summary-backfill
 * drafts them — for topics whose artifacts already exist (absorb, pivot); it
 * is mutually exclusive with passing any of the three. Refuses an active
 * duplicate, and a dismissed name unless `forceDismissed` carries the user's
 * confirmed re-add decision (the entry is then pulled off the dismissed list
 * so the analysis treats the topic as live again). No git commit — the calling
 * session's commit cadence picks the change up.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} name
 * @param {{routing?: string, source?: string, summary?: string, description?: string, briefPath?: string, prior?: {work_unit: string, topic: string}, forceDismissed?: boolean, backfill?: boolean}} [fields]
 * @returns {MapOpResult}
 */
function addItem(cwd, workUnit, name, { routing, source = 'discovery', summary, description, briefPath, prior, forceDismissed = false, backfill = false } = {}) {
  if (!routing || !VALID_ROUTINGS.includes(routing)) {
    throw new Error(`unknown routing ${JSON.stringify(routing ?? null)} (${VALID_ROUTINGS.join('|')})`);
  }
  if (backfill && (summary !== undefined || description !== undefined || briefPath !== undefined)) {
    throw new Error('--backfill lands the item without summary/description/brief-path — drop the flag or the fields');
  }
  if (briefPath !== undefined && (typeof briefPath !== 'string' || briefPath.trim() === '')) {
    throw new Error('--brief-path must be a non-empty string when present');
  }
  const priorRef = prior === undefined ? undefined : validatePrior(prior);
  if (!backfill && summary === undefined) {
    throw new Error('--summary is required (or --backfill to leave it for summary-backfill)');
  }
  // Same structural rule rename enforces: dots break the field surface's
  // dot-path addressing, slashes break paths.
  if (!name || /[./]/.test(name)) {
    throw new Error(`"${name}" is not a legal topic name — dots and slashes break manifest addressing`);
  }

  return withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const phases = ensureContainer(manifest, 'phases', 'phases');
    const discovery = ensureContainer(phases, 'discovery', 'phases.discovery');
    ensureContainer(discovery, 'items', 'phases.discovery.items');

    if (discovery.items[name]) {
      throw new Error(`"${name}" is already on the map — edit it, or pick a different name`);
    }
    const dismissed = Array.isArray(discovery.dismissed) ? discovery.dismissed : [];
    const wasDismissed = dismissed.includes(name);
    if (wasDismissed && !forceDismissed) {
      throw new Error(`"${name}" was previously dismissed from this map — confirm the re-add with the user, then re-run with --force-dismissed`);
    }
    if (wasDismissed) {
      discovery.dismissed = dismissed.filter((n) => n !== name);
    }

    /** @type {Record<string, unknown>} */
    const item = { routing, source };
    if (summary !== undefined) item.summary = summary;
    if (description !== undefined) item.description = description;
    if (briefPath !== undefined) item.brief_path = briefPath;
    if (priorRef !== undefined) item.prior = priorRef;
    discovery.items[name] = item;

    saveWorkUnitManifest(cwd, workUnit, manifest);

    const { lifecycle } = computeTopicLifecycle(manifest, name);
    /** @type {MapOpResult} */
    const result = { work_unit: workUnit, name, op: 'add', routing, source, lifecycle, map_total: Object.keys(discovery.items).length };
    if (summary !== undefined) result.summary = summary;
    if (description !== undefined) result.description = description;
    if (briefPath !== undefined) result.brief_path = briefPath;
    if (priorRef !== undefined) result.prior = priorRef;
    if (backfill) result.backfill = true;
    if (wasDismissed) result.undismissed = true;
    return result;
  });
}

/**
 * A batch entry: a topic to add, its routing and summary, and optionally its
 * description, brief pointer and the person's confirmed re-add of a
 * dismissed name.
 * @typedef {{name: string, routing: string, summary: string, description?: string, brief_path?: string, force_dismissed?: boolean}} BatchEntry
 */

/**
 * Refuse, in the words of `said`, a batch that is not a non-empty list of
 * entries each well formed, or that names a topic twice — checked before
 * the map is read.
 * @param {any} entries @param {string} said
 */
function checkBatchEntries(entries, said) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error(`${said}: entries must be a non-empty array of {name, routing, summary, description?, brief_path?, force_dismissed?}`);
  }
  entries.forEach((e, i) => {
    const at = `entry ${i + 1}`;
    if (!e || typeof e !== 'object') throw new Error(`${said}: ${at} must be an object`);
    if (typeof e.name !== 'string' || e.name === '' || /[./]/.test(e.name)) {
      throw new Error(`${said}: ${at} — "${e.name}" is not a legal topic name (dots and slashes break manifest addressing)`);
    }
    if (!e.routing || !VALID_ROUTINGS.includes(e.routing)) {
      throw new Error(`${said}: ${at} ("${e.name}") — unknown routing ${JSON.stringify(e.routing ?? null)} (${VALID_ROUTINGS.join('|')})`);
    }
    if (typeof e.summary !== 'string' || e.summary.trim() === '') {
      throw new Error(`${said}: ${at} ("${e.name}") — "summary" must be a non-empty string`);
    }
    for (const opt of ['description', 'brief_path']) {
      if (e[opt] !== undefined && (typeof e[opt] !== 'string' || e[opt].trim() === '')) {
        throw new Error(`${said}: ${at} ("${e.name}") — "${opt}" must be a non-empty string when present`);
      }
    }
  });
  const names = entries.map((e) => e.name);
  const dupe = names.find((n, i) => names.indexOf(n) !== i);
  if (dupe) throw new Error(`${said}: "${dupe}" appears more than once in the batch`);
}

/**
 * The batch added to the map on `manifest`, each item's provenance
 * `source`, the whole batch checked against the map as it stands before
 * any of it is applied — refused, in the words of `said`, for a name on the
 * map already or one dismissed from it that the entry does not confirm
 * re-adding, `reAdd` saying how it is re-added. The caller saves the
 * manifest.
 * @param {Record<string, any>} manifest @param {BatchEntry[]} entries @param {string} said
 * @param {{source?: string, reAdd?: string}} [opts]
 * @returns {string[]} the dismissed names the batch re-added
 */
function addBatchTo(manifest, entries, said, { source = 'discovery', reAdd = 'confirm the re-add with the user, then set force_dismissed on the entry' } = {}) {
  const phases = ensureContainer(manifest, 'phases', 'phases');
  const discovery = ensureContainer(phases, 'discovery', 'phases.discovery');
  ensureContainer(discovery, 'items', 'phases.discovery.items');
  const dismissed = Array.isArray(discovery.dismissed) ? discovery.dismissed : [];
  for (const e of entries) {
    if (discovery.items[e.name]) {
      throw new Error(`${said}: "${e.name}" is already on the map — nothing was added; edit it, or pick a different name`);
    }
    if (dismissed.includes(e.name) && !e.force_dismissed) {
      throw new Error(`${said}: "${e.name}" was previously dismissed from this map — nothing was added; ${reAdd}`);
    }
  }
  const undismissed = entries.filter((e) => dismissed.includes(e.name)).map((e) => e.name);
  for (const e of entries) {
    /** @type {Record<string, unknown>} */
    const item = { routing: e.routing, source, summary: e.summary };
    if (e.description !== undefined) item.description = e.description;
    if (e.brief_path !== undefined) item.brief_path = e.brief_path;
    discovery.items[e.name] = item;
  }
  if (undismissed.length > 0) discovery.dismissed = dismissed.filter((n) => !undismissed.includes(n));
  return undismissed;
}

/**
 * Add a whole topic set in one transaction — one lock, one load, one save.
 * The batch form for the harvest (D7: one task, one call): every entry is
 * validated before anything is applied, so a failing entry means nothing
 * persisted — never a partial map. Entries may carry `brief_path` (recorded
 * on the item, replacing the per-topic follow-up set) and `force_dismissed`
 * (per-entry re-add confirmation). No git commit — the calling flow's commit
 * covers the batch.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {BatchEntry[]} entries
 * @returns {{work_unit: string, op: string, added: {name: string, routing: string, lifecycle: string}[], undismissed: string[], map_total: number}}
 */
function addItemsBatch(cwd, workUnit, entries) {
  checkBatchEntries(entries, 'add-batch');
  return withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const undismissed = addBatchTo(manifest, entries, 'add-batch');
    saveWorkUnitManifest(cwd, workUnit, manifest);
    return {
      work_unit: workUnit,
      op: 'add-batch',
      added: entries.map((e) => ({ name: e.name, routing: e.routing, lifecycle: computeTopicLifecycle(manifest, e.name).lifecycle })),
      undismissed,
      map_total: Object.keys(manifest.phases.discovery.items).length,
    };
  });
}

/**
 * Set `summary` and/or `description` on a map item — at least one required.
 * Allowed at any lifecycle. No git commit.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} name
 * @param {{summary?: string, description?: string}} fields
 * @returns {MapOpResult}
 */
function editItem(cwd, workUnit, name, { summary, description } = {}) {
  if (summary === undefined && description === undefined) {
    throw new Error('at least one of --summary/--description is required');
  }
  return withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const item = mapItem(manifest, name);
    if (summary !== undefined) item.summary = summary;
    if (description !== undefined) item.description = description;

    saveWorkUnitManifest(cwd, workUnit, manifest);

    const { lifecycle } = computeTopicLifecycle(manifest, name);
    /** @type {MapOpResult} */
    const result = { work_unit: workUnit, name, op: 'edit', lifecycle, map_total: Object.keys(discoveryItems(manifest)).length };
    if (summary !== undefined) result.summary = summary;
    if (description !== undefined) result.description = description;
    return result;
  });
}

/**
 * Hard-delete a fresh map item and push its name onto the dismissed list so
 * the analysis won't auto-re-propose it. Fresh-only — anything further along
 * stays on the map (as work-in-flight or historical anchor). No git commit
 * for the map write itself; a roadmap join naming the topic is reverted (the
 * un-pull for a never-started topic) and that project-manifest write stages
 * in its own commit, reported as `roadmap_reverted`.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} name
 * @returns {MapOpResult}
 */
function removeItem(cwd, workUnit, name) {
  const ledger = ledgerOn(cwd, workUnit, name);
  const result = withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const items = discoveryItems(manifest);
    mapItem(manifest, name);
    assertFresh(cwd, manifest, name, 'removed');
    assertUnnamed(ledger.named, name, 'removed');

    delete items[name];
    const discovery = manifest.phases.discovery;
    if (!Array.isArray(discovery.dismissed)) discovery.dismissed = [];
    if (!discovery.dismissed.includes(name)) discovery.dismissed.push(name);

    saveWorkUnitManifest(cwd, workUnit, manifest);

    // Drop the topic's brief — it's regenerable by design, and leaving it on
    // disk would orphan the file and later block a `rename … <this-name>` on the
    // brief-collision guard. Manifest first, file second (self-heals on retry).
    const brief = path.join(stateRoot(cwd), workUnit, 'discovery', 'briefs', `${name}.md`);
    let briefRemoved = false;
    if (fs.existsSync(brief)) { fs.unlinkSync(brief); briefRemoved = true; }

    /** @type {MapOpResult} */
    const out = { work_unit: workUnit, name, op: 'remove', dismissed: true, lifecycle: 'fresh', map_total: Object.keys(items).length };
    if (briefRemoved) out.brief_removed = true;
    return out;
  });

  // The un-pull for a never-started topic: a fresh topic holding a roadmap
  // join (a pull-forward, or a harvest bind, not yet begun) hands its item
  // back to the map on removal — the stretch-scope wrap's revert. Lazy
  // require and after the work-unit lock closes, mirroring the cancel hop —
  // and like that hop the project manifest is staged in its own commit (the
  // map op itself stays cadence-committed, and no work-unit scope reaches the
  // project manifest).
  const { revertJoins } = require('./roadmap.cjs');
  const reverted = revertJoins(cwd, workUnit, { topic: name });
  const warnings = ledger.notes;
  if (reverted.length > 0) {
    result.roadmap_reverted = reverted;
    const { PROJECT_MANIFEST_SPEC } = require('./commit.cjs');
    commitStateTail(cwd, PROJECT_MANIFEST_SPEC, `roadmap: un-pull ${reverted.join(', ')} (${name} removed from ${workUnit})`, warnings);
  }
  if (warnings.length > 0) result.warnings = warnings;
  return result;
}

/**
 * Rename a fresh map item, carrying every field across and keeping its map
 * position — order, accumulated source, sentinel fields, all of it. The brief
 * rides with the topic: briefs live at `discovery/briefs/{name}.md` and the
 * item's `brief_path` points there, so a rename moves the file and rewrites
 * the pointer (or both go stale under the old name). The new name must not
 * collide with an active map item or an existing brief at the new name; a
 * match against the dismissed list is allowed (the dismissed entry is left
 * alone — it only blocks automatic re-adds). No git commit.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} oldName
 * @param {string} newName
 * @returns {MapOpResult}
 */
function renameItem(cwd, workUnit, oldName, newName) {
  const ledger = ledgerOn(cwd, workUnit, oldName);
  return withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const items = discoveryItems(manifest);
    const item = mapItem(manifest, oldName);
    assertFresh(cwd, manifest, oldName, 'renamed');
    assertUnnamed(ledger.named, oldName, 'renamed');
    if (!newName || newName === oldName) {
      throw new Error(`new name must differ from "${oldName}"`);
    }
    // Dots break the field surface's dot-path addressing, slashes break paths —
    // the same structural rule work-unit and topic names live under. Name-shape
    // conventions beyond that (kebab-case) are the calling flow's job.
    if (/[./]/.test(newName)) {
      throw new Error(`"${newName}" is not a legal topic name — dots and slashes break manifest addressing`);
    }
    if (items[newName]) {
      throw new Error(`"${newName}" is already on the map — pick a different name`);
    }
    const briefsDir = path.join(stateRoot(cwd), workUnit, 'discovery', 'briefs');
    const oldBrief = path.join(briefsDir, `${oldName}.md`);
    const newBrief = path.join(briefsDir, `${newName}.md`);
    const briefOnDisk = fs.existsSync(oldBrief);
    // Checked regardless of whether the old brief exists: renaming onto an
    // occupied brief name would either clobber the file or silently adopt an
    // unrelated brief as this topic's.
    if (fs.existsSync(newBrief)) {
      throw new Error(`a brief already exists at discovery/briefs/${newName}.md — resolve the collision before renaming`);
    }
    const dismissed = manifest.phases.discovery.dismissed;
    const matchesDismissed = Array.isArray(dismissed) && dismissed.includes(newName);

    // Rebuild the items record with the key swapped in place: the item object
    // carries every field (brief_path rewritten below) and its map position
    // holds.
    /** @type {Record<string, object>} */
    const rebuilt = {};
    for (const [key, value] of Object.entries(items)) {
      rebuilt[key === oldName ? newName : key] = value;
    }
    manifest.phases.discovery.items = rebuilt;
    // Rewrite the pointer only when it points at the canonical brief location
    // for the old name — a brief_path aimed anywhere else is not this rename's
    // to re-aim (rewriting it would dangle the pointer).
    if (/** @type {Record<string, unknown>} */ (item).brief_path === `discovery/briefs/${oldName}.md`) {
      /** @type {Record<string, unknown>} */ (item).brief_path = `discovery/briefs/${newName}.md`;
    }

    // Manifest first, brief second: a manifest pointing at a not-yet-moved
    // brief self-heals (the brief is regenerable), whereas a moved brief with
    // the manifest still under the old name would strand the file and dangle
    // the pointer.
    saveWorkUnitManifest(cwd, workUnit, manifest);
    if (briefOnDisk) fs.renameSync(oldBrief, newBrief);
    /** @type {MapOpResult} */
    const result = {
      work_unit: workUnit,
      name: newName,
      op: 'rename',
      renamed_from: oldName,
      preserved_fields: Object.keys(item),
      matches_dismissed: matchesDismissed,
      lifecycle: 'fresh',
      map_total: Object.keys(rebuilt).length,
    };
    if (briefOnDisk) result.brief_moved = true;
    if (ledger.notes.length > 0) result.warnings = ledger.notes;
    return result;
  });
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
 * @returns {MapOpResult}
 */
function setPrior(cwd, workUnit, name, prior) {
  const priorRef = validatePrior(prior);
  return withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const item = mapItem(manifest, name);
    item.prior = priorRef;

    saveWorkUnitManifest(cwd, workUnit, manifest);
    const { lifecycle } = computeTopicLifecycle(manifest, name);
    return { work_unit: workUnit, name, op: 'set-prior', prior: priorRef, lifecycle, map_total: Object.keys(discoveryItems(manifest)).length };
  });
}

/**
 * Set a fresh map item's `routing`. Fresh-only — routing is implicit once a
 * phase item exists. No git commit.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} name
 * @param {string} routing  one of VALID_ROUTINGS
 * @returns {MapOpResult}
 */
function rerouteItem(cwd, workUnit, name, routing) {
  if (!VALID_ROUTINGS.includes(routing)) {
    throw new Error(`unknown routing "${routing}" (${VALID_ROUTINGS.join('|')})`);
  }
  return withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const item = mapItem(manifest, name);
    assertFresh(cwd, manifest, name, 're-routed');
    item.routing = routing;

    saveWorkUnitManifest(cwd, workUnit, manifest);
    return { work_unit: workUnit, name, op: 'reroute', routing, lifecycle: 'fresh', map_total: Object.keys(discoveryItems(manifest)).length };
  });
}

// The way back a closed lifecycle names, shared by both marker ops.
/** @type {Record<string, string>} */
const MARKER_CLOSED_PHRASES = {
  cancelled: "it's cancelled; reactivate it from the epic menu first",
  postponed: "it's postponed; pull it forward from the roadmap first",
};

/**
 * Why a marker op — close as dead end, or reopen — cannot land on a map
 * item, or null when it can: the phrase the refusal ends on, the one source
 * the transactions and the map-operation gate read.
 * @param {string} cwd @param {object} manifest @param {'close'|'reopen'} op @param {string} name
 * @returns {string|null}
 */
function markerRefusal(cwd, manifest, op, name) {
  const { lifecycle } = computeTopicLifecycle(manifest, name);
  if (Object.hasOwn(MARKER_CLOSED_PHRASES, lifecycle)) return MARKER_CLOSED_PHRASES[lifecycle];
  if (op === 'reopen') return lifecycle === 'handled' ? null : "it isn't closed as a dead end, so there's nothing to reopen";
  if (lifecycle === 'handled') return "it's already closed";
  return mailboxDepth(stateRoot(cwd), manifest.name, name) > 0
    ? MAIL_WAITING
    : null;
}

/** What a marker op is called in its refusal. @type {Record<'close'|'reopen', string>} */
const MARKER_VERBS = { close: 'closed as a dead end', reopen: 'reopened' };

/**
 * Set `handled: true` on a map item — the topic stays on the map as
 * historical anchor but stops prompting for a next action and no longer
 * counts against convergence. Allowed from any lifecycle except
 * already-handled, cancelled or postponed, and never while messages wait in
 * its mailbox. No git commit.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} name
 * @returns {MapOpResult}
 */
function handleItem(cwd, workUnit, name) {
  return withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const item = mapItem(manifest, name);
    const refusal = markerRefusal(cwd, manifest, 'close', name);
    if (refusal) throw new Error(`"${name}" can't be ${MARKER_VERBS.close} — ${refusal}`);
    item.handled = true;

    saveWorkUnitManifest(cwd, workUnit, manifest);
    return { work_unit: workUnit, name, op: 'handle', handled: true, lifecycle: 'handled', map_total: Object.keys(discoveryItems(manifest)).length };
  });
}

/**
 * Clear the `handled` marker — the topic returns to its name-matched
 * lifecycle and counts against convergence again. Allowed only when handled;
 * a cancel marker over the dead end reads cancelled and is the reactivate's
 * to clear. No git commit.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} name
 * @returns {MapOpResult}
 */
function unhandleItem(cwd, workUnit, name) {
  return withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const item = mapItem(manifest, name);
    const refusal = markerRefusal(cwd, manifest, 'reopen', name);
    if (refusal) throw new Error(`"${name}" can't be ${MARKER_VERBS.reopen} — ${refusal}`);
    delete item.handled;

    saveWorkUnitManifest(cwd, workUnit, manifest);
    const after = computeTopicLifecycle(manifest, name);
    return { work_unit: workUnit, name, op: 'unhandle', handled: false, lifecycle: after.lifecycle, map_total: Object.keys(discoveryItems(manifest)).length };
  });
}

module.exports = { sequenceMap, addItem, addItemsBatch, checkBatchEntries, addBatchTo, editItem, removeItem, renameItem, rerouteItem, setPrior, handleItem, unhandleItem, markerRefusal, MARKER_VERBS, freshRefusal };
