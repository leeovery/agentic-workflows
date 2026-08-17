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
const { computeTopicLifecycle } = require('./derivations.cjs');
const { revertJoins } = require('./roadmap.cjs');

const { VALID_PHASES, VALID_PHASE_STATUSES, WORK_TYPE_PIPELINES, TERMINAL_STATUSES } = require('../kernel/manifest-schema.cjs');

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
 */

/**
 * The phase item for `topic`, or a loud error.
 * @param {object} manifest @param {string} phase @param {string} topic
 * @returns {{status?: string, previous_status?: string, superseded_by?: string, sources?: Record<string, {status?: string}>|Array<{name?: string, status?: string}>}}
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

/**
 * Start a phase item: create it with `status: in-progress` when absent
 * (init-phase semantics), or set an existing item back to `in-progress`.
 * A completed item must go through reopen — resuming is not starting — and
 * a cancelled item through reactivate. No git commit.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} phase
 * @param {string} topic
 * @returns {TopicStartResult}
 */
function startTopic(cwd, workUnit, phase, topic) {
  assertLegalWrite(phase, 'in-progress');
  return withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const phases = ensureContainer(manifest, 'phases', 'phases');
    const ph = ensureContainer(phases, phase, `phases.${phase}`);
    const items = ensureContainer(ph, 'items', `phases.${phase}.items`);

    const existing = items[topic];
    let created = false;
    if (!existing || typeof existing !== 'object') {
      items[topic] = { status: 'in-progress' };
      created = true;
    } else if (existing.status === 'completed') {
      throw new Error(`${phase} item "${topic}" is already completed — reopen it instead`);
    } else if (existing.status === 'cancelled') {
      throw new Error(`${phase} item "${topic}" is cancelled — reactivate it instead`);
    } else if (existing.status === 'superseded') {
      const by = 'superseded_by' in existing ? ` (by "${existing.superseded_by}")` : '';
      throw new Error(`${phase} item "${topic}" is superseded${by} — supersession is terminal; work on the absorbing topic instead`);
    } else if (existing.status === 'promoted') {
      const to = 'promoted_to' in existing ? ` (to "${existing.promoted_to}")` : '';
      throw new Error(`${phase} item "${topic}" is promoted${to} — promotion is terminal; continue it from the cross-cutting work unit`);
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
 * legacy bugfix shape).
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
  const next = at === -1 ? undefined : pipeline[at + 1];
  if (next) flag(next, topic, (itemsOf(next) || {})[topic]);
  return result;
}

/**
 * Park a rerouted concern on a topic: create the phase item as `triaged` when
 * absent — a parked concern must never read as started work — leave a
 * `triaged` or `in-progress` item untouched, and set a `completed` item back
 * to `in-progress` (a landed concern reopens the conversation; no
 * knowledge-base action — re-completion re-indexes over the same identity).
 * Terminal states refuse with the same messages start uses. Legal only in
 * phases whose schema vocabulary contains `triaged`. No git commit — the
 * calling flow commits the artefact append alongside.
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

    /** @type {TopicTriageResult} */
    let base;
    let dirty = true;
    const existing = items[topic];
    if (!existing || typeof existing !== 'object') {
      items[topic] = { status: 'triaged' };
      base = { topic, phase, status: 'triaged', created: true, status_before: null };
    } else {
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
        base = { topic, phase, status: 'in-progress', created: false, status_before: before, reopened: true };
      } else if (before === null) {
        // A status-less item (partial field writes) has never been started —
        // heal it to triaged, the same way start heals it to in-progress.
        existing.status = 'triaged';
        base = { topic, phase, status: 'triaged', created: false, status_before: null };
      } else {
        base = { topic, phase, status: before, created: false, status_before: before };
        dirty = false;
      }
    }

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
      result.note = `commit pending — state saved; retry with: engine commit ${workUnit} --topic ${phase}/${topic} -m "<message>"`;
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
 * @property {string|null} [committed]
 * @property {string[]} [warnings]
 * @property {string} [note]
 */

/**
 * Absorb one rerouted concern — the mirror of `triage`'s delivery form:
 * delete its queue file and commit the fold action-scoped (the phase
 * artifact, this deletion, the work-unit manifest) under the caller's
 * message. The response answers `remaining` so the caller routes
 * loop-or-exit with no follow-up read.
 * @param {string} cwd @param {string} workUnit @param {string} phase
 * @param {string} topic @param {{file: string, message: string}} opts
 * @returns {TopicAbsorbResult}
 */
