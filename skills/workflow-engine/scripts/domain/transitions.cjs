'use strict';

// ---------------------------------------------------------------------------
// Domain ring: topic transitions — start, triage, complete, reopen,
// supersede, cancel, and reactivate, each a single transaction from the
// caller's perspective.
//
// start/complete/reopen/supersede are phase-item lifecycle bookkeeping:
// manifest write plus a knowledge-base sync where the phase is indexed
// (index on complete, remove on supersede; reopen syncs nothing —
// re-completion re-indexes over the same identity). No git commit — the
// calling session's commit cadence picks the manifest change up
// (supersession is batch-oriented: spec completion supersedes several
// sources, then commits once). cancel/reactivate are the epic transactions:
// manifest write, knowledge-base sync, scoped git commit.
//
// The manifest write is the source of truth and lands first; the knowledge
// base is a derived index, so its failures are recorded as warnings, never
// blocks. Validation throws loud and specific before anything is touched.
// Every load→mutate→save runs under the work unit's manifest lock (the same
// lock every manifest writer honours); the KB sync and the commit run after
// release — the lock protects the manifest read-modify-write, nothing else.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { loadWorkUnitManifest, saveWorkUnitManifest, withWorkUnitLock, ensureContainer } = require('../kernel/manifest.cjs');
const { commitTailWithKb, commitTailPathspec, noteCommitOutcome } = require('./commit.cjs');
const { knowledge, INDEXED_ARTIFACTS } = require('./kb.cjs');
const { phaseItems, computeTopicLifecycle, computeNextAction, lifecyclePhrase, awaitedExperiments, experimentWaits, settleItemStatus } = require('./derivations.cjs');
const { revertJoins } = require('./roadmap.cjs');
const { settleFoldedSubtopic } = require('./agent-state.cjs');

// The discovery map's lifecycle is computed from research and discussion
// items alone (`computeTopicLifecycle`), so only those phases can move a map
// row in or out of the live set — and only they may touch its execution
// order. Spec topic names collide with map topic names by construction (an
// independent discussion becomes a grouping of one), so an ungated write
// here strips a still-live topic's position.
const MAP_LIFECYCLE_PHASES = ['research', 'discussion'];

const { VALID_PHASES, VALID_PHASE_STATUSES, WORK_TYPE_PIPELINES, DERIVED_PHASES, TERMINAL_STATUSES, EXPERIMENT_SPAWN_PHASES, EXPERIMENT_TERMINAL_STATUSES } = require('../kernel/manifest-schema.cjs');

// Phase-item lifecycle operates on WORK phases only. Discovery items are map
// items (no lifecycle status — computed at render time); they are created and
// edited by the discovery tooling, never by topic commands.
const LIFECYCLE_PHASES = VALID_PHASES.filter((p) => p !== 'discovery');

// Refuse any status write the field surface would refuse — the two enforcers
// share one schema (kernel/manifest-schema.cjs), so the
// engine can never be the permissive path around a validation refusal.
/** @param {string} phase @param {string} status */
function assertLegalWrite(phase, status) {
  if (!LIFECYCLE_PHASES.includes(phase)) {
    throw new Error(`unknown or non-lifecycle phase "${phase}" (${LIFECYCLE_PHASES.join('|')}) — discovery items are map items; use the discovery tooling`);
  }
  const valid = VALID_PHASE_STATUSES[/** @type {keyof typeof VALID_PHASE_STATUSES} */ (phase)];
  if (!valid || !valid.includes(status)) {
    throw new Error(`Invalid status "${status}" for phase "${phase}". Must be one of: ${(valid || []).join(', ')}`);
  }
}

/**
 * A derived phase has no hand lifecycle — each caller's refusal teaches the
 * verb that does the job instead.
 * @param {string} phase @param {string} message
 */
function assertNotDerived(phase, message) {
  if (DERIVED_PHASES.includes(phase)) {
    throw new Error(message);
  }
}

/**
 * @typedef {object} TopicTransitionResult
 * @property {string} topic
 * @property {string} phase
 * @property {string} status     the topic's status after the transition
 * @property {string|null} committed  short commit sha, or null when nothing was staged
 * @property {string} [note]     set when committed is null
 * @property {string[]} warnings non-blocking failures (knowledge-base sync)
 * @property {string[]} [cascaded]  started spec items cancelled with their source (cancel --cascade)
 * @property {string[]} [discarded] proposed groupings deleted with their source (cancel --cascade)
 * @property {string[]} [roadmap_reverted] roadmap items handed back to waiting by the cancel-revert hop
 * @property {WaitRelease[]} [released_waits] the evidence waits a cancel released — every holder's for an experiment cancel, the cancelled holder's own for a spawner cascade (cancel --cascade)
 * @property {string[]} [abandoned] the open records a cancel closed as abandoned, reason recorded on each row
 */

/**
 * The phase item for `topic`, or a loud error.
 * @param {object} manifest @param {string} phase @param {string} topic
 * @returns {{status?: string, previous_status?: string, superseded_by?: string, order?: number, previous_order?: number, reconcile_needed?: string, sources?: Record<string, {status?: string}>|Array<{name?: string, status?: string}>}}
 */
function phaseItem(manifest, phase, topic) {
  assertLegalWrite(phase, 'cancelled');
  const phases = manifest && manifest.phases;
  const ph = phases && typeof phases === 'object' ? phases[phase] : undefined;
  const items = ph && typeof ph === 'object' ? ph.items : undefined;
  if (!items || typeof items !== 'object') {
    throw new Error(`no ${phase} items in the manifest (phases.${phase}.items)`);
  }
  const item = items[topic];
  if (!item || typeof item !== 'object') {
    throw new Error(`no ${phase} item "${topic}" in the manifest (phases.${phase}.items)`);
  }
  return item;
}

/**
 * @typedef {object} TopicStartResult
 * @property {string} topic
 * @property {string} phase
 * @property {string} status   always `in-progress`
 * @property {boolean} created true when the phase item was created, false when resumed
 */

/**
 * @typedef {object} TopicCompleteResult
 * @property {string} topic
 * @property {string} phase
 * @property {string} status   always `completed`
 * @property {string[]} warnings non-blocking failures (knowledge-base index)
 */

// The map decides which of research/discussion a topic can be born into —
// the same join the epic menu renders its rows from, so the engine is never
// the permissive path around it. The gate is on birth alone: an in-progress
// item resumes regardless (the map already shows that phase live), and a
// parked research stub always drains — research is downstream of nothing,
// and a discussing topic's parked research has no menu row to drain it.
const MAP_PHASE_ACTIONS = {
  research: ['start_research', 'continue_research'],
  discussion: ['start_discussion', 'start_discussion_after_research', 'continue_discussion'],
};

/**
 * @param {object} manifest @param {string} phase @param {string} topic
 * @param {{status?: string}|undefined} existing  the phase's own item, if any
 */
function assertMapAllowsStart(manifest, phase, topic, existing) {
  if (manifest.work_type !== 'epic') return;
  const allowed = MAP_PHASE_ACTIONS[/** @type {keyof typeof MAP_PHASE_ACTIONS} */ (phase)];
  if (!allowed) return;
  if (existing && existing.status === 'in-progress') return;
  if (existing && existing.status === 'triaged' && phase === 'research') return;
  const item = phaseItems(manifest, 'discovery').find((i) => i.name === topic);
  if (!item) return;
  const { lifecycle, research_state } = computeTopicLifecycle(manifest, topic);
  const next = computeNextAction(item.routing, lifecycle);
  if (next && allowed.includes(next)) return;
  throw new Error(
    `${phase} can't start on "${topic}" — ${lifecyclePhrase(lifecycle, research_state, item.routing)}; the epic menu names its next step`,
  );
}

