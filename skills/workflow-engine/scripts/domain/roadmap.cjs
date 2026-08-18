'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the product roadmap — the project-level layer above the work
// unit, stored on the project manifest's `roadmap` node: an ordered
// `horizons` list (user-named release labels; position carries the
// semantics) and an `items` record of capability-grain chunks, each
// `{horizon, summary, origin[, sources][, pulled_to]}` — never a status
// field: item lifecycle is computed at render time by joining `pulled_to`
// against the named work unit, the same trick the discovery map uses one
// level down. "Waiting" is the absence of a join.
//
// Authority splits at the pull (design/product-roadmap.md, decision 25):
// left of it the map is loose — un-pulled items take every edit; right of it
// the work unit is authoritative — re-bucketing or removing a pulled item is
// refused here (the delivery decision routes through the epic-side cancel,
// whose revert returns the item to waiting). Horizon-level restructuring
// (rename/reorder/merge/split) stays open at any join state: it relabels the
// release, it never un-commits work (decision 28).
//
// Every mutation is one transaction under the project-manifest lock plus its
// own pathspec-confined tail commit of `.workflows/manifest.json`: no
// work-unit commit cadence covers the project manifest, and a park fired
// from the middle of any session must be durable immediately. The node and
// any named horizon are created just-in-time — the roadmap has no genesis
// ceremony (decision 10).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const {
  readProjectManifest,
  writeProjectManifestAtomic,
  withProjectLock,
  loadWorkUnitManifest,
  saveWorkUnitManifest,
  withWorkUnitLock,
  ensureContainer,
} = require('../kernel/manifest.cjs');
const { commitTailPathspec, noteCommitOutcome, PROJECT_MANIFEST_SPEC } = require('./commit.cjs');
const { nextSessionNumber } = require('./discovery-session.cjs');
const { TERMINAL_STATUSES } = require('../kernel/manifest-schema.cjs');

// Item provenance vocabulary (design decision 19): how the item landed.
// `harvest` (a product/epic harvest sort), `park:{origin}` (the mid-flow
// valve, origin = the session's container), `inbox:{slug}` (groomed off the
// backlog).
/** @param {*} origin */
function validateOrigin(origin) {
  if (typeof origin !== 'string' || !/^(harvest|park:[^\s]+|inbox:[^\s]+)$/.test(origin)) {
    throw new Error(`unknown origin ${JSON.stringify(origin ?? null)} — one of: harvest, park:{origin}, inbox:{slug}`);
  }
}

// Same structural rule work-unit and topic names live under: dots break the
// field surface's dot-path addressing, slashes break paths. Applies to items
// and horizons alike (both are manifest keys/labels). Name-shape conventions
// beyond that (kebab-case) are the calling flow's job.
/** @param {string} kind @param {*} name */
function validateName(kind, name) {
  if (typeof name !== 'string' || name === '' || /[./]/.test(name)) {
    throw new Error(`"${name}" is not a legal ${kind} name — dots and slashes break manifest addressing`);
  }
}

// Source pointers are provenance indexes into session logs — relative paths
// under `.workflows/`, never absolute, never traversing.
/** @param {*} sources */
function validateSources(sources) {
  if (!Array.isArray(sources) || sources.some((s) => typeof s !== 'string')) {
    throw new Error(`invalid sources ${JSON.stringify(sources)} — must be an array of relative path strings`);
  }
  for (const s of sources) {
    if (s === '' || s.startsWith('/') || s.split('/').includes('..')) {
      throw new Error(`invalid sources entry ${JSON.stringify(s)} — paths are relative under .workflows/, never absolute or traversing`);
    }
  }
}

/** @param {*} summary */
function validateSummary(summary) {
  if (typeof summary !== 'string' || summary.trim() === '') {
    throw new Error('summary must be a non-empty one-liner');
  }
}

// 1-based position in the horizons list; length+1 appends.
/** @param {*} position @param {number} max */
function validatePosition(position, max) {
  if (!Number.isInteger(position) || position < 1 || position > max) {
    throw new Error(`position must be an integer between 1 and ${max} (got ${JSON.stringify(position)})`);
  }
}

/**
 * The roadmap node, created just-in-time. Malformed shapes are refused loud —
 * a scalar `roadmap`, an object `horizons`, an array `items` all name their
 * corruption instead of being silently rebuilt.
 * @param {Record<string, any>} manifest
 * @returns {{horizons: string[], items: Record<string, any>, active_session?: string, imports?: Record<string, any>[]}}
 */
function ensureRoadmap(manifest) {
  const roadmap = ensureContainer(manifest, 'roadmap', 'roadmap');
  if (roadmap.horizons === undefined) roadmap.horizons = [];
  if (!Array.isArray(roadmap.horizons) || roadmap.horizons.some((h) => typeof h !== 'string')) {
    throw new Error('roadmap.horizons is malformed — expected an array of horizon names');
  }
  ensureContainer(roadmap, 'items', 'roadmap.items');
  return /** @type {{horizons: string[], items: Record<string, any>, active_session?: string, imports?: Record<string, any>[]}} */ (roadmap);
}

/**
 * The roadmap node for ops that require it to exist — a loud miss otherwise.
 * @param {Record<string, any>} manifest
 * @returns {{horizons: string[], items: Record<string, any>}}
 */
function requireRoadmap(manifest) {
  if (!manifest.roadmap || typeof manifest.roadmap !== 'object' || Array.isArray(manifest.roadmap)) {
    throw new Error('no roadmap on the project manifest — nothing to operate on');
  }
  return ensureRoadmap(manifest);
}

/**
 * The item for `name`, or a loud error.
 * @param {{items: Record<string, any>}} roadmap @param {string} name
 * @returns {Record<string, any>}
 */
