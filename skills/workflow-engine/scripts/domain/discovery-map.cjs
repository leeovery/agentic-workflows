'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the discovery map — the epic's manifest-backed topic map at
// `phases.discovery.items`. Sequencing records a suggested execution order
// across its topics as a single transaction: manifest write, scoped git
// commit. The Tier-2 map operations (add/edit/remove/rename/reroute/handle/
// reactivate) are per-item writes with NO git commit — the calling session's
// commit cadence picks the manifest change up. An added item is
// `{routing, source, summary[, description]}` — never a `status` field:
// map-item lifecycle is computed at render time, not stored.
//
// Judgment decides, code records: the conversation proposes every move; these
// ops validate and write it. Lifecycle gates are enforced here with the SAME
// render-time join the epic detail builder uses (computeTopicLifecycle in
// domain/discovery-utils) — one computation, two consumers, no
// drift, and the engine can never be the permissive path around the prose's
// conversational pre-validation. All errors throw loud and specific, before
// anything is written. Every load→mutate→save runs under the work unit's
// manifest lock (the same lock every manifest writer honours).
// ---------------------------------------------------------------------------

const { loadWorkUnitManifest, saveWorkUnitManifest, withWorkUnitLock } = require('../kernel/manifest.cjs');
const { commitScopedWithKb } = require('./commit.cjs');
const { computeTopicLifecycle } = require('./discovery-utils.cjs');
const { VALID_ROUTINGS } = require('../kernel/manifest-schema.cjs');

// Why each non-fresh lifecycle blocks a destructive op — mirrors the
// conversational rejection phrasing in map-operations.md section B.
const LIFECYCLE_PHRASES = {
  researching: 'research is in flight on it',
  discussing: 'discussion is in flight on it',
  ready_for_discussion: 'research has completed and discussion is queued',
  decided: 'discussion has concluded',
  handled: 'it has fanned out into discussions and stays on the map as historical anchor',
  cancelled: 'it has phase work in cancelled state and stays on the map as historical record',
};

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
 * @property {string} op         add|edit|remove|rename|reroute|handle|reactivate
 * @property {string} lifecycle  the item's lifecycle after the op (pre-removal for remove)
 * @property {string} [summary]           add/edit: the value written
 * @property {string} [description]       add/edit: the value written
 * @property {boolean} [dismissed]        remove: name pushed onto the dismissed list
 * @property {string} [renamed_from]      rename: the old name
 * @property {string[]} [preserved_fields] rename: every field carried across
 * @property {boolean} [matches_dismissed] rename: new name matches a dismissed entry (left alone)
 * @property {string} [routing]           add/reroute: the value written
 * @property {string} [source]            add: the provenance tag written
 * @property {boolean} [handled]          handle/reactivate: the marker after the op
 * @property {boolean} [undismissed]      add: a dismissed entry was cleared (--force-dismissed)
 * @property {boolean} [backfill]         add: item landed without summary/description for summary-backfill
 * @property {number} [map_total]         add: items on the map after the add
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
 * error names the blocking lifecycle and points at the recovery path.
 * @param {object} manifest @param {string} name @param {string} verbPhrase  "removed" | "renamed" | "re-routed"
 */
function assertFresh(manifest, name, verbPhrase) {
  const { lifecycle } = computeTopicLifecycle(manifest, name);
  if (lifecycle === 'fresh') return;
  const recovery = lifecycle === 'handled'
    ? 'reactivate it to make it actionable again'
    : 'cancel from the epic menu instead';
  throw new Error(`"${name}" can't be ${verbPhrase} — ${LIFECYCLE_PHRASES[/** @type {keyof typeof LIFECYCLE_PHRASES} */ (lifecycle)]}; ${recovery}`);
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
  if (committed === null) result.note = 'nothing to commit';
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
    if (!manifest.phases || typeof manifest.phases !== 'object') manifest.phases = {};
    if (!manifest.phases.discovery || typeof manifest.phases.discovery !== 'object') manifest.phases.discovery = {};
    const discovery = manifest.phases.discovery;
    if (!discovery.items || typeof discovery.items !== 'object') discovery.items = {};

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
    const result = { work_unit: workUnit, name, op: 'edit', lifecycle };
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
    return { work_unit: workUnit, name, op: 'remove', dismissed: true, lifecycle: 'fresh' };
  });
}

/**
 * Rename a fresh map item, carrying EVERY field across (the item object moves
 * key untouched — order, brief_path, accumulated source, sentinel fields, all
 * of it) and keeping its map position. The new name must not collide with an
 * active map item; a match against the dismissed list is allowed (the
 * dismissed entry is left alone — it only blocks automatic re-adds). No git
 * commit.
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
    const dismissed = manifest.phases.discovery.dismissed;
    const matchesDismissed = Array.isArray(dismissed) && dismissed.includes(newName);

    // Rebuild the items record with the key swapped in place: the item object
    // itself is untouched (every field preserved) and its map position holds.
    /** @type {Record<string, object>} */
    const rebuilt = {};
    for (const [key, value] of Object.entries(items)) {
      rebuilt[key === oldName ? newName : key] = value;
    }
    manifest.phases.discovery.items = rebuilt;

    saveWorkUnitManifest(cwd, workUnit, manifest);
    return {
      work_unit: workUnit,
      name: newName,
      op: 'rename',
      renamed_from: oldName,
      preserved_fields: Object.keys(item),
      matches_dismissed: matchesDismissed,
      lifecycle: 'fresh',
    };
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
    return { work_unit: workUnit, name, op: 'reroute', routing, lifecycle: 'fresh' };
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
    return { work_unit: workUnit, name, op: 'handle', handled: true, lifecycle: 'handled' };
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
function reactivateItem(cwd, workUnit, name) {
  return withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const item = mapItem(manifest, name);
    const { lifecycle } = computeTopicLifecycle(manifest, name);
    if (lifecycle !== 'handled') {
      throw new Error(`"${name}" can't be reactivated — it isn't marked handled, so there's nothing to reactivate`);
    }
    delete item.handled;

    saveWorkUnitManifest(cwd, workUnit, manifest);
    const after = computeTopicLifecycle(manifest, name);
    return { work_unit: workUnit, name, op: 'reactivate', handled: false, lifecycle: after.lifecycle };
  });
}

module.exports = { sequenceMap, addItem, editItem, removeItem, renameItem, rerouteItem, handleItem, reactivateItem };