/**
 * Start a phase item: create it with `status: in-progress` when absent
 * (init-phase semantics), or set an existing item back to `in-progress`.
 * A completed item must go through reopen — resuming is not starting — and
 * a cancelled item through reactivate. On an epic the discovery map gates
 * the birth (see assertMapAllowsStart). No git commit.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} phase
 * @param {string} topic
 * @returns {TopicStartResult}
 */
function startTopic(cwd, workUnit, phase, topic) {
  assertLegalWrite(phase, 'in-progress');
  assertNotDerived(phase, 'the experiment item is derived bookkeeping — the spawn creates and reopens it (experiment create), never topic start');
  return withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const phases = ensureContainer(manifest, 'phases', 'phases');
    const ph = ensureContainer(phases, phase, `phases.${phase}`);
    const items = ensureContainer(ph, 'items', `phases.${phase}.items`);

    const existing = items[topic] && typeof items[topic] === 'object' ? items[topic] : undefined;
    if (existing && existing.status === 'completed') {
      throw new Error(`${phase} item "${topic}" is already completed — reopen it instead`);
    } else if (existing && existing.status === 'cancelled') {
      throw new Error(`${phase} item "${topic}" is cancelled — reactivate it instead`);
    } else if (existing && existing.status === 'superseded') {
      const by = 'superseded_by' in existing ? ` (by "${existing.superseded_by}")` : '';
      throw new Error(`${phase} item "${topic}" is superseded${by} — supersession is terminal; work on the absorbing topic instead`);
    } else if (existing && existing.status === 'promoted') {
      const to = 'promoted_to' in existing ? ` (to "${existing.promoted_to}")` : '';
      throw new Error(`${phase} item "${topic}" is promoted${to} — promotion is terminal; continue it from the cross-cutting work unit`);
    }
    assertMapAllowsStart(manifest, phase, topic, existing);

    let created = false;
    if (!existing) {
      items[topic] = { status: 'in-progress' };
      created = true;
    } else {
      existing.status = 'in-progress';
    }

    saveWorkUnitManifest(cwd, workUnit, manifest);
    return { topic, phase, status: 'in-progress', created };
  });
}

/**
 * @typedef {object} TopicTriageResult
 * @property {string} topic
 * @property {string} phase
 * @property {string|null} status  the item's status after the call
 * @property {boolean} created     true when the phase item was created as `triaged`
 * @property {string|null} status_before  the item's status before the call (null when created)
 * @property {boolean} [reopened]  set when a completed item was reopened to receive the concern
 * @property {string} [concern_path]  delivery form: the installed concern file, project-relative
 * @property {boolean} [reconcile_flagged]  delivery form: the landing flagged completed downstream item(s) for reconciliation
 * @property {string[]} [sources_staled]  delivery form: spec items whose source row for this discussion flipped `incorporated` → `stale`
 * @property {string|null} [committed]  delivery form: short commit sha, or null
 * @property {string} [note]       delivery form: set when committed is null
 * @property {string[]} [warnings] delivery form: the tail commit's failure detail
 */

/**
 * A topic name usable in paths: non-empty, no separators, no traversal.
 * Guards every verb that turns a topic into a filesystem location.
 * @param {string} topic
 */
function assertLegalTopicName(topic) {
  if (!topic || /[\\/]/.test(topic) || topic.includes('..')) {
    throw new Error(`invalid topic name "${topic}" — no separators or ".."`);
  }
}

/**
 * The next concern number in a topic's triage sidecar: highest `NNN-` prefix
 * plus one, `1` for a missing or empty directory.
 * @param {string} dirAbs
 * @returns {number}
 */