function roadmapItem(roadmap, name) {
  const item = roadmap.items[name];
  if (!item || typeof item !== 'object') {
    throw new Error(`no roadmap item "${name}"`);
  }
  return item;
}

/**
 * The join, when the item carries one. A malformed `pulled_to` (not an
 * object, no work_unit) reads as no join — the write side owns shape.
 * @param {Record<string, any>} item
 * @returns {{work_unit: string, topic?: string}|null}
 */
function itemJoin(item) {
  const j = item.pulled_to;
  if (j && typeof j === 'object' && !Array.isArray(j) && typeof j.work_unit === 'string' && j.work_unit !== '') {
    return j;
  }
  return null;
}

/**
 * Refuse a delivery-falsifying op on a pulled item — the cancel-cascade
 * mirror (design decision 25c). The error names the join and points at the
 * recovery path.
 * @param {Record<string, any>} item @param {string} name @param {string} verbPhrase
 */
function refuseJoined(item, name, verbPhrase) {
  const join = itemJoin(item);
  if (join) {
    throw new Error(
      `"${name}" is joined to work unit "${join.work_unit}" — ${verbPhrase} a pulled item is a delivery decision; cancel it from the epic menu and the revert returns it to waiting`,
    );
  }
}

/**
 * Derive one item's display state from its join — asked at read time, never
 * stored. `waiting` is the absence of a join; a join names a work unit whose
 * status answers the rest. `orphaned` is the honest fallback for a join the
 * revert should have cleared (a missing or cancelled unit) — surfaced, never
 * papered over. `pulled_to.topic` rides along for display; lifecycle
 * derives from the unit alone.
 * @param {string} cwd
 * @param {Record<string, any>} item
 * @returns {{state: 'waiting'|'in-flight'|'shipped'|'orphaned', work_unit?: string, topic?: string}}
 */
function deriveItemState(cwd, item) {
  const join = itemJoin(item);
  if (!join) return { state: 'waiting' };
  /** @type {{state: 'in-flight'|'shipped'|'orphaned', work_unit: string, topic?: string}} */
  const base = { state: 'in-flight', work_unit: join.work_unit };
  if (typeof join.topic === 'string' && join.topic !== '') base.topic = join.topic;
  /** @type {any} */
  let unit;
  try {
    unit = loadWorkUnitManifest(cwd, join.work_unit);
  } catch {
    return { ...base, state: 'orphaned' };
  }
  if (unit.status === 'completed') return { ...base, state: 'shipped' };
  if (unit.status === 'cancelled') return { ...base, state: 'orphaned' };
  return base;
}

/**
 * @typedef {object} RoadmapItemRow
 * @property {string} name
 * @property {string} horizon
 * @property {string} summary
 * @property {string} origin
 * @property {string[]} sources
 * @property {'waiting'|'in-flight'|'shipped'|'orphaned'} state
 * @property {string} [work_unit]  the join's unit, when joined
 * @property {string} [topic]      the join's topic, when a pull-forward set one
 */

/**
 * @typedef {object} RoadmapOpResult  one mutation's response — `op` always;
 *   the rest per-op, plus the shared commit stamp.
 * @property {string} op
 * @property {string} [name]
 * @property {string} [horizon]
 * @property {string} [origin]
 * @property {string} [state]
 * @property {string[]} [horizons]
 * @property {number} [item_total]
 * @property {boolean} [horizon_created]
 * @property {{name: string, horizon: string}[]} [added]
 * @property {string[]} [horizons_created]
 * @property {string} [summary]
 * @property {string} [renamed_from]
 * @property {string[]} [preserved_fields]
 * @property {string} [moved_from]
 * @property {number} [items_updated]
 * @property {string} [merged]
 * @property {string} [into]
 * @property {number} [items_moved]
 * @property {string} [new_horizon]
 * @property {string[]} [pulled]
 * @property {Record<string, number>} [remainder]
 * @property {string} [work_unit]
 * @property {string} [topic]
 * @property {string} [routing]
 * @property {{phase: string, topic: string}[]} [flagged]
 * @property {string|null} [committed]  short sha, or null when nothing staged
 * @property {string} [note]            set when committed is null
 * @property {string[]} [warnings]      commit-tail failures
 */

/**
 * The whole roadmap, derived — the read every consumer shares (gateways,
 * render surfaces, tests). Absent or malformed state reads as no roadmap:
 * `{exists: false}` with empty collections, the never-born state the JIT
 * birth keys on. Items come back horizon-ordered (list order, then insertion
 * order within a horizon; items naming an unknown horizon trail last so a
 * hand-edited manifest still renders). Session material rides along:
 * `active_session` (the marker, or null), `session_logs` (number + path,
 * ascending, from disk), `next_session_number`, and the `imports` entries —
 * a session can exist before any item does (the genesis conversation), so
 * these are read even when the node itself is absent.
 * @param {string} cwd
 * @returns {{exists: boolean, horizons: string[], items: RoadmapItemRow[], totals: {items: number, waiting: number, in_flight: number, shipped: number, orphaned: number}, active_session: string|null, session_logs: {number: number, path: string}[], next_session_number: number, imports: {path: string}[]}}
 */
