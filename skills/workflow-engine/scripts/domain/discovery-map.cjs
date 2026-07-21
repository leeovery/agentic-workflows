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
// conversational pre-validation. All errors throw loud and specific, before
// anything is written. Every load→mutate→save runs under the work unit's
// manifest lock (the same lock every manifest writer honours).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { loadWorkUnitManifest, saveWorkUnitManifest, withWorkUnitLock, ensureContainer } = require('../kernel/manifest.cjs');
const { commitScopedWithKb, noteIfNothingCommitted } = require('./commit.cjs');
const { computeTopicLifecycle, phaseItems } = require('./derivations.cjs');
const { VALID_ROUTINGS } = require('../kernel/manifest-schema.cjs');

// Why each non-fresh lifecycle blocks a destructive op — mirrors the
// conversational rejection phrasing in map-operations.md. Derived from the
// actual research state, same honesty rule as the render-time tags: superseded
// research is named as such, never as completed, and a handled topic claims a
// fan-out only when research completed or was superseded.
/** @param {string} lifecycle @param {string|null} researchState */
function lifecyclePhrase(lifecycle, researchState) {
  switch (lifecycle) {
    case 'researching': return 'research is in flight on it';
    case 'discussing': return 'discussion is in flight on it';
    case 'ready_for_discussion':
      return researchState === 'superseded'
        ? 'its research was superseded and discussion is queued'
        : 'research has completed and discussion is queued';
    case 'decided': return 'discussion has concluded';
    case 'handled':
      return researchState === 'completed' || researchState === 'superseded'
        ? 'it has fanned out into discussions and stays on the map as historical anchor'
        : 'it is marked handled and stays on the map as historical anchor';
    default: return 'it has phase work in cancelled state and stays on the map as historical record'; // cancelled
  }
}

/**
 * @typedef {object} SequenceResult
 * @property {Record<string, number>} ordered  topic → order, as applied
 * @property {string|null} committed  short commit sha, or null when nothing was staged
 * @property {string} [note]          set when committed is null
 */

/**
 * @typedef {object} MapOpResult
 * @property {string} work_unit
 * @property {string} name       the item's (current) map name
 * @property {string} op         add|edit|remove|rename|reroute|handle|unhandle
 * @property {string} lifecycle  the item's lifecycle after the op (pre-removal for remove)
 * @property {string} [summary]           add/edit: the value written
 * @property {string} [description]       add/edit: the value written
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
 * Gate a destructive op (remove/rename/reroute) on the fresh lifecycle. The
 * derived lifecycle alone is not enough: status combinations outside the
 * lifecycle join (e.g. superseded research beside a cancelled discussion)
 * derive `fresh`, yet the per-phase items are on record and the map item is
 * their historical anchor — so ANY per-phase item for the topic refuses too.
 * The error names the blocker and points at the recovery path.
 * @param {object} manifest @param {string} name @param {string} verbPhrase  "removed" | "renamed" | "re-routed"
 */
function assertFresh(manifest, name, verbPhrase) {
  const { lifecycle, research_state } = computeTopicLifecycle(manifest, name);
  const hasPhaseWork = ['research', 'discussion'].some(
    (phase) => phaseItems(manifest, phase).some((it) => it.name === name),
  );
  if (lifecycle === 'fresh' && !hasPhaseWork) return;
  if (lifecycle === 'fresh') {
    throw new Error(
      `"${name}" can't be ${verbPhrase} — per-phase work exists on record and it stays on the map as historical anchor`,
    );
  }
  const recovery = lifecycle === 'handled'
    ? 'unhandle it to make it actionable again'
    : 'cancel from the epic menu instead';
  throw new Error(`"${name}" can't be ${verbPhrase} — ${lifecyclePhrase(lifecycle, research_state)}; ${recovery}`);
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
    }
    for (const [topic, order] of entries) {
      items[topic].order = order;
    }

    saveWorkUnitManifest(cwd, workUnit, manifest);
  });

  const committed = commitScopedWithKb(cwd, `.workflows/${workUnit}`, `discovery(${workUnit}): sequence topic map`);
  /** @type {SequenceResult} */
  const result = { ordered: orders, committed };
  noteIfNothingCommitted(result, committed);
  return result;
}