function nextConcernNumber(dirAbs) {
  /** @type {string[]} */
  let files;
  try {
    files = fs.readdirSync(dirAbs);
  } catch {
    return 1;
  }
  let max = 0;
  for (const f of files) {
    const m = f.match(/^(\d{3})-.+\.md$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

/**
 * A spec item's `sources` as `[name, row]` entries — the one decoder of the
 * map form and the legacy array form. Rows that aren't objects are dropped.
 * @param {object|Array<{name?: string, status?: string}>|undefined} sources
 * @returns {[string, {status?: string}][]}
 */
function sourceRows(sources) {
  if (!sources || typeof sources !== 'object') return [];
  const entries = Array.isArray(sources)
    ? sources.map((r) => /** @type {[string, unknown]} */ ([r && typeof r === 'object' ? r.name || '' : '', r]))
    : Object.entries(sources);
  return /** @type {[string, {status?: string}][]} */ (entries.filter(([, r]) => r && typeof r === 'object'));
}

/**
 * The `topic`-named row of a spec item's `sources`, object or legacy array
 * form, or undefined.
 * @param {object|Array<{name?: string}>|undefined} sources
 * @param {string} topic
 * @returns {{status?: string}|undefined}
 */
function sourceRow(sources, topic) {
  const entry = sourceRows(sources).find(([name]) => name === topic);
  return entry ? entry[1] : undefined;
}

/**
 * @typedef {object} DownstreamFlagResult
 * @property {{phase: string, topic: string}[]} flagged  completed downstream items now carrying `reconcile_needed`
 * @property {string[]} staled  spec items whose `sources.{topic}` row flipped `incorporated` → `stale`
 */

/**
 * Flag `topic`'s downstream neighbours when it goes stale — a reopen or a
 * triage landing, never the later re-completion. One hop only: the downstream
 * phase's own reconciliation earns (or doesn't earn) the next.
 *
 * A source phase's downstream — discussion or investigation — is the reverse
 * join through spec `sources` (a grouped spec's own name may differ from the
 * source's); every other phase flags the same-named item in the work type's
 * next pipeline phase, as does an investigation no spec's sources name (the
 * legacy bugfix shape). The experiment slot is walked past unconditionally —
 * a flag must land where an entry flow can clear it, and the series item
 * has none.
 * Only a `completed` item takes the flag (value = the upstream phase name,
 * consumed and cleared by the entry skills' reconcile advisory; an existing
 * flag is never clobbered). An `incorporated` source row on any non-terminal
 * spec item flips to `stale` regardless of the item's flag state — the
 * persistent record that the extraction predates the revision, cleared only
 * by the spec's own reconciliation.
 *
 * Mutates the loaded manifest; the caller saves under its own lock.
 * @param {object} manifest
 * @param {string} workType
 * @param {string} phase  the phase going stale
 * @param {string} topic
 * @param {{except?: string}} [opts]  spec item to skip in the discussion join — the invoking spec's own extraction is current by construction
 * @returns {DownstreamFlagResult}
 */
function flagDownstream(manifest, workType, phase, topic, opts = {}) {
  /** @type {DownstreamFlagResult} */
  const result = { flagged: [], staled: [] };
  const itemsOf = (p) => {
    const ph = manifest.phases && typeof manifest.phases === 'object' ? manifest.phases[p] : undefined;
    const items = ph && typeof ph === 'object' ? ph.items : undefined;
    return items && typeof items === 'object' ? items : undefined;
  };
  const flag = (p, name, item) => {
    if (item && typeof item === 'object' && item.status === 'completed' && item.reconcile_needed === undefined) {
      item.reconcile_needed = phase;
      result.flagged.push({ phase: p, topic: name });
    }
  };

  if (phase === 'discussion' || phase === 'investigation') {
    let joined = false;
    for (const [name, item] of Object.entries(itemsOf('specification') || {})) {
      if (name === opts.except) continue;
      if (!item || typeof item !== 'object' || TERMINAL_STATUSES.includes(item.status)) continue;
      const row = sourceRow(item.sources, topic);
      if (!row) continue;
      joined = true;
      if (row.status === 'incorporated') {
        row.status = 'stale';
        result.staled.push(name);
      }
      flag('specification', name, item);
    }
    if (phase === 'discussion' || joined) return result;
  }

  const pipeline = WORK_TYPE_PIPELINES[/** @type {keyof typeof WORK_TYPE_PIPELINES} */ (workType)] || [];
  const at = pipeline.indexOf(phase);
  // One hop to the next pipeline phase — walking past a derived slot
  // unconditionally: a reconcile flag must land where an entry flow can
  // clear it, and a derived item has no entry of its own (its only flag
  // edges are the wait release, which flags the holder, and a parent
  // conclusion, which runs this walk from the slot). So a research reopen
  // flags the discussion whatever the series between them holds, and the
  // hop still ends at the first real phase — never past it.
  for (let i = at + 1; at !== -1 && i < pipeline.length; i++) {
    const next = pipeline[i];
    if (DERIVED_PHASES.includes(next)) continue;
    flag(next, topic, (itemsOf(next) || {})[topic]);
    break;
  }
  return result;
}

/**
 * Abandon the non-terminal records in an experiment item's series — the
 * cancel paths' honesty move: the register keeps a row per record, each
 * carrying the cancellation as its reason, so no live record ever survives
 * a cancel that took it. `opts.ids` scopes the sweep to the named top-level
 * records; their sub-experiments ride with them — a wait only ever names the
 * parent form, and a family never outlives its parent. Mutates the item;
 * returns the abandoned ids.
 * @param {{experiments?: Record<string, {status?: string, reason?: string}>}} item
 * @param {string} reason
 * @param {{ids?: string[]}} [opts]  top-level ids; omitted sweeps the whole series
 * @returns {string[]}
 */
function abandonOpenRecords(item, reason, opts = {}) {
  const inScope = (/** @type {string} */ id) => opts.ids === undefined
    || opts.ids.includes(id)
    || opts.ids.some((p) => id.startsWith(`${p}.`));
  /** @type {string[]} */
  const abandoned = [];
  for (const [id, record] of Object.entries(item.experiments || {})) {
    if (!record || typeof record !== 'object' || !inScope(id)) continue;
    if (EXPERIMENT_TERMINAL_STATUSES.includes(/** @type {string} */ (record.status))) continue;
    record.status = 'abandoned';
    record.reason = reason;
    abandoned.push(id);
  }
  return abandoned;
}

/**
 * @typedef {object} WaitRelease
 * @property {string} phase       the holder — the spawning research or discussion
 * @property {string[]} released
 * @property {string[]} remaining
 */

/**
 * Release the evidence waits `topic`'s spawn-phase items hold on the named
 * experiments — the edge every terminal experiment transition rides
 * (conclude, abandon, the epic cancel), so a wait can never dangle. Removes
 * `ids` (or every id) from each holder's `awaiting_experiments`, deletes the
 * emptied field, and flags a non-terminal holder with `reconcile_needed:
 * "experiment"` (an existing flag never clobbered) so its next entry
 * surfaces the evidence — or the abandonment — before the waiting point
 * settles. Mutates the loaded manifest; the caller saves under its own lock.
 * @param {object} manifest @param {string} topic
 * @param {{ids?: string[]}} [opts]  specific ids; omitted releases them all
 * @returns {WaitRelease[]}  the holders that released something; empty when nothing was waiting
 */
function releaseExperimentWaits(manifest, topic, opts = {}) {
  /** @type {WaitRelease[]} */
  const releases = [];
  for (const phase of EXPERIMENT_SPAWN_PHASES) {
    const awaiting = awaitedExperiments(manifest, phase, topic);
    const releasing = opts.ids === undefined ? awaiting : awaiting.filter((id) => /** @type {string[]} */ (opts.ids).includes(id));
    if (releasing.length === 0) continue;
    const item = manifest.phases[phase].items[topic];
    const remaining = awaiting.filter((id) => !releasing.includes(id));
    if (remaining.length === 0) delete item.awaiting_experiments;
    else item.awaiting_experiments = remaining;
    if (!TERMINAL_STATUSES.includes(item.status) && item.reconcile_needed === undefined) {
      item.reconcile_needed = 'experiment';
    }
    releases.push({ phase, released: releasing, remaining });
  }
  return releases;
}

/**
 * Apply the parking semantics to a phase item receiving a concern: create it
 * as `triaged` when absent — a parked concern must never read as started
 * work — heal a status-less item to `triaged`, leave a `triaged` or
 * `in-progress` item untouched, and set a `completed` item back to
 * `in-progress` (a landed concern reopens the conversation; no
 * knowledge-base action — re-completion re-indexes over the same identity).
 * Terminal states refuse with the same messages start uses. Mutates `items`;
 * the caller saves when `dirty`.
 * @param {Record<string, any>} items the phase's items container
 * @param {string} phase
 * @param {string} topic
 * @returns {{status: string, created: boolean, status_before: string|null, reopened?: boolean, dirty: boolean}}
 */
function parkConcernItem(items, phase, topic) {
  const existing = items[topic];
  if (!existing || typeof existing !== 'object') {
    items[topic] = { status: 'triaged' };
    return { status: 'triaged', created: true, status_before: null, dirty: true };
  }
  const before = existing.status ?? null;
  if (before === 'cancelled') {
    throw new Error(`${phase} item "${topic}" is cancelled — reactivate it instead`);
  }
  if (before === 'superseded') {
    const by = 'superseded_by' in existing ? ` (by "${existing.superseded_by}")` : '';
    throw new Error(`${phase} item "${topic}" is superseded${by} — supersession is terminal; work on the absorbing topic instead`);
  }
  if (before === 'promoted') {
    const to = 'promoted_to' in existing ? ` (to "${existing.promoted_to}")` : '';
    throw new Error(`${phase} item "${topic}" is promoted${to} — promotion is terminal; continue it from the cross-cutting work unit`);
  }
  if (before === 'completed') {
    existing.status = 'in-progress';
    return { status: 'in-progress', created: false, status_before: before, reopened: true, dirty: true };
  }
  if (before === null) {
    // A status-less item (partial field writes) has never been started —
    // heal it to triaged, the same way start heals it to in-progress.
    existing.status = 'triaged';
    return { status: 'triaged', created: false, status_before: null, dirty: true };
  }
  return { status: before, created: false, status_before: before, dirty: false };
}

/**
 * Park a rerouted concern on a topic (parking semantics per
 * `parkConcernItem`). Legal only in phases whose schema vocabulary contains
 * `triaged`. No git commit in the bare form — the calling flow commits the
 * artefact append alongside; the delivery form (`--concern`) installs the
 * concern file and commits action-scoped.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} phase
 * @param {string} topic
 * @returns {TopicTriageResult}
 */
function triageTopic(cwd, workUnit, phase, topic, opts = {}) {
  assertLegalWrite(phase, 'triaged');
  const { concernFile, slug, message } = opts;
  const delivering = concernFile !== undefined;

  assertLegalTopicName(topic);

  /** @type {string|null} */
  let concern = null;
  if (delivering) {
    if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
      throw new Error(`--slug must be kebab-case, got "${slug ?? ''}"`);
    }
    if (!message) throw new Error('topic triage --concern requires -m <message>');
    // The scratch is consumed after delivery — confine it to the cache so a
    // mis-passed path can never read (and delete) a live artifact.
    const scratchAbs = path.resolve(cwd, /** @type {string} */ (concernFile));
    const cacheRoot = path.join(cwd, '.workflows', '.cache') + path.sep;
    if (!scratchAbs.startsWith(cacheRoot)) {
      throw new Error(`--concern must point inside .workflows/.cache/ — got "${concernFile}"`);
    }
    try {
      concern = fs.readFileSync(scratchAbs, 'utf8');
    } catch {
      throw new Error(`concern file not found: ${concernFile}`);
    }
    if (concern.trim() === '') throw new Error(`concern file is empty: ${concernFile}`);
  }

  /** @type {TopicTriageResult} */
  const result = withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const phases = ensureContainer(manifest, 'phases', 'phases');
    const ph = ensureContainer(phases, phase, `phases.${phase}`);
    const items = ensureContainer(ph, 'items', `phases.${phase}.items`);

    const park = parkConcernItem(items, phase, topic);
    let dirty = park.dirty;
    /** @type {TopicTriageResult} */
    const base = { topic, phase, status: park.status, created: park.created, status_before: park.status_before };
    if (park.reopened) base.reopened = true;

    if (delivering || base.reopened === true) {
      // A landing reopens the ground the downstream phase stands on — flag it
      // for reconciliation the next time it is entered. Staleness begins at
      // landing, not at the topic's later re-conclusion. The bare form hops
      // only when it reopened a completed item — the same onset reopen has —
      // so no completed→in-progress transition ever skips the hop.
      const fd = flagDownstream(manifest, manifest.work_type, phase, topic);
      if (fd.flagged.length > 0) {
        base.reconcile_flagged = true;
        dirty = true;
      }
      if (fd.staled.length > 0) {
        base.sources_staled = fd.staled;
        dirty = true;
      }
    }

    if (delivering) {
      // Install the concern in the topic's triage sidecar — a fresh
      // engine-numbered file per concern, so concurrent deliveries can
      // never collide or lose an entry.
      const dirRel = `.workflows/${workUnit}/${phase}/.triage/${topic}`;
      const dirAbs = path.join(cwd, dirRel);
      fs.mkdirSync(dirAbs, { recursive: true });
      const n = String(nextConcernNumber(dirAbs)).padStart(3, '0');
      const rel = `${dirRel}/${n}-${slug}.md`;
      const body = /** @type {string} */ (concern);
      fs.writeFileSync(path.join(cwd, rel), body.endsWith('\n') ? body : body + '\n');
      base.concern_path = rel;
    }

    if (dirty) saveWorkUnitManifest(cwd, workUnit, manifest);
    return base;
  });

  if (delivering) {
    try { fs.unlinkSync(path.resolve(cwd, /** @type {string} */ (concernFile))); } catch { /* scratch already gone */ }
    /** @type {string[]} */
    const warnings = [];
    const outcome = commitTailPathspec(
      cwd,
      [`.workflows/${workUnit}/manifest.json`, /** @type {string} */ (result.concern_path)],
      /** @type {string} */ (message),
      warnings,
    );
    result.committed = outcome.committed;
    result.warnings = warnings;
    noteCommitOutcome(result, outcome);
    if (outcome.failed) {
      // `--sweep` on the retry for the same reason the delivery itself never
      // beats: the origin's session is committing into the TARGET topic, and
      // a heartbeat there would manufacture a hold no session is holding.
      result.note = `commit pending — state saved; retry with: engine commit ${workUnit} --topic ${phase}/${topic} --sweep -m "<message>"`;
    }
  }

  return result;
}