function roadmapState(cwd) {
  const sessionsDir = path.join(cwd, '.workflows', '.roadmap', 'sessions');
  /** @type {{number: number, path: string}[]} */
  let sessionLogs = [];
  try {
    sessionLogs = fs.readdirSync(sessionsDir)
      .filter((f) => /^session-\d+\.md$/.test(f))
      .sort()
      .map((f) => ({
        number: parseInt(/** @type {RegExpMatchArray} */ (f.match(/^session-(\d+)\.md$/))[1], 10),
        path: path.posix.join('.workflows', '.roadmap', 'sessions', f),
      }));
  } catch {
    sessionLogs = [];
  }
  const sessionBase = {
    session_logs: sessionLogs,
    next_session_number: nextSessionNumber(sessionsDir),
  };
  const empty = {
    exists: false,
    horizons: /** @type {string[]} */ ([]),
    items: /** @type {RoadmapItemRow[]} */ ([]),
    totals: { items: 0, waiting: 0, in_flight: 0, shipped: 0, orphaned: 0 },
    active_session: /** @type {string|null} */ (null),
    ...sessionBase,
    imports: /** @type {{path: string}[]} */ ([]),
  };
  /** @type {Record<string, any>} */
  let manifest = {};
  try {
    manifest = readProjectManifest(cwd);
  } catch {
    return empty;
  }
  const roadmap = manifest.roadmap;
  if (!roadmap || typeof roadmap !== 'object' || Array.isArray(roadmap)) return empty;
  const activeSession = typeof roadmap.active_session === 'string' && roadmap.active_session !== ''
    ? roadmap.active_session
    : null;
  const importEntries = Array.isArray(roadmap.imports)
    ? roadmap.imports.filter((/** @type {*} */ e) => e && typeof e.path === 'string').map((/** @type {*} */ e) => ({ path: e.path }))
    : [];
  const horizons = Array.isArray(roadmap.horizons) ? roadmap.horizons.filter((/** @type {*} */ h) => typeof h === 'string') : [];
  const itemsObj = roadmap.items && typeof roadmap.items === 'object' && !Array.isArray(roadmap.items) ? roadmap.items : {};

  /** @type {RoadmapItemRow[]} */
  const items = [];
  for (const [name, raw] of Object.entries(itemsObj)) {
    if (!raw || typeof raw !== 'object') continue;
    const item = /** @type {Record<string, any>} */ (raw);
    const derived = deriveItemState(cwd, item);
    /** @type {RoadmapItemRow} */
    const row = {
      name,
      horizon: typeof item.horizon === 'string' ? item.horizon : '',
      summary: typeof item.summary === 'string' ? item.summary : '',
      origin: typeof item.origin === 'string' ? item.origin : '',
      sources: Array.isArray(item.sources) ? item.sources.filter((/** @type {*} */ s) => typeof s === 'string') : [],
      state: derived.state,
    };
    if (derived.work_unit !== undefined) row.work_unit = derived.work_unit;
    if (derived.topic !== undefined) row.topic = derived.topic;
    items.push(row);
  }
  const rank = (/** @type {RoadmapItemRow} */ row) => {
    const i = horizons.indexOf(row.horizon);
    return i === -1 ? horizons.length : i;
  };
  items.sort((a, b) => rank(a) - rank(b)); // stable: insertion order within a horizon holds

  const totals = { items: items.length, waiting: 0, in_flight: 0, shipped: 0, orphaned: 0 };
  for (const row of items) {
    if (row.state === 'waiting') totals.waiting++;
    else if (row.state === 'in-flight') totals.in_flight++;
    else if (row.state === 'shipped') totals.shipped++;
    else totals.orphaned++;
  }
  return { exists: true, horizons, items, totals, active_session: activeSession, ...sessionBase, imports: importEntries };
}

/**
 * One transaction under the project lock: read, mutate via `fn`, write
 * atomically. `fn` throws to refuse — nothing is written on any refusal.
 * @template T
 * @param {string} cwd @param {(manifest: Record<string, any>) => T} fn
 * @returns {T}
 */
function transactProject(cwd, fn) {
  return withProjectLock(cwd, () => {
    const manifest = readProjectManifest(cwd);
    const out = fn(manifest);
    writeProjectManifestAtomic(cwd, manifest);
    return out;
  });
}

/**
 * Tail-commit the project manifest and stamp the result — the shared close
 * of every mutation. The state write has landed; a git failure degrades to
 * a warning and a pending note, never a failed verb.
 * @param {string} cwd @param {RoadmapOpResult} result @param {string} message
 * @returns {RoadmapOpResult}
 */
function commitRoadmap(cwd, result, message) {
  /** @type {string[]} */
  const warnings = [];
  const outcome = commitTailPathspec(cwd, PROJECT_MANIFEST_SPEC, message, warnings);
  result.committed = outcome.committed;
  if (outcome.failed) result.warnings = warnings;
  noteCommitOutcome(result, outcome);
  return result;
}

/**
 * JIT-append (or insert) a horizon when the named one is missing. Returns
 * whether it was created.
 * @param {{horizons: string[]}} roadmap @param {string} horizon @param {number} [position]
 * @returns {boolean}
 */
function ensureHorizon(roadmap, horizon, position) {
  if (roadmap.horizons.includes(horizon)) return false;
  validateName('horizon', horizon);
  if (position !== undefined) {
    validatePosition(position, roadmap.horizons.length + 1);
    roadmap.horizons.splice(position - 1, 0, horizon);
  } else {
    roadmap.horizons.push(horizon);
  }
  return true;
}

/**
 * Add one item — the JIT birth path: the node and the named horizon are
 * created when missing. Refuses a duplicate name; never touches existing
 * items. Self-commits.
 * @param {string} cwd
 * @param {string} name
 * @param {{horizon?: string, summary?: string, origin?: string, sources?: string[]}} [fields]
 * @returns {RoadmapOpResult}
 */