/**
 * Add a new map item: `{routing, source, summary[, description]}` — never a
 * `status` field; map-item lifecycle is computed at render time, not stored.
 * `backfill` lands the item without summary/description (keys absent, not "")
 * so the next epic entry's summary-backfill drafts them — for topics whose
 * artifacts already exist (absorb, pivot); it is mutually exclusive with
 * passing either field. Refuses an active duplicate, and a dismissed name
 * unless `forceDismissed` carries the user's confirmed re-add decision (the
 * entry is then pulled off the dismissed list so analyses treat the topic as
 * live again). No git commit — the calling session's commit cadence picks the
 * change up.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} name
 * @param {{routing?: string, source?: string, summary?: string, description?: string, forceDismissed?: boolean, backfill?: boolean}} [fields]
 * @returns {MapOpResult}
 */
function addItem(cwd, workUnit, name, { routing, source = 'discovery', summary, description, forceDismissed = false, backfill = false } = {}) {
  if (!routing || !VALID_ROUTINGS.includes(routing)) {
    throw new Error(`unknown routing ${JSON.stringify(routing ?? null)} (${VALID_ROUTINGS.join('|')})`);
  }
  if (backfill && (summary !== undefined || description !== undefined)) {
    throw new Error('--backfill lands the item without summary/description — drop the flag or the fields');
  }
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
    discovery.items[name] = item;

    saveWorkUnitManifest(cwd, workUnit, manifest);

    const { lifecycle } = computeTopicLifecycle(manifest, name);
    /** @type {MapOpResult} */
    const result = { work_unit: workUnit, name, op: 'add', routing, source, lifecycle, map_total: Object.keys(discovery.items).length };
    if (summary !== undefined) result.summary = summary;
    if (description !== undefined) result.description = description;
    if (backfill) result.backfill = true;
    if (wasDismissed) result.undismissed = true;
    return result;
  });
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
 * @param {{name: string, routing: string, summary: string, description?: string, brief_path?: string, force_dismissed?: boolean}[]} entries
 * @returns {{work_unit: string, op: string, added: {name: string, routing: string, lifecycle: string}[], undismissed: string[], map_total: number}}
 */
function addItemsBatch(cwd, workUnit, entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('add-batch: entries must be a non-empty array of {name, routing, summary, description?, brief_path?, force_dismissed?}');
  }
  entries.forEach((e, i) => {
    const at = `entry ${i + 1}`;
    if (!e || typeof e !== 'object') throw new Error(`add-batch: ${at} must be an object`);
    if (!e.name || /[./]/.test(e.name)) {
      throw new Error(`add-batch: ${at} — "${e.name}" is not a legal topic name (dots and slashes break manifest addressing)`);
    }
    if (!e.routing || !VALID_ROUTINGS.includes(e.routing)) {
      throw new Error(`add-batch: ${at} ("${e.name}") — unknown routing ${JSON.stringify(e.routing ?? null)} (${VALID_ROUTINGS.join('|')})`);
    }
    if (typeof e.summary !== 'string' || e.summary.trim() === '') {
      throw new Error(`add-batch: ${at} ("${e.name}") — "summary" must be a non-empty string`);
    }
    for (const opt of ['description', 'brief_path']) {
      if (e[opt] !== undefined && (typeof e[opt] !== 'string' || e[opt].trim() === '')) {
        throw new Error(`add-batch: ${at} ("${e.name}") — "${opt}" must be a non-empty string when present`);
      }
    }
  });
  const names = entries.map((e) => e.name);
  const dupe = names.find((n, i) => names.indexOf(n) !== i);
  if (dupe) throw new Error(`add-batch: "${dupe}" appears more than once in the batch`);

  return withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const phases = ensureContainer(manifest, 'phases', 'phases');
    const discovery = ensureContainer(phases, 'discovery', 'phases.discovery');
    ensureContainer(discovery, 'items', 'phases.discovery.items');
    const dismissed = Array.isArray(discovery.dismissed) ? discovery.dismissed : [];

    // Validate the whole batch against current state before applying any of it.
    for (const e of entries) {
      if (discovery.items[e.name]) {
        throw new Error(`add-batch: "${e.name}" is already on the map — nothing was added; edit it, or pick a different name`);
      }
      if (dismissed.includes(e.name) && !e.force_dismissed) {
        throw new Error(`add-batch: "${e.name}" was previously dismissed from this map — nothing was added; confirm the re-add with the user, then set force_dismissed on the entry`);
      }
    }

    /** @type {string[]} */
    const undismissed = [];
    for (const e of entries) {
      if (dismissed.includes(e.name)) undismissed.push(e.name);
      /** @type {Record<string, unknown>} */
      const item = { routing: e.routing, source: 'discovery', summary: e.summary };
      if (e.description !== undefined) item.description = e.description;
      if (e.brief_path !== undefined) item.brief_path = e.brief_path;
      discovery.items[e.name] = item;
    }
    if (undismissed.length > 0) {
      discovery.dismissed = dismissed.filter((n) => !undismissed.includes(n));
    }

    saveWorkUnitManifest(cwd, workUnit, manifest);

    return {
      work_unit: workUnit,
      op: 'add-batch',
      added: entries.map((e) => ({ name: e.name, routing: e.routing, lifecycle: computeTopicLifecycle(manifest, e.name).lifecycle })),
      undismissed,
      map_total: Object.keys(discovery.items).length,
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
 * analyses won't auto-re-propose it. Fresh-only — anything further along
 * stays on the map (as work-in-flight or historical anchor). No git commit.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} name
 * @returns {MapOpResult}
 */