/**
 * @typedef {object} TopicQueueResult
 * @property {string} work_unit
 * @property {string} phase
 * @property {string} topic
 * @property {number} count
 * @property {string[]} files  project-relative queue file paths, sorted
 */

/**
 * Read a topic's triage queue: the engine owns the queue layout, so gates
 * and drains ask instead of globbing. Legal only in triage-legal phases;
 * a missing directory is an empty queue.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} phase
 * @param {string} topic
 * @returns {TopicQueueResult}
 */
function queueStatus(cwd, workUnit, phase, topic) {
  if (phase !== 'research' && phase !== 'discussion' && phase !== 'investigation') {
    throw new Error(`triage queues exist for research|discussion|investigation only — got "${phase}"`);
  }
  assertLegalTopicName(topic);
  if (!fs.existsSync(path.join(cwd, '.workflows', workUnit))) {
    throw new Error(`no work unit directory: .workflows/${workUnit}`);
  }
  const dirRel = `.workflows/${workUnit}/${phase}/.triage/${topic}`;
  /** @type {fs.Dirent[]} */
  let entries = [];
  try {
    entries = fs.readdirSync(path.join(cwd, dirRel), { withFileTypes: true });
  } catch { /* no queue yet — empty */ }
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => `${dirRel}/${e.name}`)
    .sort();
  return { work_unit: workUnit, phase, topic, count: files.length, files };
}

/**
 * @typedef {object} TopicAbsorbResult
 * @property {string} phase
 * @property {string} topic
 * @property {string} absorbed  the queue-file basename removed
 * @property {number} remaining  queue files left after the removal
 * @property {boolean} [arming_settled]  discussion only: the fold's ground was settled into the review anchor
 * @property {string} [arming_note]      discussion only: why it wasn't, when it wasn't
 * @property {string|null} [committed]
 * @property {string[]} [warnings]
 * @property {string} [note]
 */

/**
 * Absorb one rerouted concern — the mirror of `triage`'s delivery form:
 * delete its queue file and commit the fold action-scoped (the phase
 * artifact, this deletion, the work-unit manifest) under the caller's
 * message. The response answers `remaining` so the caller routes
 * loop-or-exit with no follow-up read. A discussion absorb names the
 * fold's subtopic and settles it into the review-arming anchor
 * (`settleFoldedSubtopic`): triage folds are settled ground, never map
 * movement, so a sitting that only drained the queue arms no review —
 * tolerant, because wedging the queue's drain would be worse than a
 * missed settle.
 * @param {string} cwd @param {string} workUnit @param {string} phase
 * @param {string} topic @param {{file: string, message: string, subtopic?: string}} opts
 * @returns {TopicAbsorbResult}
 */