function addRoadmapItem(cwd, name, { horizon, summary, origin = 'harvest', sources = [] } = {}) {
  validateName('item', name);
  if (typeof horizon !== 'string' || horizon === '') throw new Error('--horizon is required');
  validateName('horizon', horizon);
  validateSummary(summary);
  validateOrigin(origin);
  validateSources(sources);

  const result = transactProject(cwd, (manifest) => {
    const roadmap = ensureRoadmap(manifest);
    if (roadmap.items[name]) {
      throw new Error(`"${name}" is already on the roadmap — edit it, or pick a different name`);
    }
    const horizonCreated = ensureHorizon(roadmap, horizon);
    /** @type {Record<string, unknown>} */
    const item = { horizon, summary, origin };
    if (sources.length > 0) item.sources = sources;
    roadmap.items[name] = item;
    /** @type {RoadmapOpResult} */
    const out = { op: 'add', name, horizon, origin, state: 'waiting', horizons: [...roadmap.horizons], item_total: Object.keys(roadmap.items).length };
    if (horizonCreated) out.horizon_created = true;
    return out;
  });
  return commitRoadmap(cwd, result, `roadmap: add ${name} (${result.horizon})`);
}

/**
 * Add a whole item set in one transaction — the harvest's batch form. Every
 * entry is validated before anything is applied (a failing entry means
 * nothing persisted), horizons are JIT-created in entry order, and the whole
 * batch lands under one commit.
 * @param {string} cwd
 * @param {{name: string, horizon: string, summary: string, origin?: string, sources?: string[]}[]} entries
 * @returns {RoadmapOpResult}
 */