function removeItem(cwd, workUnit, name) {
  return withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const items = discoveryItems(manifest);
    mapItem(manifest, name);
    assertFresh(manifest, name, 'removed');

    delete items[name];
    const discovery = manifest.phases.discovery;
    if (!Array.isArray(discovery.dismissed)) discovery.dismissed = [];
    if (!discovery.dismissed.includes(name)) discovery.dismissed.push(name);

    saveWorkUnitManifest(cwd, workUnit, manifest);

    // Drop the topic's brief — it's regenerable by design, and leaving it on
    // disk would orphan the file and later block a `rename … <this-name>` on the
    // brief-collision guard. Manifest first, file second (self-heals on retry).
    const brief = path.join(cwd, '.workflows', workUnit, 'discovery', 'briefs', `${name}.md`);
    let briefRemoved = false;
    if (fs.existsSync(brief)) { fs.unlinkSync(brief); briefRemoved = true; }

    /** @type {MapOpResult} */
    const result = { work_unit: workUnit, name, op: 'remove', dismissed: true, lifecycle: 'fresh', map_total: Object.keys(items).length };
    if (briefRemoved) result.brief_removed = true;
    return result;
  });
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
  return withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const items = discoveryItems(manifest);
    const item = mapItem(manifest, oldName);
    assertFresh(manifest, oldName, 'renamed');
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
    const briefsDir = path.join(cwd, '.workflows', workUnit, 'discovery', 'briefs');
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
    return result;
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
    assertFresh(manifest, name, 're-routed');
    item.routing = routing;

    saveWorkUnitManifest(cwd, workUnit, manifest);
    return { work_unit: workUnit, name, op: 'reroute', routing, lifecycle: 'fresh', map_total: Object.keys(discoveryItems(manifest)).length };
  });
}

/**
 * Set `handled: true` on a map item — the topic stays on the map as
 * historical anchor but stops prompting for a next action and no longer
 * counts against convergence. Allowed from any lifecycle except
 * already-handled or cancelled. No git commit.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} name
 * @returns {MapOpResult}
 */
function handleItem(cwd, workUnit, name) {
  return withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const item = mapItem(manifest, name);
    const { lifecycle } = computeTopicLifecycle(manifest, name);
    if (lifecycle === 'handled') {
      throw new Error(`"${name}" can't be marked handled — it's already marked handled`);
    }
    if (lifecycle === 'cancelled') {
      throw new Error(`"${name}" can't be marked handled — it's cancelled; reactivate the phase work from the epic menu first`);
    }
    item.handled = true;

    saveWorkUnitManifest(cwd, workUnit, manifest);
    return { work_unit: workUnit, name, op: 'handle', handled: true, lifecycle: 'handled', map_total: Object.keys(discoveryItems(manifest)).length };
  });
}

/**
 * Clear the `handled` marker — the topic returns to its name-matched
 * lifecycle and counts against convergence again. Allowed only when handled.
 * No git commit.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} name
 * @returns {MapOpResult}
 */
function unhandleItem(cwd, workUnit, name) {
  return withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const item = mapItem(manifest, name);
    const { lifecycle } = computeTopicLifecycle(manifest, name);
    if (lifecycle !== 'handled') {
      throw new Error(`"${name}" can't be unhandled — it isn't marked handled, so there's nothing to unhandle`);
    }
    delete item.handled;

    saveWorkUnitManifest(cwd, workUnit, manifest);
    const after = computeTopicLifecycle(manifest, name);
    return { work_unit: workUnit, name, op: 'unhandle', handled: false, lifecycle: after.lifecycle, map_total: Object.keys(discoveryItems(manifest)).length };
  });
}

module.exports = { sequenceMap, addItem, addItemsBatch, editItem, removeItem, renameItem, rerouteItem, handleItem, unhandleItem };