function absorbConcern(cwd, workUnit, phase, topic, { file, message, subtopic }) {
  const queue = queueStatus(cwd, workUnit, phase, topic);
  if (file !== path.basename(file) || !file.endsWith('.md')) {
    throw new Error(`topic absorb: --file must be a queue-file name, not a path (got "${file}")`);
  }
  if (phase === 'discussion' && !subtopic) {
    throw new Error('topic absorb: a discussion fold names its ground — pass --subtopic <name> (the subtopic the raise armed) so the fold settles into the review anchor instead of counting as map movement');
  }
  if (phase !== 'discussion' && subtopic !== undefined) {
    throw new Error(`topic absorb: --subtopic settles a discussion fold into the review anchor — not legal in ${phase}`);
  }
  const rel = `.workflows/${workUnit}/${phase}/.triage/${topic}/${file}`;
  if (!queue.files.includes(rel)) {
    throw new Error(`topic absorb: "${file}" is not in the ${topic} ${phase} triage queue`);
  }
  fs.unlinkSync(path.join(cwd, rel));
  /** @type {TopicAbsorbResult} */
  const result = { phase, topic, absorbed: file, remaining: queue.count - 1 };
  if (phase === 'discussion' && subtopic) {
    const settled = settleFoldedSubtopic(cwd, workUnit, topic, subtopic);
    result.arming_settled = settled.settled;
    if (!settled.settled && settled.reason) result.arming_note = settled.reason;
  }
  const artifactRel = `.workflows/${workUnit}/${phase}/${topic}.md`;
  /** @type {string[]} */
  const warnings = [];
  const outcome = commitTailPathspec(
    cwd,
    [
      `.workflows/${workUnit}/manifest.json`,
      rel,
      ...(fs.existsSync(path.join(cwd, artifactRel)) ? [artifactRel] : []),
    ],
    message,
    warnings,
  );
  result.committed = outcome.committed;
  result.warnings = warnings;
  noteCommitOutcome(result, outcome);
  if (outcome.failed) {
    result.note = `commit pending — the concern is absorbed; retry with: engine commit ${workUnit} --topic ${phase}/${topic} -m "<message>"`;
  }
  return result;
}

/**
 * @typedef {object} TopicRequeueResult
 * @property {string} topic
 * @property {string} from_phase
 * @property {string} to_phase
 * @property {string} moved  the queue-file basename moved out of the source queue
 * @property {string} concern_path  the installed destination queue file, project-relative
 * @property {number} remaining  source-queue files left after the move
 * @property {string|null} status  the destination item's status after the call
 * @property {boolean} created     true when the destination item was created as `triaged`
 * @property {string|null} status_before  the destination item's status before the call (null when created)
 * @property {boolean} [reopened]  set when a completed destination item was reopened to receive the concern
 * @property {boolean} [source_item_removed]  the source item was a parked stub this move emptied, and was removed
 * @property {boolean} [reconcile_flagged]  the move flagged completed downstream item(s) for reconciliation
 * @property {string[]} [sources_staled]  spec items whose source row for this topic flipped `incorporated` → `stale`
 * @property {string|null} [committed]  short commit sha, or null
 * @property {string} [note]       set when committed is null
 * @property {string[]} [warnings] the tail commit's failure detail
 */

/**
 * Move one queued concern to the same topic's other phase-side — the repair
 * for a concern parked on the wrong side of the research/discussion pair.
 * One transaction: the destination item takes the parking semantics a triage
 * landing applies (`parkConcernItem` plus the downstream staleness hop), the
 * queue file is renumbered into the destination queue, a `triaged` source
 * item the move leaves with an empty queue is removed (it existed only to
 * park concerns), and the move commits action-scoped under the caller's
 * message. The response answers `remaining` for the source queue so the
 * caller routes loop-or-exit with no follow-up read.
 * @param {string} cwd @param {string} workUnit @param {string} fromPhase
 * @param {string} toPhase @param {string} topic
 * @param {{file: string, message: string}} opts
 * @returns {TopicRequeueResult}
 */
function requeueConcern(cwd, workUnit, fromPhase, toPhase, topic, { file, message }) {
  const pair = ['research', 'discussion'];
  if (!pair.includes(fromPhase) || !pair.includes(toPhase) || fromPhase === toPhase) {
    throw new Error(`topic requeue moves a concern to the same topic's other phase-side — research↔discussion, got "${fromPhase}" → "${toPhase}"`);
  }
  const queue = queueStatus(cwd, workUnit, fromPhase, topic);
  if (file !== path.basename(file) || !file.endsWith('.md')) {
    throw new Error(`topic requeue: --file must be a queue-file name, not a path (got "${file}")`);
  }
  const sourceRel = `.workflows/${workUnit}/${fromPhase}/.triage/${topic}/${file}`;
  if (!queue.files.includes(sourceRel)) {
    throw new Error(`topic requeue: "${file}" is not in the ${topic} ${fromPhase} triage queue`);
  }
  const slug = file.replace(/^\d{3}-/, '').replace(/\.md$/, '');

  /** @type {TopicRequeueResult} */
  const result = withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const phases = ensureContainer(manifest, 'phases', 'phases');
    const ph = ensureContainer(phases, toPhase, `phases.${toPhase}`);
    const items = ensureContainer(ph, 'items', `phases.${toPhase}.items`);

    const park = parkConcernItem(items, toPhase, topic);
    let dirty = park.dirty;
    /** @type {TopicRequeueResult} */
    const base = {
      topic,
      from_phase: fromPhase,
      to_phase: toPhase,
      moved: file,
      concern_path: '',
      remaining: queue.count - 1,
      status: park.status,
      created: park.created,
      status_before: park.status_before,
    };
    if (park.reopened) base.reopened = true;

    // The move is a delivery to the destination — the same staleness hop a
    // triage landing makes there.
    const fd = flagDownstream(manifest, manifest.work_type, toPhase, topic);
    if (fd.flagged.length > 0) {
      base.reconcile_flagged = true;
      dirty = true;
    }
    if (fd.staled.length > 0) {
      base.sources_staled = fd.staled;
      dirty = true;
    }

    if (base.remaining === 0) {
      const srcPh = phases[fromPhase];
      const srcItems = srcPh && typeof srcPh === 'object' ? srcPh.items : undefined;
      const src = srcItems && typeof srcItems === 'object' ? srcItems[topic] : undefined;
      if (src && typeof src === 'object' && src.status === 'triaged') {
        delete srcItems[topic];
        base.source_item_removed = true;
        dirty = true;
      }
    }

    const destDirRel = `.workflows/${workUnit}/${toPhase}/.triage/${topic}`;
    const destDirAbs = path.join(cwd, destDirRel);
    fs.mkdirSync(destDirAbs, { recursive: true });
    const n = String(nextConcernNumber(destDirAbs)).padStart(3, '0');
    const destRel = `${destDirRel}/${n}-${slug}.md`;
    fs.renameSync(path.join(cwd, sourceRel), path.join(cwd, destRel));
    base.concern_path = destRel;

    if (dirty) saveWorkUnitManifest(cwd, workUnit, manifest);
    return base;
  });

  /** @type {string[]} */
  const warnings = [];
  const outcome = commitTailPathspec(
    cwd,
    [`.workflows/${workUnit}/manifest.json`, sourceRel, result.concern_path],
    message,
    warnings,
  );
  result.committed = outcome.committed;
  result.warnings = warnings;
  noteCommitOutcome(result, outcome);
  if (outcome.failed) {
    // `--sweep` keeps the retry as beat-free as the move: requeue is a
    // repair across a topic's two phase-sides, not a session working one.
    result.note = `commit pending — the concern is moved; retry with: engine commit ${workUnit} --topic ${toPhase}/${topic} --sweep -m "<message>"`;
  }
  return result;
}

/**
 * Complete a phase item: set `status: completed` and, when the phase's
 * artifact is knowledge-base indexed, index it (warn-don't-block). The item
 * must exist; a cancelled item must go through reactivate first. No git
 * commit.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} phase
 * @param {string} topic
 * @returns {TopicCompleteResult}
 */