function addRoadmapItemsBatch(cwd, entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('add-batch: entries must be a non-empty array of {name, horizon, summary, origin?, sources?}');
  }
  entries.forEach((e, i) => {
    const at = `entry ${i + 1}`;
    if (!e || typeof e !== 'object' || Array.isArray(e)) throw new Error(`add-batch: ${at} must be an object`);
    try {
      validateName('item', e.name);
      if (typeof e.horizon !== 'string' || e.horizon === '') throw new Error('"horizon" is required');
      validateName('horizon', e.horizon);
      validateSummary(e.summary);
      if (e.origin !== undefined) validateOrigin(e.origin);
      if (e.sources !== undefined) validateSources(e.sources);
    } catch (err) {
      throw new Error(`add-batch: ${at} — ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  const names = entries.map((e) => e.name);
  const dupe = names.find((n, i) => names.indexOf(n) !== i);
  if (dupe) throw new Error(`add-batch: "${dupe}" appears more than once in the batch`);

  const result = transactProject(cwd, (manifest) => {
    const roadmap = ensureRoadmap(manifest);
    for (const e of entries) {
      if (roadmap.items[e.name]) {
        throw new Error(`add-batch: "${e.name}" is already on the roadmap — nothing was added; edit it, or pick a different name`);
      }
    }
    /** @type {string[]} */
    const horizonsCreated = [];
    for (const e of entries) {
      if (ensureHorizon(roadmap, e.horizon)) horizonsCreated.push(e.horizon);
      /** @type {Record<string, unknown>} */
      const item = { horizon: e.horizon, summary: e.summary, origin: e.origin ?? 'harvest' };
      if (e.sources !== undefined && e.sources.length > 0) item.sources = e.sources;
      roadmap.items[e.name] = item;
    }
    return {
      op: 'add-batch',
      added: entries.map((e) => ({ name: e.name, horizon: e.horizon })),
      horizons_created: horizonsCreated,
      horizons: [...roadmap.horizons],
      item_total: Object.keys(roadmap.items).length,
    };
  });
  return commitRoadmap(cwd, result, `roadmap: add ${entries.length} item${entries.length === 1 ? '' : 's'}`);
}

/**
 * Set an item's summary — allowed at any join state (on a pulled item the
 * row is a window; the edit is cosmetic). Self-commits.
 * @param {string} cwd @param {string} name @param {{summary?: string}} [fields]
 * @returns {RoadmapOpResult}
 */
function editRoadmapItem(cwd, name, { summary } = {}) {
  validateSummary(summary);
  const result = transactProject(cwd, (manifest) => {
    const roadmap = requireRoadmap(manifest);
    const item = roadmapItem(roadmap, name);
    item.summary = summary;
    return { op: 'edit', name, summary, state: deriveItemState(cwd, item).state, item_total: Object.keys(roadmap.items).length };
  });
  return commitRoadmap(cwd, result, `roadmap: edit ${name}`);
}

/**
 * Rename an item, carrying every field across — the join included (a rename
 * relabels the capability, it never touches delivery). Keeps the item's
 * insertion position. Self-commits.
 * @param {string} cwd @param {string} oldName @param {string} newName
 * @returns {RoadmapOpResult}
 */
function renameRoadmapItem(cwd, oldName, newName) {
  validateName('item', newName);
  if (newName === oldName) throw new Error(`new name must differ from "${oldName}"`);
  const result = transactProject(cwd, (manifest) => {
    const roadmap = requireRoadmap(manifest);
    const item = roadmapItem(roadmap, oldName);
    if (roadmap.items[newName]) {
      throw new Error(`"${newName}" is already on the roadmap — pick a different name`);
    }
    /** @type {Record<string, any>} */
    const rebuilt = {};
    for (const [key, value] of Object.entries(roadmap.items)) {
      rebuilt[key === oldName ? newName : key] = value;
    }
    roadmap.items = rebuilt;
    return {
      op: 'rename',
      name: newName,
      renamed_from: oldName,
      preserved_fields: Object.keys(item),
      state: deriveItemState(cwd, item).state,
      item_total: Object.keys(rebuilt).length,
    };
  });
  return commitRoadmap(cwd, result, `roadmap: rename ${oldName} to ${newName}`);
}

/**
 * Re-bucket an item into another horizon (JIT-created when missing). Refused
 * on a pulled item — that is "stop building this", the epic's decision.
 * Self-commits.
 * @param {string} cwd @param {string} name @param {string} horizon
 * @returns {RoadmapOpResult}
 */
function moveRoadmapItem(cwd, name, horizon) {
  if (typeof horizon !== 'string' || horizon === '') throw new Error('--horizon is required');
  const result = transactProject(cwd, (manifest) => {
    const roadmap = requireRoadmap(manifest);
    const item = roadmapItem(roadmap, name);
    refuseJoined(item, name, 're-bucketing');
    if (item.horizon === horizon) throw new Error(`"${name}" is already in "${horizon}"`);
    const horizonCreated = ensureHorizon(roadmap, horizon);
    const from = item.horizon;
    item.horizon = horizon;
    /** @type {RoadmapOpResult} */
    const out = { op: 'move', name, horizon, moved_from: from, state: 'waiting', horizons: [...roadmap.horizons], item_total: Object.keys(roadmap.items).length };
    if (horizonCreated) out.horizon_created = true;
    return out;
  });
  return commitRoadmap(cwd, result, `roadmap: move ${name} to ${horizon}`);
}

/**
 * Delete an item. Refused on a pulled item (the epic-side cancel is the
 * path; its revert returns the item first). No dismissed list — git history
 * and the session logs keep the story. Self-commits.
 * @param {string} cwd @param {string} name
 * @returns {RoadmapOpResult}
 */
function removeRoadmapItem(cwd, name) {
  const result = transactProject(cwd, (manifest) => {
    const roadmap = requireRoadmap(manifest);
    const item = roadmapItem(roadmap, name);
    refuseJoined(item, name, 'removing');
    delete roadmap.items[name];
    return { op: 'remove', name, item_total: Object.keys(roadmap.items).length };
  });
  return commitRoadmap(cwd, result, `roadmap: remove ${name}`);
}

/**
 * Add a horizon at a position (1-based; default appends). Self-commits.
 * @param {string} cwd @param {string} name @param {{position?: number}} [opts]
 * @returns {RoadmapOpResult}
 */
function addHorizon(cwd, name, { position } = {}) {
  validateName('horizon', name);
  const result = transactProject(cwd, (manifest) => {
    const roadmap = ensureRoadmap(manifest);
    if (roadmap.horizons.includes(name)) {
      throw new Error(`horizon "${name}" already exists`);
    }
    ensureHorizon(roadmap, name, position);
    return { op: 'horizon-add', name, horizons: [...roadmap.horizons] };
  });
  return commitRoadmap(cwd, result, `roadmap: horizon add ${name}`);
}

/**
 * Rename a horizon in place, cascading to every member item's `horizon`
 * field — pulled members included: relabeling the release is presentational,
 * it never un-commits work. Self-commits.
 * @param {string} cwd @param {string} oldName @param {string} newName
 * @returns {RoadmapOpResult}
 */
function renameHorizon(cwd, oldName, newName) {
  validateName('horizon', newName);
  if (newName === oldName) throw new Error(`new name must differ from "${oldName}"`);
  const result = transactProject(cwd, (manifest) => {
    const roadmap = requireRoadmap(manifest);
    const idx = roadmap.horizons.indexOf(oldName);
    if (idx === -1) throw new Error(`no horizon "${oldName}"`);
    if (roadmap.horizons.includes(newName)) throw new Error(`horizon "${newName}" already exists`);
    roadmap.horizons[idx] = newName;
    let itemsUpdated = 0;
    for (const item of Object.values(roadmap.items)) {
      if (item && typeof item === 'object' && item.horizon === oldName) {
        item.horizon = newName;
        itemsUpdated++;
      }
    }
    return { op: 'horizon-rename', name: newName, renamed_from: oldName, items_updated: itemsUpdated, horizons: [...roadmap.horizons] };
  });
  return commitRoadmap(cwd, result, `roadmap: horizon rename ${oldName} to ${newName}`);
}

/**
 * Reorder the horizons — the argument must be a complete permutation of the
 * current list (position carries the semantics, so a partial order is
 * ambiguous and refused). Self-commits.
 * @param {string} cwd @param {string[]} order
 * @returns {RoadmapOpResult}
 */
function reorderHorizons(cwd, order) {
  if (!Array.isArray(order) || order.length === 0) {
    throw new Error('reorder: a complete horizon order is required');
  }
  const result = transactProject(cwd, (manifest) => {
    const roadmap = requireRoadmap(manifest);
    const current = [...roadmap.horizons].sort();
    const proposed = [...order].sort();
    if (current.length !== proposed.length || current.some((h, i) => h !== proposed[i])) {
      throw new Error(`reorder: the order must name every existing horizon exactly once (current: ${roadmap.horizons.join(', ')})`);
    }
    roadmap.horizons = [...order];
    return { op: 'horizon-reorder', horizons: [...roadmap.horizons] };
  });
  return commitRoadmap(cwd, result, 'roadmap: horizon reorder');
}

/**
 * Merge one horizon into another: every member moves (pulled members
 * included — horizon restructuring is presentational for joins), the source
 * label is dropped. Self-commits.
 * @param {string} cwd @param {string} from @param {string} into
 * @returns {RoadmapOpResult}
 */
function mergeHorizons(cwd, from, into) {
  if (from === into) throw new Error('merge: the two horizons must differ');
  const result = transactProject(cwd, (manifest) => {
    const roadmap = requireRoadmap(manifest);
    if (!roadmap.horizons.includes(from)) throw new Error(`no horizon "${from}"`);
    if (!roadmap.horizons.includes(into)) throw new Error(`no horizon "${into}"`);
    let moved = 0;
    for (const item of Object.values(roadmap.items)) {
      if (item && typeof item === 'object' && item.horizon === from) {
        item.horizon = into;
        moved++;
      }
    }
    roadmap.horizons = roadmap.horizons.filter((h) => h !== from);
    return { op: 'horizon-merge', merged: from, into, items_moved: moved, horizons: [...roadmap.horizons] };
  });
  return commitRoadmap(cwd, result, `roadmap: horizon merge ${from} into ${into}`);
}

/**
 * Split a horizon: create a new one (default position: right after the
 * source) and move the named members into it. Every named item must belong
 * to the source horizon — a split relabels part of one release, it never
 * gathers strays. Pulled members move too (presentational). Self-commits.
 * @param {string} cwd @param {string} name
 * @param {{newName?: string, items?: string[], position?: number}} [opts]
 * @returns {RoadmapOpResult}
 */
function splitHorizon(cwd, name, { newName, items, position } = {}) {
  if (typeof newName !== 'string' || newName === '') throw new Error('--new is required');
  validateName('horizon', newName);
  if (newName === name) throw new Error('split: the new horizon must differ from the source');
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('--items is required — the members moving to the new horizon');
  }
  const dupe = items.find((n, i) => items.indexOf(n) !== i);
  if (dupe) throw new Error(`split: "${dupe}" appears more than once in --items`);

  const result = transactProject(cwd, (manifest) => {
    const roadmap = requireRoadmap(manifest);
    if (!roadmap.horizons.includes(name)) throw new Error(`no horizon "${name}"`);
    if (roadmap.horizons.includes(newName)) throw new Error(`horizon "${newName}" already exists`);
    for (const itemName of items) {
      const item = roadmapItem(roadmap, itemName);
      if (item.horizon !== name) {
        throw new Error(`split: "${itemName}" is in "${item.horizon}", not "${name}" — a split moves members of the source horizon only`);
      }
    }
    if (position !== undefined) {
      validatePosition(position, roadmap.horizons.length + 1);
      roadmap.horizons.splice(position - 1, 0, newName);
    } else {
      roadmap.horizons.splice(roadmap.horizons.indexOf(name) + 1, 0, newName);
    }
    for (const itemName of items) {
      roadmap.items[itemName].horizon = newName;
    }
    return { op: 'horizon-split', name, new_horizon: newName, items_moved: items.length, horizons: [...roadmap.horizons] };
  });
  return commitRoadmap(cwd, result, `roadmap: horizon split ${name} — ${newName}`);
}

/**
 * Remove an empty horizon — one with members refuses and points at merge/
 * move. Self-commits.
 * @param {string} cwd @param {string} name
 * @returns {RoadmapOpResult}
 */
function removeHorizon(cwd, name) {
  const result = transactProject(cwd, (manifest) => {
    const roadmap = requireRoadmap(manifest);
    if (!roadmap.horizons.includes(name)) throw new Error(`no horizon "${name}"`);
    const members = Object.entries(roadmap.items)
      .filter(([, item]) => item && typeof item === 'object' && item.horizon === name)
      .map(([n]) => n);
    if (members.length > 0) {
      throw new Error(`horizon "${name}" holds ${members.length} item${members.length === 1 ? '' : 's'} (${members.join(', ')}) — merge it or move them first`);
    }
    roadmap.horizons = roadmap.horizons.filter((h) => h !== name);
    return { op: 'horizon-remove', name, horizons: [...roadmap.horizons] };
  });
  return commitRoadmap(cwd, result, `roadmap: horizon remove ${name}`);
}

/**
 * Pull items into a work unit — the commitment point. Sets `pulled_to` on
 * each named item; the unit must exist and be in-progress, every item must
 * exist and be un-joined. The response names the remainder per touched
 * horizon ("3 items stay waiting in mvp") so a partial pull is never
 * silent (design decision 30). The epic's seed set is derivable from these
 * joins — nothing is mirrored onto the work unit (one home per fact).
 * Self-commits.
 * @param {string} cwd @param {string[]} names @param {{into?: string}} [opts]
 * @returns {RoadmapOpResult}
 */
function pullItems(cwd, names, { into } = {}) {
  if (!Array.isArray(names) || names.length === 0) {
    throw new Error('pull: at least one item name is required');
  }
  const dupe = names.find((n, i) => names.indexOf(n) !== i);
  if (dupe) throw new Error(`pull: "${dupe}" appears more than once`);
  if (typeof into !== 'string' || into === '') throw new Error('--into is required');

  /** @type {any} */
  let unit;
  try {
    unit = loadWorkUnitManifest(cwd, into);
  } catch {
    throw new Error(`no work unit "${into}" — the pull joins items to an existing unit (create it first)`);
  }
  if (unit.status !== 'in-progress') {
    throw new Error(`work unit "${into}" is ${unit.status} — items pull into active work only`);
  }

  const result = transactProject(cwd, (manifest) => {
    const roadmap = requireRoadmap(manifest);
    for (const name of names) {
      const item = roadmapItem(roadmap, name);
      const join = itemJoin(item);
      if (join) throw new Error(`"${name}" is already joined to work unit "${join.work_unit}" — nothing was pulled`);
    }
    const touched = new Set();
    for (const name of names) {
      roadmap.items[name].pulled_to = { work_unit: into };
      touched.add(roadmap.items[name].horizon);
    }
    // The remainder: waiting items left in each touched horizon.
    /** @type {Record<string, number>} */
    const remainder = {};
    for (const horizon of touched) {
      remainder[horizon] = Object.values(roadmap.items)
        .filter((it) => it && typeof it === 'object' && it.horizon === horizon && !itemJoin(it)).length;
    }
    return { op: 'pull', into, pulled: [...names], remainder, item_total: Object.keys(roadmap.items).length };
  });
  const what = names.length === 1 ? names[0] : `${names.length} items`;
  return commitRoadmap(cwd, result, `roadmap: pull ${what} into ${into}`);
}

/**
 * Bind a pulled item to the topic it crystallised as — the epic harvest's
 * closing move for a pulled item (the anti-twin rule: an item pulled
 * pre-harvest comes out of the harvest as itself). The topic must exist on
 * the joined unit's discovery map. Re-binding updates the topic (a split or
 * rename at the harvest re-aims the join). Self-commits.
 * @param {string} cwd @param {string} name @param {{topic?: string}} [opts]
 * @returns {RoadmapOpResult}
 */
function bindItem(cwd, name, { topic } = {}) {
  if (typeof topic !== 'string' || topic === '') throw new Error('--topic is required');
  const result = transactProject(cwd, (manifest) => {
    const roadmap = requireRoadmap(manifest);
    const item = roadmapItem(roadmap, name);
    const join = itemJoin(item);
    if (!join) throw new Error(`"${name}" is not joined to a work unit — pull it first`);
    /** @type {any} */
    let unit;
    try {
      unit = loadWorkUnitManifest(cwd, join.work_unit);
    } catch {
      throw new Error(`"${name}" is joined to work unit "${join.work_unit}", which no longer exists — the join is orphaned`);
    }
    const mapItems = (unit.phases && unit.phases.discovery && unit.phases.discovery.items) || {};
    if (!mapItems[topic] || typeof mapItems[topic] !== 'object') {
      throw new Error(`no discovery item "${topic}" on "${join.work_unit}" — bind names a topic the harvest landed`);
    }
    item.pulled_to = { work_unit: join.work_unit, topic };
    return { op: 'bind', name, work_unit: join.work_unit, topic };
  });
  return commitRoadmap(cwd, result, `roadmap: bind ${name} to ${result.work_unit}/${result.topic}`);
}

/**
 * Pull-forward: bring a waiting item into an in-flight epic as a map topic —
 * the mid-epic expansion move (design decision 15, post-harvest form), one
 * confirm in prose, one composed transaction here. Creates the discovery-map
 * item (topic = item name, source `roadmap`, summary carried from the item)
 * via the discovery-map domain's own add (its lock, its gates — the dismissed
 * list included; `forceDismissed` passes the user's confirmed re-add
 * through), then writes the join, then one commit staging both manifests.
 * Map item first, join second: a crash between leaves a visible, repairable
 * topic (pull + bind recovers), never a dangling join.
 * @param {string} cwd @param {string} name
 * @param {{into?: string, routing?: string, forceDismissed?: boolean}} [opts]
 * @returns {RoadmapOpResult}
 */
function pullForwardItem(cwd, name, { into, routing, forceDismissed = false } = {}) {
  if (typeof into !== 'string' || into === '') throw new Error('--into is required');
  if (typeof routing !== 'string' || routing === '') throw new Error('--routing is required');

  // Validate the roadmap side before touching the epic's map.
  const preflight = readProjectManifest(cwd);
  const rm = preflight.roadmap;
  const preItem = rm && typeof rm === 'object' && rm.items && typeof rm.items === 'object' ? rm.items[name] : undefined;
  if (!preItem || typeof preItem !== 'object') throw new Error(`no roadmap item "${name}"`);
  const preJoin = itemJoin(preItem);
  if (preJoin) throw new Error(`"${name}" is already joined to work unit "${preJoin.work_unit}" — pull-forward takes a waiting item`);

  /** @type {any} */
  let unit;
  try {
    unit = loadWorkUnitManifest(cwd, into);
  } catch {
    throw new Error(`no work unit "${into}"`);
  }
  if (unit.work_type !== 'epic') {
    throw new Error(`"${into}" is a ${unit.work_type} — pull-forward lands a topic on an epic's discovery map`);
  }
  if (unit.status !== 'in-progress') {
    throw new Error(`work unit "${into}" is ${unit.status} — items pull into active work only`);
  }

  // The discovery-map domain owns the map write: its lock, its name gates,
  // its dismissed-list discipline.
  const { addItem: addMapItem } = require('./discovery-map.cjs');
  addMapItem(cwd, into, name, {
    routing,
    source: 'roadmap',
    summary: typeof preItem.summary === 'string' ? preItem.summary : '',
    forceDismissed,
  });

  /** @type {RoadmapOpResult} */
  const result = transactProject(cwd, (manifest) => {
    const roadmap = requireRoadmap(manifest);
    const item = roadmapItem(roadmap, name);
    item.pulled_to = { work_unit: into, topic: name };
    return { op: 'pull-forward', name, into, topic: name, routing, state: 'in-flight' };
  });
  /** @type {string[]} */
  const warnings = [];
  const outcome = commitTailPathspec(
    cwd,
    [PROJECT_MANIFEST_SPEC, `.workflows/${into}/manifest.json`],
    `roadmap: pull-forward ${name} into ${into}`,
    warnings,
  );
  result.committed = outcome.committed;
  if (outcome.failed) result.warnings = warnings;
  noteCommitOutcome(result, outcome);
  return result;
}

/**
 * Revert every join into a work unit — the cancel-revert hop's project-side
 * write (design decision 25c): deletes `pulled_to` where it names the unit
 * (and the topic, when given), returning the items to waiting with their
 * `sources`/`origin` intact. Runs under the project lock, **no commit** —
 * the calling transaction (topic cancel, work-unit cancel) stages the
 * project manifest alongside its own write. Returns the reverted names
 * (empty when nothing was joined — a no-op writes nothing).
 * @param {string} cwd @param {string} workUnit @param {{topic?: string}} [opts]
 * @returns {string[]}
 */
function revertJoins(cwd, workUnit, { topic } = {}) {
  return withProjectLock(cwd, () => {
    const manifest = readProjectManifest(cwd);
    const rm = manifest.roadmap;
    if (!rm || typeof rm !== 'object' || Array.isArray(rm) || !rm.items || typeof rm.items !== 'object') {
      return [];
    }
    /** @type {string[]} */
    const reverted = [];
    for (const [name, item] of Object.entries(rm.items)) {
      if (!item || typeof item !== 'object') continue;
      const join = itemJoin(/** @type {Record<string, any>} */ (item));
      if (!join || join.work_unit !== workUnit) continue;
      if (topic !== undefined && join.topic !== topic) continue;
      delete (/** @type {Record<string, any>} */ (item).pulled_to);
      reverted.push(name);
    }
    if (reverted.length > 0) writeProjectManifestAtomic(cwd, manifest);
    return reverted;
  });
}

/**
 * Re-aim every join naming `fromUnit` at `{work_unit: into, topic}` —
 * absorb's hop: an absorbed feature's material continues as an epic topic,
 * so its items' delivery follows it there (the un-pull is cancel's move,
 * never absorb's — the work did not stop, it moved). Runs under the project
 * lock, **no commit** — the calling transaction stages the project manifest
 * alongside its own write. Returns the re-aimed names (empty when nothing
 * was joined — a no-op writes nothing).
 * @param {string} cwd @param {string} fromUnit @param {{into: string, topic: string}} opts
 * @returns {string[]}
 */
function reaimJoins(cwd, fromUnit, { into, topic }) {
  return withProjectLock(cwd, () => {
    const manifest = readProjectManifest(cwd);
    const rm = manifest.roadmap;
    if (!rm || typeof rm !== 'object' || Array.isArray(rm) || !rm.items || typeof rm.items !== 'object') {
      return [];
    }
    /** @type {string[]} */
    const reaimed = [];
    for (const [name, item] of Object.entries(rm.items)) {
      if (!item || typeof item !== 'object') continue;
      const join = itemJoin(/** @type {Record<string, any>} */ (item));
      if (!join || join.work_unit !== fromUnit) continue;
      /** @type {Record<string, any>} */ (item).pulled_to = { work_unit: into, topic };
      reaimed.push(name);
    }
    if (reaimed.length > 0) writeProjectManifestAtomic(cwd, manifest);
    return reaimed;
  });
}

/**
 * Flag the epic side of a join after a product session materially deepened
 * the item's ground (design decision 25b): `reconcile_needed: "roadmap"` on
 * the joined topic's live research/discussion items — `flagDownstream`
 * semantics across the roadmap boundary: terminal items skipped, an
 * existing flag never clobbered, a signal never a rewrite. What counts as
 * "materially deepened" is the calling flow's judgment; this records it.
 * A join with no topic (or no live phase item) flags nothing — the epic
 * reads the record fresh at its harvest. Self-commits (the epic's manifest).
 * @param {string} cwd @param {string} name
 * @returns {RoadmapOpResult}
 */
function flagJoined(cwd, name) {
  const project = readProjectManifest(cwd);
  const rm = project.roadmap;
  const item = rm && typeof rm === 'object' && rm.items && typeof rm.items === 'object' ? rm.items[name] : undefined;
  if (!item || typeof item !== 'object') throw new Error(`no roadmap item "${name}"`);
  const join = itemJoin(item);
  if (!join) throw new Error(`"${name}" is not joined to a work unit — a waiting item needs no flag; its record is read at the pull`);

  /** @type {{phase: string, topic: string}[]} */
  const flagged = [];
  if (join.topic !== undefined) {
    const topic = join.topic;
    withWorkUnitLock(cwd, join.work_unit, () => {
      const manifest = loadWorkUnitManifest(cwd, join.work_unit);
      for (const phase of ['research', 'discussion']) {
        const items = (manifest.phases && manifest.phases[phase] && manifest.phases[phase].items) || {};
        const phaseItem = items[topic];
        if (!phaseItem || typeof phaseItem !== 'object') continue;
        if (TERMINAL_STATUSES.includes(phaseItem.status)) continue;
        if (phaseItem.reconcile_needed !== undefined) continue;
        phaseItem.reconcile_needed = 'roadmap';
        flagged.push({ phase, topic });
      }
      if (flagged.length > 0) saveWorkUnitManifest(cwd, join.work_unit, manifest);
    });
  }

  /** @type {RoadmapOpResult} */
  const result = { op: 'flag', name, work_unit: join.work_unit, flagged };
  if (flagged.length === 0) {
    result.note = 'no live phase item to flag — the epic reads the record fresh at its harvest';
    result.committed = null;
    return result;
  }
  /** @type {string[]} */
  const warnings = [];
  const outcome = commitTailPathspec(cwd, `.workflows/${join.work_unit}/manifest.json`, `roadmap: flag ${name} — input moved`, warnings);
  result.committed = outcome.committed;
  if (outcome.failed) result.warnings = warnings;
  noteCommitOutcome(result, outcome);
  return result;
}

module.exports = {
  roadmapState,
  ensureRoadmap,
  addRoadmapItem,
  addRoadmapItemsBatch,
  editRoadmapItem,
  renameRoadmapItem,
  moveRoadmapItem,
  removeRoadmapItem,
  addHorizon,
  renameHorizon,
  reorderHorizons,
  mergeHorizons,
  splitHorizon,
  removeHorizon,
  pullItems,
  bindItem,
  pullForwardItem,
  revertJoins,
  reaimJoins,
  flagJoined,
};