function absorbConcern(cwd, workUnit, phase, topic, { file, message }) {
  const queue = queueStatus(cwd, workUnit, phase, topic);
  if (file !== path.basename(file) || !file.endsWith('.md')) {
    throw new Error(`topic absorb: --file must be a queue-file name, not a path (got "${file}")`);
  }
  const rel = `.workflows/${workUnit}/${phase}/.triage/${topic}/${file}`;
  if (!queue.files.includes(rel)) {
    throw new Error(`topic absorb: "${file}" is not in the ${topic} ${phase} triage queue`);
  }
  fs.unlinkSync(path.join(cwd, rel));
  /** @type {TopicAbsorbResult} */
  const result = { phase, topic, absorbed: file, remaining: queue.count - 1 };
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
    item.status = 'completed';

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
 * cancelled item must go through reactivate. No git commit — supersession is
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
 * knowledge-base chunks (warn-don't-block), commit scoped to the work unit.
 *
 * Cancelling a discussion a live specification sources collapses that spec:
 * the bare cancel refuses, naming the affected spec item(s); `cascade: true`
 * cancels the discussion and those spec items in one transaction.
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
  withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const item = phaseItem(manifest, phase, topic);
    if (item.status === 'cancelled') {
      throw new Error(`${phase} item "${topic}" is already cancelled`);
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
        cascaded.push(name);
      }
    }

    item.previous_status = item.status;
    item.status = 'cancelled';

    const discovery = manifest.phases && manifest.phases.discovery;
    const mapItem = discovery && discovery.items ? discovery.items[topic] : undefined;
    if (mapItem && typeof mapItem === 'object' && 'order' in mapItem) {
      // Stash rather than drop — reactivate restores the execution position,
      // so a cancel/reactivate round-trip never forces a re-sequence.
      mapItem.previous_order = mapItem.order;
      delete mapItem.order;
    }

    saveWorkUnitManifest(cwd, workUnit, manifest);
  });

  /** @type {string[]} */
  const warnings = [];
  knowledge(cwd, ['remove', '--work-unit', workUnit, '--phase', phase, '--topic', topic], 'knowledge remove', warnings);
  for (const name of cascaded) {
    knowledge(cwd, ['remove', '--work-unit', workUnit, '--phase', 'specification', '--topic', name], 'knowledge remove', warnings);
  }

  // The cancel-revert hop: a topic whose cancellation leaves its map
  // lifecycle cancelled hands any roadmap item joined to it back to
  // waiting (sources/origin intact) — the un-pull path. The project
  // manifest rides this transaction's commit when a revert landed.
  const lifecycleAfter = computeTopicLifecycle(loadWorkUnitManifest(cwd, workUnit), topic).lifecycle;
  const reverted = lifecycleAfter === 'cancelled' ? revertJoins(cwd, workUnit, { topic }) : [];

  const cancelSpec = reverted.length > 0
    ? [`.workflows/${workUnit}`, '.workflows/manifest.json']
    : `.workflows/${workUnit}`;
  const outcome = commitTailWithKb(cwd, cancelSpec, `workflow(${workUnit}): cancel ${topic} (${phase})`, warnings);
  /** @type {TopicTransitionResult} */
  const result = { topic, phase, status: 'cancelled', committed: outcome.committed, warnings };
  if (cascaded.length > 0) result.cascaded = cascaded;
  if (discarded.length > 0) result.discarded = discarded;
  if (reverted.length > 0) result.roadmap_reverted = reverted;
  noteCommitOutcome(result, outcome);
  return result;
}

/**
 * Reactivate a cancelled epic topic: restore `previous_status` to `status`,
 * delete the stash, re-index the artifact when the restored status is
 * `completed` in an indexed phase (warn-don't-block), commit scoped to the
 * work unit.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} phase
 * @param {string} topic
 * @returns {TopicTransitionResult}
 */
function reactivateTopic(cwd, workUnit, phase, topic) {
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

    const discovery = manifest.phases && manifest.phases.discovery;
    const mapItem = discovery && discovery.items ? discovery.items[topic] : undefined;
    if (mapItem && typeof mapItem === 'object' && 'previous_order' in mapItem) {
      mapItem.order = mapItem.previous_order;
      delete mapItem.previous_order;
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

  const outcome = commitTailWithKb(cwd, `.workflows/${workUnit}`, `workflow(${workUnit}): reactivate ${topic} (${phase})`, warnings);
  /** @type {TopicTransitionResult} */
  const result = { topic, phase, status: restored, committed: outcome.committed, warnings };
  noteCommitOutcome(result, outcome);
  return result;
}

module.exports = { startTopic, triageTopic, queueStatus, absorbConcern, completeTopic, reopenTopic, staleSources, supersedeTopic, cancelTopic, reactivateTopic, sourceRows };