function completeTopic(cwd, workUnit, phase, topic) {
  assertLegalWrite(phase, 'completed');
  assertNotDerived(phase, 'the experiment item is derived bookkeeping — each experiment concludes or is abandoned (experiment conclude/abandon), and the item closes itself when the last record ends');
  withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const item = phaseItem(manifest, phase, topic);
    if (item.status === 'triaged') {
      throw new Error(`${phase} item "${topic}" is triaged — parked concerns have never been worked; start the topic first`);
    }
    if (item.status === 'cancelled') {
      throw new Error(`${phase} item "${topic}" is cancelled — reactivate it instead`);
    }
    if (item.status === 'superseded') {
      const by = 'superseded_by' in item ? ` (by "${item.superseded_by}")` : '';
      throw new Error(`${phase} item "${topic}" is superseded${by} — supersession is terminal; work on the absorbing topic instead`);
    }
    if (item.status === 'promoted') {
      const to = 'promoted_to' in item ? ` (to "${item.promoted_to}")` : '';
      throw new Error(`${phase} item "${topic}" is promoted${to} — promotion is terminal; continue it from the cross-cutting work unit`);
    }
    if (phase === 'specification') {
      const blocking = sourceRows(item.sources)
        .filter(([, r]) => r.status !== 'incorporated')
        .map(([name]) => name);
      if (blocking.length > 0) {
        throw new Error(`specification "${topic}" has unresolved source rows (${blocking.join(', ')}) — extract pending sources and reconcile stale ones before concluding`);
      }
    }
    if (EXPERIMENT_SPAWN_PHASES.includes(phase)) {
      // The evidence wait holds the conclusion shut engine-side — the phase
      // raised a question it needs answered before it can honestly conclude.
      const awaiting = awaitedExperiments(manifest, phase, topic);
      if (awaiting.length > 0) {
        throw new Error(`${phase} "${topic}" awaits experiment evidence (${awaiting.join(', ')}) — the wait releases when the experiment concludes or is abandoned`);
      }
    }
    item.status = 'completed';

    // A completed specification declares real dependencies — exactly the
    // information that sharpens a build order first assigned at grouping.
    // Flag rather than resequence: the epic-entry sequencing step does the
    // work, so there is one place that sequences. Cleared by
    // `build-order sequence`.
    if (phase === 'specification' && manifest.work_type === 'epic') {
      manifest.phases.specification.build_order_stale = true;
    }

    saveWorkUnitManifest(cwd, workUnit, manifest);
  });

  /** @type {string[]} */
  const warnings = [];
  const artifact = INDEXED_ARTIFACTS[/** @type {keyof typeof INDEXED_ARTIFACTS} */ (phase)];
  if (artifact) {
    knowledge(cwd, ['index', artifact(workUnit, topic)], 'knowledge index', warnings);
  }

  return { topic, phase, status: 'completed', warnings };
}

/**
 * @typedef {object} TopicReopenResult
 * @property {string} topic
 * @property {string} phase
 * @property {string} status   always `in-progress`
 * @property {{phase: string, topic: string}[]} [reconcile_flagged]  downstream items this reopen flagged for reconciliation
 * @property {string[]} [sources_staled]  spec items whose source row for this discussion flipped `incorporated` → `stale`
 */

/**
 * Reopen a completed phase item: set `status: in-progress` and flag the
 * topic's downstream neighbours (flagDownstream — staleness begins at the
 * reopen, not the later re-completion). Only a completed item reopens —
 * anything else keeps its own flow (a cancelled item must go through
 * reactivate). No knowledge-base sync — the item's chunks stay live until
 * re-completion re-indexes over the same identity. No git commit.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} phase
 * @param {string} topic
 * @returns {TopicReopenResult}
 */
function reopenTopic(cwd, workUnit, phase, topic) {
  assertLegalWrite(phase, 'in-progress');
  assertNotDerived(phase, 'the experiment item is derived bookkeeping — a new spawn reopens the series (experiment create), never topic reopen');
  return withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const item = phaseItem(manifest, phase, topic);
    if (item.status === 'cancelled') {
      throw new Error(`${phase} item "${topic}" is cancelled — reactivate it instead`);
    }
    if (item.status !== 'completed') {
      throw new Error(`${phase} item "${topic}" is not completed (status: ${item.status ?? 'none'}) — only a completed item can be reopened`);
    }
    item.status = 'in-progress';
    const fd = flagDownstream(manifest, manifest.work_type, phase, topic);

    saveWorkUnitManifest(cwd, workUnit, manifest);
    /** @type {TopicReopenResult} */
    const result = { topic, phase, status: 'in-progress' };
    if (fd.flagged.length > 0) result.reconcile_flagged = fd.flagged;
    if (fd.staled.length > 0) result.sources_staled = fd.staled;
    return result;
  });
}

/**
 * @typedef {object} StaleSourcesResult
 * @property {string} discussion
 * @property {{phase: string, topic: string}[]} flagged  completed specs now carrying `reconcile_needed`
 * @property {string[]} staled  spec items whose source row for the discussion flipped `incorporated` → `stale`
 */

/**
 * Mark every spec extraction of a discussion stale after its document moved
 * without a lifecycle transition — the spec-side resolution flow's safety
 * valve: a decision repaired in place during specification construction runs
 * the same reverse join a reopen would, minus the reopen. `--except` names
 * the invoking spec, whose own extraction of the resolution is current by
 * construction. The discussion item's status is untouched. No git commit —
 * the calling flow commits the doc edit alongside.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} discussion
 * @param {{except?: string}} [opts]
 * @returns {StaleSourcesResult}
 */
function staleSources(cwd, workUnit, discussion, opts = {}) {
  return withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const itemsOf = (/** @type {string} */ p) => {
      const ph = manifest.phases && typeof manifest.phases === 'object' ? manifest.phases[p] : undefined;
      const items = ph && typeof ph === 'object' ? ph.items : undefined;
      return items && typeof items === 'object' ? items : undefined;
    };
    const discussions = itemsOf('discussion');
    if (!discussions || !(discussion in discussions)) {
      throw new Error(`discussion item "${discussion}" not found in work unit "${workUnit}"`);
    }
    // A mistyped --except would silently stale the invoking spec's own row —
    // the exact self-inflicted state the flag exists to prevent. Loud beats
    // silent: the named spec must exist.
    if (opts.except !== undefined && !((itemsOf('specification') || {})[opts.except])) {
      throw new Error(`--except "${opts.except}" names no specification item in work unit "${workUnit}"`);
    }
    const fd = flagDownstream(manifest, manifest.work_type, 'discussion', discussion, { except: opts.except });
    saveWorkUnitManifest(cwd, workUnit, manifest);
    return { discussion, flagged: fd.flagged, staled: fd.staled };
  });
}

/**
 * @typedef {object} TopicSupersedeResult
 * @property {string} topic
 * @property {string} phase
 * @property {string} status   always `superseded`
 * @property {string} superseded_by  the topic that absorbed this one
 * @property {string[]} warnings non-blocking failures (knowledge-base removal)
 */

/**
 * Supersede a phase item: set `status: superseded` and `superseded_by` to the
 * absorbing topic, then remove the item's knowledge-base chunks
 * (warn-don't-block). Legal only in phases whose shared-schema status
 * vocabulary contains `superseded` — schema-driven, never a hardcoded phase
 * list. The absorbing topic must already exist in the same phase (every
 * supersession runs after the superseding item completed). A proposed item is
 * refused — it has no artifact; reconcile deletes it instead — and a
 * cancelled item must go through reactivate. An item holding live evidence
 * waits refuses: a superseded holder is terminal, and the lock would strand
 * with live records and no consumer. No git commit — supersession is
 * batch-oriented; the calling flow commits the whole set.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} phase
 * @param {string} topic
 * @param {{by: string}} opts  the absorbing topic
 * @returns {TopicSupersedeResult}
 */
function supersedeTopic(cwd, workUnit, phase, topic, { by }) {
  assertLegalWrite(phase, 'superseded');
  withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const item = phaseItem(manifest, phase, topic);
    if (topic === by) {
      throw new Error(`${phase} item "${topic}" cannot supersede itself`);
    }
    if (item.status === 'superseded') {
      const already = 'superseded_by' in item ? ` (by "${item.superseded_by}")` : '';
      throw new Error(`${phase} item "${topic}" is already superseded${already}`);
    }
    if (item.status === 'proposed') {
      throw new Error(`${phase} item "${topic}" is proposed — a proposed item has no artifact to supersede; reconcile removes it instead`);
    }
    if (item.status === 'triaged') {
      throw new Error(`${phase} item "${topic}" is triaged — parked concerns have never been worked; start the topic to drain them first`);
    }
    if (item.status === 'cancelled') {
      throw new Error(`${phase} item "${topic}" is cancelled — reactivate it instead`);
    }
    if (item.status === 'promoted') {
      const to = 'promoted_to' in item ? ` (to "${item.promoted_to}")` : '';
      throw new Error(`${phase} item "${topic}" is promoted${to} — promotion is terminal; continue it from the cross-cutting work unit`);
    }
    // A superseded holder is terminal — its evidence waits would strand with
    // live records and no consumer.
    const awaiting = awaitedExperiments(manifest, phase, topic);
    if (awaiting.length > 0) {
      throw new Error(`${phase} item "${topic}" holds live evidence waits (${awaiting.join(', ')}) — a superseded holder would strand those experiments with no consumer; conclude or abandon them first`);
    }
    const items = manifest.phases[phase].items;
    if (!items[by] || typeof items[by] !== 'object') {
      throw new Error(`no ${phase} item "${by}" to supersede toward — the absorbing item must exist first`);
    }
    if (items[by].status === 'triaged') {
      throw new Error(`${phase} item "${by}" is triaged — a stub of parked concerns cannot absorb other topics; start it first`);
    }
    item.status = 'superseded';
    item.superseded_by = by;

    saveWorkUnitManifest(cwd, workUnit, manifest);
  });

  /** @type {string[]} */
  const warnings = [];
  knowledge(cwd, ['remove', '--work-unit', workUnit, '--phase', phase, '--topic', topic], 'knowledge remove', warnings);

  return { topic, phase, status: 'superseded', superseded_by: by, warnings };
}

/**
 * Cancel an epic topic: stash the current status into `previous_status`, set
 * `status: cancelled`, drop the topic's discovery-map `order`, remove its
 * knowledge-base chunks (warn-don't-block), commit the manifest write.
 *
 * Cancelling a discussion a live specification sources collapses that spec:
 * the bare cancel refuses, naming the affected spec item(s); `cascade: true`
 * cancels the discussion and those spec items in one transaction.
 *
 * Cancelling a topic's experiments while a spawning conversation awaits
 * their evidence releases the wait — softer than the spec cascade, nothing
 * collapses: the bare cancel refuses naming the waiting item(s); `cascade:
 * true` cancels the experiments and releases the waits in one transaction
 * (each waiting point reverts to open, the release surfaced at that
 * conversation's next entry).
 *
 * Cancelling a research or discussion holding live evidence waits is the
 * mirror, scoped to the cancelled item's own `awaiting_experiments`: the
 * bare cancel refuses naming those ids; `cascade: true` abandons exactly
 * those records and closes this conversation's waits — the experiment item
 * is never cancelled (its derived status settles over what remains), and a
 * sibling conversation's experiments are untouched.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} phase
 * @param {string} topic
 * @param {{cascade?: boolean}} [opts]
 * @returns {TopicTransitionResult}
 */
function cancelTopic(cwd, workUnit, phase, topic, opts = {}) {
  /** @type {string[]} */
  const cascaded = [];
  /** @type {string[]} */
  const discarded = [];
  /** @type {WaitRelease[]} */
  let releasedWaits = [];
  /** @type {string[]} */
  let abandoned = [];
  withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const item = phaseItem(manifest, phase, topic);
    if (item.status === 'cancelled') {
      throw new Error(`${phase} item "${topic}" is already cancelled`);
    }

    if (phase === 'experiment') {
      const holders = experimentWaits(manifest, topic);
      if (holders.length > 0 && !opts.cascade) {
        const held = holders.map((h) => `its ${h.phase} awaits ${h.ids.join(', ')}`).join('; ');
        throw new Error(`cancelling the "${topic}" experiments releases the evidence wait — ${held} — confirm the release (--cascade cancels the experiments and releases the waits; each waiting point reverts to open)`);
      }
      // The register stays honest: every open record ends abandoned with the
      // cancellation as its reason, so no zombie survives under the
      // cancelled item and a later spawn revives a fully terminal series.
      abandoned = abandonOpenRecords(/** @type {{experiments?: Record<string, {status?: string, reason?: string}>}} */ (item), 'series cancelled');
      releasedWaits = releaseExperimentWaits(manifest, topic);
    }

    // The one-consumer principle is per-record: cancelling the conversation
    // orphans only the experiments IT spawned. Bare refuses naming its own
    // waits; the cascade abandons exactly those records and closes this
    // conversation's waiting points — a sibling conversation's experiments
    // are untouched, and the item's derived status settles over what
    // remains.
    if (EXPERIMENT_SPAWN_PHASES.includes(phase)) {
      const awaiting = awaitedExperiments(manifest, phase, topic);
      if (awaiting.length > 0) {
        if (!opts.cascade) {
          throw new Error(`cancelling ${phase} "${topic}" strands its evidence waits (${awaiting.join(', ')}) — the conversation is those experiments' only consumer; confirm the cascade (--cascade abandons exactly those records and closes this conversation's waits; a sibling conversation's experiments are untouched)`);
        }
        const expItems = (manifest.phases && manifest.phases.experiment && manifest.phases.experiment.items) || {};
        const expItem = expItems[topic];
        if (expItem && typeof expItem === 'object' && expItem.status !== 'cancelled') {
          abandoned = abandonOpenRecords(expItem, 'spawning conversation cancelled', { ids: awaiting });
          settleItemStatus(expItem);
        }
        // Each id is held by exactly one conversation (the spawn locks the
        // spawning item alone), so releasing this item's own ids can touch
        // no sibling holder. The release's flag stays: the cancelled holder
        // carries it inertly (terminal items keep flags, never cued), and
        // reactivation restores it live — the reopened conversation's next
        // entry then surfaces its abandoned records.
        releasedWaits = releaseExperimentWaits(manifest, topic, { ids: awaiting });
      }
    }

    if (phase === 'discussion' || phase === 'investigation') {
      const specItems = (manifest.phases && manifest.phases.specification && manifest.phases.specification.items) || {};
      const sourcing = Object.entries(specItems).filter(([, s]) =>
        s && typeof s === 'object' && !TERMINAL_STATUSES.includes(s.status) && s.status !== 'cancelled'
        && sourceRow(s.sources, topic) !== undefined);
      if (sourcing.length > 0 && !opts.cascade) {
        throw new Error(`cancelling ${phase} "${topic}" collapses the specification(s) sourcing it: ${sourcing.map(([n]) => n).join(', ')} — confirm the cascade (--cascade cancels them together)`);
      }
      const specItemsMap = (manifest.phases && manifest.phases.specification && manifest.phases.specification.items) || {};
      for (const [name, spec] of sourcing) {
        if (spec.status === 'proposed') {
          // A proposed grouping is a regenerable suggestion — discard it
          // outright; a cancelled stub would collide with the next
          // analysis's anchoring.
          delete specItemsMap[name];
          discarded.push(name);
          continue;
        }
        spec.previous_status = spec.status;
        spec.status = 'cancelled';
        if ('order' in spec) {
          spec.previous_order = spec.order;
          delete spec.order;
        }
        cascaded.push(name);
      }
    }

    item.previous_status = item.status;
    item.status = 'cancelled';

    // The build order lives on specification items the way the map's order
    // lives on discovery items — a cancelled spec leaves the live set, so
    // its number is stashed for the reactivate round-trip, never dropped.
    if (phase === 'specification' && 'order' in item) {
      item.previous_order = item.order;
      delete item.order;
    }

    if (MAP_LIFECYCLE_PHASES.includes(phase)) {
      const discovery = manifest.phases && manifest.phases.discovery;
      const mapItem = discovery && discovery.items ? discovery.items[topic] : undefined;
      if (mapItem && typeof mapItem === 'object' && 'order' in mapItem) {
        // Stash rather than drop — reactivate restores the execution position,
        // so a cancel/reactivate round-trip never forces a re-sequence.
        mapItem.previous_order = mapItem.order;
        delete mapItem.order;
      }
    }

    saveWorkUnitManifest(cwd, workUnit, manifest);
  });

  /** @type {string[]} */
  const warnings = [];
  // Only the indexed phases have chunks to remove — the artifact table is
  // the one home for which those are.
  if (INDEXED_ARTIFACTS[/** @type {keyof typeof INDEXED_ARTIFACTS} */ (phase)]) {
    knowledge(cwd, ['remove', '--work-unit', workUnit, '--phase', phase, '--topic', topic], 'knowledge remove', warnings);
  }
  for (const name of cascaded) {
    knowledge(cwd, ['remove', '--work-unit', workUnit, '--phase', 'specification', '--topic', name], 'knowledge remove', warnings);
  }

  // The cancel-revert hop: a topic whose cancellation leaves its map
  // lifecycle cancelled hands any roadmap item joined to it back to
  // waiting (sources/origin intact) — the un-pull path. The project
  // manifest rides this transaction's commit when a revert landed.
  const lifecycleAfter = computeTopicLifecycle(loadWorkUnitManifest(cwd, workUnit), topic).lifecycle;
  const reverted = lifecycleAfter === 'cancelled' ? revertJoins(cwd, workUnit, { topic }) : [];

  // A cancel writes the work-unit manifest (and the project manifest when a
  // roadmap join reverted) and nothing else on disk — it runs from the epic
  // menu, beside sessions holding the unit's other topics.
  const cancelSpec = reverted.length > 0
    ? [`.workflows/${workUnit}/manifest.json`, '.workflows/manifest.json']
    : `.workflows/${workUnit}/manifest.json`;
  const outcome = commitTailWithKb(cwd, cancelSpec, `workflow(${workUnit}): cancel ${topic} (${phase})`, warnings);
  /** @type {TopicTransitionResult} */
  const result = { topic, phase, status: 'cancelled', committed: outcome.committed, warnings };
  if (cascaded.length > 0) result.cascaded = cascaded;
  if (discarded.length > 0) result.discarded = discarded;
  if (reverted.length > 0) result.roadmap_reverted = reverted;
  if (releasedWaits.length > 0) result.released_waits = releasedWaits;
  if (abandoned.length > 0) result.abandoned = abandoned;
  // `--sweep`, because the cancel runs from the epic menu: the session doing
  // it is not the session in the topic. A revert widened the commit past the
  // topic scope, so that retry stays generic.
  noteCommitOutcome(result, outcome, reverted.length > 0 ? undefined : `${workUnit} --topic ${phase}/${topic} --sweep`);
  return result;
}

/**
 * Reactivate a cancelled epic topic: restore `previous_status` to `status`,
 * delete the stash, re-index the artifact when the restored status is
 * `completed` in an indexed phase (warn-don't-block), commit the manifest
 * write.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} phase
 * @param {string} topic
 * @returns {TopicTransitionResult}
 */
function reactivateTopic(cwd, workUnit, phase, topic) {
  // Post-cancel every record is terminal by construction, so the next spawn
  // from the conversation is what revives the item.
  assertNotDerived(phase, `the experiment series is never reactivated — "${topic}"'s rows stand on the register, and a new spawn from its conversation (experiment create --from) revives the series; a concluded conversation is reopened first (topic reopen)`);
  const restored = withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const item = phaseItem(manifest, phase, topic);
    if (item.status !== 'cancelled') {
      throw new Error(`${phase} item "${topic}" is not cancelled (status: ${item.status ?? 'none'})`);
    }
    const previous = item.previous_status;
    if (!previous) {
      throw new Error(`${phase} item "${topic}" has no previous_status to restore`);
    }
    assertLegalWrite(phase, previous);
    item.status = previous;
    delete item.previous_status;

    if (phase === 'specification' && 'previous_order' in item) {
      // Restore only when the stashed number is still free — the live set
      // renumbers contiguously while an item is cancelled, so a blind
      // restore can seat two topics on one number (the collision the map's
      // reactivate can still produce). A taken number drops the stash and
      // leaves the item unordered; `build_order_needs_sequencing` flips and
      // the next sequencing pass seats it wholesale.
      // Terminal siblings keep inert numbers (supersede and promote never
      // stash) — only a LIVE holder of the number blocks the restore.
      const specItems = (manifest.phases.specification && manifest.phases.specification.items) || {};
      const taken = Object.entries(specItems).some(([name, other]) =>
        name !== topic && other && typeof other === 'object'
        && !TERMINAL_STATUSES.includes(other.status || '')
        && other.order === item.previous_order);
      if (!taken) item.order = item.previous_order;
      delete item.previous_order;
    }

    if (MAP_LIFECYCLE_PHASES.includes(phase)) {
      const discovery = manifest.phases && manifest.phases.discovery;
      const mapItem = discovery && discovery.items ? discovery.items[topic] : undefined;
      if (mapItem && typeof mapItem === 'object' && 'previous_order' in mapItem) {
        mapItem.order = mapItem.previous_order;
        delete mapItem.previous_order;
      }
    }

    saveWorkUnitManifest(cwd, workUnit, manifest);
    return previous;
  });

  /** @type {string[]} */
  const warnings = [];
  const artifact = INDEXED_ARTIFACTS[/** @type {keyof typeof INDEXED_ARTIFACTS} */ (phase)];
  if (restored === 'completed' && artifact) {
    knowledge(cwd, ['index', artifact(workUnit, topic)], 'knowledge index', warnings);
  }

  const outcome = commitTailWithKb(cwd, `.workflows/${workUnit}/manifest.json`, `workflow(${workUnit}): reactivate ${topic} (${phase})`, warnings);
  /** @type {TopicTransitionResult} */
  const result = { topic, phase, status: restored, committed: outcome.committed, warnings };
  // From the epic menu, like the cancel it undoes — the retry beats nothing.
  noteCommitOutcome(result, outcome, `${workUnit} --topic ${phase}/${topic} --sweep`);
  return result;
}

module.exports = { startTopic, triageTopic, queueStatus, absorbConcern, requeueConcern, completeTopic, reopenTopic, staleSources, supersedeTopic, cancelTopic, reactivateTopic, sourceRows, flagDownstream, releaseExperimentWaits, assertLegalTopicName };
