'use strict';

// ---------------------------------------------------------------------------
// Domain ring: topic transitions — start, complete, reopen, supersede,
// cancel, and reactivate, each a single transaction from the caller's
// perspective — and the parking a message's landing applies to the topic it
// reaches (mail.cjs).
//
// start/complete/reopen/supersede are phase-item lifecycle bookkeeping:
// manifest write plus a knowledge-base sync where the phase is indexed
// (index on complete, remove on supersede; reopen syncs nothing —
// re-completion re-indexes over the same identity). No git commit — the
// calling session's commit cadence picks the manifest change up
// (supersession is batch-oriented: spec completion supersedes several
// sources, then commits once). cancel/reactivate are the epic transactions,
// topic-level over one unit per stage: manifest write, knowledge-base sync,
// scoped git commit.
//
// The manifest write is the source of truth and lands first; the knowledge
// base is a derived index, so its failures are recorded as warnings, never
// blocks. Validation throws loud and specific before anything is touched.
// Every load→mutate→save runs under the work unit's manifest lock (the same
// lock every manifest writer honours); the KB sync and the commit run after
// release — the lock protects the manifest read-modify-write, nothing else.
// ---------------------------------------------------------------------------

const fs = require('fs');
const { loadWorkUnitManifest, saveWorkUnitManifest, withWorkUnitLock, readProjectManifest, ensureContainer } = require('../kernel/manifest.cjs');
const { commitStateTail, noteCommitOutcome, PROJECT_MANIFEST_SPEC } = require('./commit.cjs');
const { syncKnowledge } = require('./knowledge/sync.cjs');
const { INDEXED_ARTIFACTS } = require('./knowledge/artifacts.cjs');
const {
  phaseItems, itemOf, computeTopicLifecycle, computeNextAction, CONVERSATION_ACTIONS, CLOSED_LIFECYCLES,
  OUTSTANDING_RESEARCH_STATUSES, outstandingResearch, outstandingResearchPhrase, lifecyclePhrase,
  awaitedExperiments, waits, settleItemStatus,
  sourceRows, sourceRow, openSources, specUnsettled, specUnsettledPhrase, UNIT_PHASES, unitItems, discoveryUnitExists, unitLocks, lockingSpecsPhrase, promotedRefusal, deliveryStarted,
  specIncorporations, cancelPlan, postponePlan, proposedGroupings, specReactivateLocks, reactivateLockPhrases,
} = require('./derivations.cjs');
const { buildOrderLive } = require('./build-order.cjs');
const { titlecase } = require('./conventions.cjs');
const { revertJoins, postponeToRoadmap } = require('./roadmap.cjs');
const { clearOwnQuietly } = require('./presence.cjs');
const { statePath } = require('../kernel/state-root.cjs');

const { VALID_PHASES, VALID_PHASE_STATUSES, WORK_TYPE_PIPELINES, DERIVED_PHASES, TERMINAL_STATUSES, EXPERIMENT_SPAWN_PHASES } = require('../kernel/manifest-schema.cjs');

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
 * The refusal every hand transition makes over a postponed item: the topic
 * left the epic whole and the pull is the one way back.
 * @param {string} phase @param {string} topic
 */
function postponedRefusal(phase, topic) {
  return `${phase} item "${topic}" is postponed — the topic waits on the roadmap; pull it forward from there instead`;
}

/**
 * @typedef {object} CancelledItem
 * @property {string} phase
 * @property {string} previous_status  the status the item held before the cancel
 */

/**
 * @typedef {object} TopicCancelResult
 * @property {string} topic
 * @property {'discovery'|'specification'} phase  the unit's stage
 * @property {'cancelled'} status
 * @property {CancelledItem[]} cancelled  the phase items the cancel took
 * @property {string[]} discarded  proposed groupings deleted with their source — always empty for a specification unit
 * @property {string[]} abandoned  the open records closed as abandoned, reason recorded on each row — always empty for a specification unit
 * @property {WaitRelease[]} released_waits  the evidence waits the topic's conversations held — always empty for a specification unit
 * @property {string[]} [roadmap_reverted] discovery unit: roadmap items handed back to waiting by the cancel-revert hop
 * @property {string|null} committed  short commit sha, or null when nothing was staged
 * @property {string} [note]     set when committed is null
 * @property {string[]} warnings non-blocking failures (knowledge-base sync)
 */

/**
 * @typedef {object} RestoredItem
 * @property {string} phase
 * @property {string|null} status  the status the item returned to — null when it returned to never-attempted
 */

/**
 * @typedef {object} TopicReactivateResult
 * @property {string} topic
 * @property {'discovery'|'specification'} phase  the unit's stage
 * @property {'reactivated'} status
 * @property {RestoredItem[]} restored  the phase items the reactivate restored — empty for a never-started topic
 * @property {string[]} discarded  specification unit: proposed groupings over its returning sources, deleted — always empty for a discovery unit
 * @property {string|null} committed  short commit sha, or null when nothing was staged
 * @property {string} [note]     set when committed is null
 * @property {string[]} warnings non-blocking failures (knowledge-base sync)
 */

/**
 * The phase item for `topic`, or a loud error.
 * @param {object} manifest @param {string} phase @param {string} topic
 * @returns {{status?: string, previous_status?: string, superseded_by?: string, promoted_to?: string, order?: number, previous_order?: number, reconcile_needed?: string|boolean, sources?: Record<string, {status?: string}>|Array<{name?: string, status?: string}>}}
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

// Research feeds discussion: while the same-named research is outstanding —
// in flight, or parked as a stub — the discussion is held shut at its birth
// (absent or parked) and at its reopen, for every work type; the menu's
// research row is the way in. A discussion already in session resumes: the
// entry gate is its door, and the conclusion refusal (completeTopic's waits)
// is the backstop for research a peer session parks beneath it mid-session.

/**
 * @param {object} manifest @param {string} phase @param {string} topic
 * @param {'start'|'reopen'} verb  the refused move
 */
function assertResearchLanded(manifest, phase, topic, verb) {
  if (phase !== 'discussion') return;
  const status = outstandingResearch(manifest, topic);
  if (!status) return;
  throw new Error(
    `discussion can't ${verb} on "${topic}" — ${outstandingResearchPhrase(status)}; research feeds discussion, so it lands first — the menu names the way in`,
  );
}

// A plan is built from a settled record: while the same-named specification
// is unsettled — not concluded, its input moved, or a source row no longer
// incorporated — the plan is held shut at its birth and its reopen, for
// every work type. A plan already in session resumes: the entry gate is its
// door, and the conclusion refusal (completeTopic's waits) is the backstop
// for a specification a peer unsettles mid-session.

/**
 * @param {object} manifest @param {string} phase @param {string} topic
 * @param {'start'|'reopen'} verb  the refused move
 */
function assertSpecSettled(manifest, phase, topic, verb) {
  if (phase !== 'planning') return;
  const unsettled = specUnsettled(manifest, topic);
  if (!unsettled) return;
  throw new Error(
    `planning can't ${verb} on "${topic}" — its specification is unsettled (${specUnsettledPhrase(unsettled)}); a plan is built from a settled record, so the specification's entry is the way in`,
  );
}

// The map decides which of research/discussion a topic can be born into —
// the same join the epic menu renders its rows from, so the engine is never
// the permissive path around it. The gate is on birth alone: an in-progress
// item resumes regardless (the map already shows that phase live), and
// outstanding research always starts — research feeds discussion, so it is
// the way in first.

/**
 * @param {object} manifest @param {string} phase @param {string} topic
 * @param {{status?: string}|undefined} existing  the phase's own item, if any
 */
function assertMapAllowsStart(manifest, phase, topic, existing) {
  if (manifest.work_type !== 'epic') return;
  const allowed = CONVERSATION_ACTIONS[/** @type {keyof typeof CONVERSATION_ACTIONS} */ (phase)];
  if (!allowed) return;
  if (existing && existing.status === 'in-progress') return;
  if (phase === 'research' && existing && OUTSTANDING_RESEARCH_STATUSES.includes(existing.status ?? '')) return;
  const item = phaseItems(manifest, 'discovery').find((i) => i.name === topic);
  if (!item) return;
  const { lifecycle, research_state } = computeTopicLifecycle(manifest, topic);
  const next = computeNextAction(item.routing, lifecycle, research_state);
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
 * the birth (see assertMapAllowsStart). A proposed grouping's start records
 * the started specifications it incorporates (specIncorporations). No git
 * commit.
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
    } else if (existing && existing.status === 'postponed') {
      throw new Error(postponedRefusal(phase, topic));
    } else if (existing && existing.status === 'superseded') {
      const by = 'superseded_by' in existing ? ` (by "${existing.superseded_by}")` : '';
      throw new Error(`${phase} item "${topic}" is superseded${by} — supersession is terminal; work on the absorbing topic instead`);
    } else if (existing && existing.status === 'promoted') {
      throw new Error(promotedRefusal(phase, topic, existing));
    }
    if (!existing || existing.status === 'unstarted') {
      assertResearchLanded(manifest, phase, topic, 'start');
      assertSpecSettled(manifest, phase, topic, 'start');
    }
    assertMapAllowsStart(manifest, phase, topic, existing);

    let created = false;
    if (!existing) {
      items[topic] = { status: 'in-progress' };
      created = true;
    } else {
      const incorporates = existing.status === 'proposed' ? specIncorporations(manifest, topic) : [];
      if (incorporates.length > 0) existing.incorporates = incorporates;
      existing.status = 'in-progress';
    }

    saveWorkUnitManifest(cwd, workUnit, manifest);
    return { topic, phase, status: 'in-progress', created };
  });
}

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
 * @typedef {object} DownstreamFlagResult
 * @property {{phase: string, topic: string}[]} flagged  downstream items now carrying `reconcile_needed`
 * @property {string[]} staled  spec items whose `sources.{topic}` row flipped `incorporated` → `stale`
 */

/**
 * Flag `topic`'s downstream neighbours when it goes stale — a reopen or a
 * message landing, never the later re-completion. One hop only: the downstream
 * phase's own reconciliation earns (or doesn't earn) the next.
 *
 * A source phase's downstream — discussion or investigation — is the reverse
 * join through spec `sources` (a grouped spec's own name may differ from the
 * source's); every other phase flags the same-named item in the work type's
 * next pipeline phase, as does an investigation no spec's sources name (the
 * legacy bugfix shape). The experiment slot is walked past unconditionally —
 * a flag must land where a phase's start can clear it, and the series item
 * has none.
 * A `completed` item takes the flag (value = the upstream phase name,
 * consumed and cleared by the reconcile advisory — where the phase starts,
 * or inside a research/discussion session at its next check; an existing flag
 * is never clobbered) — and on the hop out of research so does an
 * in-progress discussion: research feeds discussion, and a discussion in
 * flight is the one that could otherwise conclude over research still to
 * land (the wait derivation holds its conclusion shut while it is
 * outstanding; once landed, the flag holds it until the session reads it).
 * Terminal items never take one. An `incorporated` source row on any non-terminal
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
  const takesFlag = phase === 'research' ? ['in-progress', 'completed'] : ['completed'];
  const flag = (p, name, item) => {
    if (item && typeof item === 'object' && takesFlag.includes(item.status) && item.reconcile_needed === undefined) {
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
  // unconditionally: a reconcile flag must land where a phase's start can
  // clear it, and a derived item has no start of its own (its only flag
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
 * "experiment"` (an existing flag never clobbered) so its next entry — or
 * its session's next check — surfaces the evidence, or the abandonment,
 * before the waiting point settles; the holder's completion refuses over
 * the unread flag. Mutates the loaded manifest; the caller saves under its
 * own lock.
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
 * Apply the parking semantics to a phase item receiving a message: create it
 * as `unstarted` when absent — a parked message must never read as started
 * work — heal a status-less item to `unstarted`, leave an `unstarted` or
 * `in-progress` item untouched, and set a `completed` item back to
 * `in-progress` (a landed message reopens the conversation; no
 * knowledge-base action — re-completion re-indexes over the same identity).
 * A cancelled item refuses as start refuses it; a promoted one never reaches
 * here, refused with its topic first (topic-standing.cjs), and a phase a
 * message waits in has no superseding. Mutates `items`; the caller saves
 * when `dirty`.
 * @param {Record<string, any>} items the phase's items container
 * @param {string} phase
 * @param {string} topic
 * @returns {{status: string, created: boolean, status_before: string|null, reopened?: boolean, dirty: boolean}}
 */
function parkMessageItem(items, phase, topic) {
  const existing = items[topic];
  if (!existing || typeof existing !== 'object') {
    items[topic] = { status: 'unstarted' };
    return { status: 'unstarted', created: true, status_before: null, dirty: true };
  }
  const before = existing.status ?? null;
  if (before === 'cancelled') {
    throw new Error(`${phase} item "${topic}" is cancelled — reactivate it instead`);
  }
  if (before === 'completed') {
    existing.status = 'in-progress';
    return { status: 'in-progress', created: false, status_before: before, reopened: true, dirty: true };
  }
  if (before === null) {
    // A status-less item (partial field writes) has never been started —
    // heal it to unstarted, the same way start heals it to in-progress.
    existing.status = 'unstarted';
    return { status: 'unstarted', created: false, status_before: null, dirty: true };
  }
  return { status: before, created: false, status_before: before, dirty: false };
}

// The reconcile values a conversation must read in session before it
// concludes — its upstream landed beneath it: the topic's research landed
// (`research`, set by the hop out of research), or an evidence wait
// released (`experiment`, set by the release). The brief flag (`true`) and
// the roadmap flag stay entry-time advisories, and every other phase's flag
// is the phase start's alone.
/** @type {Record<string, string>} */
const LANDED_UPSTREAM = {
  research: 'the topic\'s research landed beneath this conversation',
  experiment: 'an experiment wait released beneath this conversation — evidence, or an abandonment',
};

/**
 * The completion refusal's clauses — one per wait kind present, in the
 * derivation's order.
 * @param {import('./derivations.cjs').Wait[]} blocking
 * @returns {string[]}
 */
function waitClauses(blocking) {
  const clauses = [];
  if (blocking.some((w) => w.kind === 'research')) {
    clauses.push('awaits research on the topic — conclude the research to release the wait');
  }
  const spec = blocking.find((w) => w.kind === 'specification');
  if (spec) {
    clauses.push(`awaits its specification (${specUnsettledPhrase(spec)}) — settle the specification to release the wait`);
  }
  const ids = blocking.flatMap((w) => (w.kind === 'experiment' ? [w.id] : []));
  if (ids.length > 0) {
    clauses.push(`awaits experiment evidence (${ids.join(', ')}) — the wait releases when the experiment concludes or is abandoned`);
  }
  return clauses;
}

/**
 * Complete a phase item: set `status: completed` and, when the phase's
 * artifact is knowledge-base indexed, index it (warn-don't-block). The item
 * must exist; a cancelled item must go through reactivate first; an item
 * holding a live wait — evidence it awaits, a discussion's outstanding
 * research, a plan's unsettled specification — refuses naming every wait;
 * a research or discussion item carrying a landed-upstream flag
 * (`reconcile_needed: research|experiment`) refuses until the session reads
 * what landed and clears it. No git commit.
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
    if (item.status === 'unstarted') {
      throw new Error(`${phase} item "${topic}" is unstarted — its messages have never been worked; start the topic first`);
    }
    if (item.status === 'cancelled') {
      throw new Error(`${phase} item "${topic}" is cancelled — reactivate it instead`);
    }
    if (item.status === 'postponed') {
      throw new Error(postponedRefusal(phase, topic));
    }
    if (item.status === 'superseded') {
      const by = 'superseded_by' in item ? ` (by "${item.superseded_by}")` : '';
      throw new Error(`${phase} item "${topic}" is superseded${by} — supersession is terminal; work on the absorbing topic instead`);
    }
    if (item.status === 'promoted') {
      throw new Error(promotedRefusal(phase, topic, item));
    }
    if (phase === 'specification') {
      const blocking = openSources(item).map((r) => r.name);
      if (blocking.length > 0) {
        throw new Error(`specification "${topic}" has unresolved source rows (${blocking.join(', ')}) — extract pending sources and reconcile stale ones before concluding`);
      }
    }
    // A wait holds the conclusion shut engine-side — the phase raised a
    // question it needs answered, or stands on research still to land.
    const blocking = waits(manifest, phase, topic);
    if (blocking.length > 0) {
      throw new Error(`${phase} "${topic}" ${waitClauses(blocking).join('; and ')}`);
    }
    // A landed upstream the conversation has not read holds it shut too —
    // the flag is cleared by the session's own read (the reconcile
    // advisory), never by the completion.
    const landed = EXPERIMENT_SPAWN_PHASES.includes(phase) && typeof item.reconcile_needed === 'string'
      ? LANDED_UPSTREAM[item.reconcile_needed]
      : undefined;
    if (landed) {
      throw new Error(`${phase} "${topic}" carries reconcile_needed: ${item.reconcile_needed} — ${landed}; read what landed into the session and clear the flag before concluding`);
    }
    item.status = 'completed';

    // A completed specification declares real dependencies — exactly the
    // information that sharpens a build order first assigned at grouping.
    // Flag rather than resequence: the epic menu's sequencing step does the
    // work, so there is one place that sequences. Cleared by
    // `build-order sequence`.
    if (phase === 'specification' && manifest.work_type === 'epic') {
      manifest.phases.specification.build_order_stale = true;
    }

    saveWorkUnitManifest(cwd, workUnit, manifest);
  });

  /** @type {string[]} */
  const warnings = [];
  const artifact = INDEXED_ARTIFACTS[phase];
  if (artifact) syncKnowledge(cwd, [{ index: artifact(workUnit, topic) }], warnings);

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
    if (item.status === 'postponed') {
      throw new Error(postponedRefusal(phase, topic));
    }
    if (item.status === 'promoted') {
      throw new Error(promotedRefusal(phase, topic, item));
    }
    if (item.status !== 'completed') {
      throw new Error(`${phase} item "${topic}" is not completed (status: ${item.status ?? 'none'}) — only a completed item can be reopened`);
    }
    assertResearchLanded(manifest, phase, topic, 'reopen');
    assertSpecSettled(manifest, phase, topic, 'reopen');
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
    if (item.status === 'unstarted') {
      throw new Error(`${phase} item "${topic}" is unstarted — its messages have never been worked; start the topic to drain them first`);
    }
    if (item.status === 'cancelled') {
      throw new Error(`${phase} item "${topic}" is cancelled — reactivate it instead`);
    }
    if (item.status === 'postponed') {
      throw new Error(postponedRefusal(phase, topic));
    }
    if (item.status === 'promoted') {
      throw new Error(promotedRefusal(phase, topic, item));
    }
    const items = manifest.phases[phase].items;
    if (!items[by] || typeof items[by] !== 'object') {
      throw new Error(`no ${phase} item "${by}" to supersede toward — the absorbing item must exist first`);
    }
    if (items[by].status === 'unstarted') {
      throw new Error(`${phase} item "${by}" is unstarted — a stub holding messages cannot absorb other topics; start it first`);
    }
    item.status = 'superseded';
    item.superseded_by = by;

    saveWorkUnitManifest(cwd, workUnit, manifest);
  });

  /** @type {string[]} */
  const warnings = [];
  syncKnowledge(cwd, [{ remove: { workUnit, phase, topic } }], warnings);

  return { topic, phase, status: 'superseded', superseded_by: by, warnings };
}

// ---------------------------------------------------------------------------
// cancel / reactivate — topic-level, one unit per stage. The Discovery unit
// is the map row with everything under its name: research, discussion, and
// the experiment series. The Definition unit is the specification with its
// plan. A later stage locks the earlier — a started specification holds its
// source topics, code under a specification's name holds the specification
// — and a cancel never rolls through a stage boundary: the refusal names
// what to cancel first. Delivery never cancels; the work-unit cancel
// abandons the epic.
// ---------------------------------------------------------------------------

const UNIT_STAGES = Object.keys(UNIT_PHASES);

/** @typedef {Pick<TopicCancelResult, 'cancelled'|'discarded'|'abandoned'|'released_waits'>} UnitCancel */
/** @typedef {Pick<TopicReactivateResult, 'restored'|'discarded'>} UnitReactivate */

/**
 * The stage a unit verb's phase argument names, or a loud refusal — there is
 * no phase-level cancel.
 * @param {'cancel'|'reactivate'} verb @param {string} phase
 * @returns {'discovery'|'specification'}
 */
function assertUnitStage(verb, phase) {
  if (!UNIT_STAGES.includes(phase)) {
    throw new Error(`${verb} is topic-level per stage — discovery (the map row with its research, discussion, and experiments) or specification (with its planning)`);
  }
  return /** @type {'discovery'|'specification'} */ (phase);
}

/**
 * Stash a live `order` for the reactivate round-trip — the map's execution
 * order and the build order alike leave the live set with their item and
 * come back with it, so a cancel/reactivate never forces a re-sequence.
 * @param {{order?: number|null, previous_order?: number}} item
 */
function stashOrder(item) {
  if (item.order == null) return;
  item.previous_order = item.order;
  delete item.order;
}

/**
 * Return a stashed `order` unless a live sibling took the number meanwhile
 * — the live set renumbers contiguously while an item is out, so a blind
 * restore can seat two topics on one number. The stash drops either way; a
 * taken number leaves the item unordered and the sequencing flag flips.
 * @param {{order?: number|null, previous_order?: number}} item
 * @param {(order: number) => boolean} taken  whether a live sibling holds the number
 */
function restoreOrder(item, taken) {
  if (!('previous_order' in item)) return;
  if (item.previous_order != null && !taken(item.previous_order)) item.order = item.previous_order;
  delete item.previous_order;
}

/**
 * Whether a live map row other than `except` holds execution order `n`.
 * Closed rows (cancelled, dead-ended) carry no order and never block.
 * @param {object} manifest @param {string} except @param {number} n
 */
function liveMapRowHolds(manifest, except, n) {
  return phaseItems(manifest, 'discovery').some((row) => row.name !== except && row.order === n
    && !CLOSED_LIFECYCLES.includes(computeTopicLifecycle(manifest, row.name).lifecycle));
}

/**
 * Whether a live specification other than `except` holds build order `n`.
 * Terminal siblings keep inert numbers (supersede and promote never stash)
 * and never block.
 * @param {object} manifest @param {string} except @param {number} n
 */
function liveSpecHolds(manifest, except, n) {
  return phaseItems(manifest, 'specification').some((item) => item.name !== except && item.order === n && buildOrderLive(item));
}

/**
 * Put a unit's live items into a hold — `cancelled` or `postponed` — each
 * status stashed for the return.
 * @param {import('./derivations.cjs').CancelPlan['items']} items
 * @param {'cancelled'|'postponed'} hold
 * @returns {CancelledItem[]}
 */
function stashItems(items, hold) {
  return items.map(({ phase, item }) => {
    item.previous_status = item.status;
    item.status = hold;
    return { phase, previous_status: item.previous_status };
  });
}

/**
 * Restore a unit's held items. A stash returns the status it holds; an item
 * held with none — the per-item cancel of a status-less item stashed nothing
 * — returns to never-attempted, its status deleted.
 * @param {{phase: string, item: Record<string, any>}[]} items
 * @param {'cancelled'|'postponed'} hold
 * @returns {RestoredItem[]}
 */
function restoreItems(items, hold) {
  /** @type {RestoredItem[]} */
  const restored = [];
  for (const { phase, item } of items) {
    if (item.status !== hold) continue;
    if (item.previous_status) {
      assertLegalWrite(phase, item.previous_status);
      item.status = item.previous_status;
      delete item.previous_status;
      restored.push({ phase, status: item.status });
    } else {
      delete item.status;
      restored.push({ phase, status: null });
    }
  }
  return restored;
}

/**
 * Abandon the plan's records — the register keeps a row per record, each
 * carrying the cancellation as its reason, so no live record survives the
 * cancel that took it.
 * @param {Record<string, any>} series
 * @param {string[]} ids @param {string} reason
 */
function abandonRecords(series, ids, reason) {
  for (const id of ids) {
    series.experiments[id].status = 'abandoned';
    series.experiments[id].reason = reason;
  }
}

/**
 * Delete the proposed groupings a unit verb discards — a regenerable
 * suggestion, never stashed: a cancelled stub would collide with the next
 * analysis's anchoring.
 * @param {object} manifest @param {string[]} names
 */
function discardGroupings(manifest, names) {
  for (const name of names) delete manifest.phases.specification.items[name];
}

/**
 * Drop the knowledge-base chunks of the items a hold took — the indexed
 * phases alone, the artifact table being the one home for which those are.
 * A held topic's conclusions are off the board, and retrieval must not
 * surface them; the return re-indexes.
 * @param {string} cwd @param {string} workUnit @param {string} topic
 * @param {{phase: string}[]} held @param {string[]} warnings
 */
function removeHeldChunks(cwd, workUnit, topic, held, warnings) {
  syncKnowledge(cwd, held.filter(({ phase }) => INDEXED_ARTIFACTS[phase])
    .map(({ phase }) => ({ remove: { workUnit, phase, topic } })), warnings);
}

/**
 * Re-index each restored `completed` artifact — the removal's mirror.
 * @param {string} cwd @param {string} workUnit @param {string} topic
 * @param {RestoredItem[]} restored @param {string[]} warnings
 */
function indexRestored(cwd, workUnit, topic, restored, warnings) {
  syncKnowledge(cwd, restored.filter(({ phase, status }) => status === 'completed' && INDEXED_ARTIFACTS[phase])
    .map(({ phase }) => ({ index: INDEXED_ARTIFACTS[phase](workUnit, topic) })), warnings);
}

/** @param {object} manifest @param {string} topic */
function assertDiscoveryUnit(manifest, topic) {
  if (!discoveryUnitExists(manifest, topic)) {
    throw new Error(`no topic "${topic}" — nothing on the map and no research or discussion item of that name`);
  }
}

/**
 * The Discovery unit's cancel. Waits release first, so the evidence flag
 * lands on the holders while they are still non-terminal and rides inertly
 * until a reactivate brings it back live; the map row's marker is what the
 * lifecycle reads, so a never-started topic needs nothing else.
 * Mutates the loaded manifest.
 * @param {object} manifest @param {string} topic
 * @returns {UnitCancel}
 */
function cancelDiscoveryUnit(manifest, topic) {
  assertDiscoveryUnit(manifest, topic);
  const { lifecycle } = computeTopicLifecycle(manifest, topic);
  if (lifecycle === 'cancelled') {
    throw new Error(`"${topic}" is already cancelled`);
  }
  if (lifecycle === 'postponed') {
    throw new Error(`"${topic}" is postponed — the roadmap owns it; remove its item there to cancel it, or pull it forward first`);
  }
  const locking = unitLocks(manifest, topic);
  if (locking.length > 0) {
    const recovery = locking.some((lock) => lock.promoted_to !== null)
      ? 'promotion is terminal, so the topic continues in its cross-cutting unit'
      : `cancel ${locking.length === 1 ? 'the specification' : 'them'} first`;
    throw new Error(`cancelling "${topic}" is refused while ${lockingSpecsPhrase(locking)} — ${recovery}`);
  }
  const plan = cancelPlan(manifest, 'discovery', topic);
  const mapItem = itemOf(manifest, 'discovery', topic);
  if (plan.items.length === 0 && !mapItem) {
    throw new Error(`"${topic}" has nothing to cancel — no live item under its name and no map row`);
  }

  const released_waits = releaseExperimentWaits(manifest, topic);
  const series = itemOf(manifest, 'experiment', topic);
  if (series) {
    abandonRecords(series, plan.records, 'topic cancelled');
    settleItemStatus(series);
  }
  const cancelled = stashItems(plan.items, 'cancelled');
  discardGroupings(manifest, plan.discards);
  if (mapItem) {
    mapItem.cancelled = true;
    stashOrder(mapItem);
  }
  return { cancelled, discarded: plan.discards, abandoned: plan.records, released_waits };
}

/**
 * The Definition unit's cancel: the specification and its same-named plan.
 * Source discussions are untouched — they read as unaccounted again, free
 * for the next grouping analysis or for a cancel of their own.
 * Mutates the loaded manifest.
 * @param {object} manifest @param {string} spec
 * @returns {UnitCancel}
 */
function cancelSpecificationUnit(manifest, spec) {
  const item = phaseItem(manifest, 'specification', spec);
  if (item.status === 'proposed') {
    throw new Error('a proposed grouping is not started — cancel its source topic to discard it, or let the grouping walk regroup');
  }
  if (item.status === 'cancelled') {
    throw new Error(`"${spec}" is already cancelled`);
  }
  if (TERMINAL_STATUSES.includes(item.status || '')) {
    throw new Error(`"${spec}" is ${item.status} — a terminal specification has nothing to cancel`);
  }
  if (deliveryStarted(manifest, spec)) {
    throw new Error(`"${spec}" is locked — implementation has started; code in the tree is fixed forward, and the work-unit cancel abandons the epic`);
  }
  const plan = cancelPlan(manifest, 'specification', spec);
  if (plan.items.length === 0) {
    throw new Error(`specification "${spec}" has nothing to cancel — it carries no status`);
  }
  const cancelled = stashItems(plan.items, 'cancelled');
  stashOrder(item);
  return { cancelled, discarded: [], abandoned: [], released_waits: [] };
}

/**
 * Cancel a topic — the Discovery unit (`discovery`) or the Definition unit
 * (`specification`) under the name — in one locked write, then remove the
 * cancelled artifacts' knowledge-base chunks (warn-don't-block), release the
 * calling session's own heartbeat on each item taken, run the roadmap's
 * cancel-revert hop for a Discovery unit, and commit the manifest write.
 * Any other phase is refused: there is no phase-level cancel.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} phase  `discovery` | `specification`
 * @param {string} topic
 * @returns {TopicCancelResult}
 */
function cancelTopic(cwd, workUnit, phase, topic) {
  const stage = assertUnitStage('cancel', phase);
  const taken = withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const outcome = stage === 'discovery'
      ? cancelDiscoveryUnit(manifest, topic)
      : cancelSpecificationUnit(manifest, topic);
    saveWorkUnitManifest(cwd, workUnit, manifest);
    return outcome;
  });

  /** @type {string[]} */
  const warnings = [];
  removeHeldChunks(cwd, workUnit, topic, taken.cancelled, warnings);

  for (const { phase: p } of taken.cancelled) clearOwnQuietly(cwd, workUnit, p, topic);

  // The cancel-revert hop: a topic whose cancellation leaves its map
  // lifecycle cancelled hands any roadmap item joined to it back to
  // waiting (sources/origin intact) — the un-pull path. The project
  // manifest rides this transaction's commit when a revert landed.
  const reverted = stage === 'discovery'
    && computeTopicLifecycle(loadWorkUnitManifest(cwd, workUnit), topic).lifecycle === 'cancelled'
    ? revertJoins(cwd, workUnit, { topic })
    : [];

  // A cancel writes the work-unit manifest (and the project manifest when a
  // roadmap join reverted) and nothing else on disk — it runs from the epic
  // menu, beside sessions holding the unit's other topics.
  const cancelSpec = reverted.length > 0
    ? [`${workUnit}/manifest.json`, PROJECT_MANIFEST_SPEC]
    : `${workUnit}/manifest.json`;
  const outcome = commitStateTail(cwd, cancelSpec, `workflow(${workUnit}): cancel ${topic} (${stage})`, warnings);
  /** @type {TopicCancelResult} */
  const result = { topic, phase: stage, status: 'cancelled', ...taken, committed: outcome.committed, warnings };
  if (stage === 'discovery') result.roadmap_reverted = reverted;
  // The manifest alone is narrower than any state scope, so the retry stays
  // generic — the commit door's own rule.
  noteCommitOutcome(result, outcome);
  return result;
}

/**
 * Take a Discovery unit out of a hold — the shared body of the cancel's
 * reactivate and the roadmap pull's return: the map row's marker cleared,
 * every item carrying a stash restored, and the map order returned unless a
 * live row took the number. The marker's field name is the hold's own, so
 * one read serves both. Mutates the loaded manifest.
 * @param {object} manifest @param {string} topic @param {'cancelled'|'postponed'} hold
 * @returns {RestoredItem[]}
 */
function restoreDiscoveryUnit(manifest, topic, hold) {
  const restored = restoreItems(unitItems(manifest, 'discovery', topic), hold);
  const mapItem = itemOf(manifest, 'discovery', topic);
  if (mapItem) {
    delete mapItem[hold];
    restoreOrder(mapItem, (n) => liveMapRowHolds(manifest, topic, n));
  }
  return restored;
}

/**
 * The Discovery unit's reactivate: clear the marker, restore every item
 * carrying a stash, and return the map order unless a live row took the
 * number. Mutates the loaded manifest.
 * @param {object} manifest @param {string} topic
 * @returns {UnitReactivate}
 */
function reactivateDiscoveryUnit(manifest, topic) {
  assertDiscoveryUnit(manifest, topic);
  const { lifecycle } = computeTopicLifecycle(manifest, topic);
  if (lifecycle === 'postponed') {
    throw new Error(`"${topic}" is postponed, not cancelled — pull it forward from the roadmap instead`);
  }
  if (lifecycle !== 'cancelled') {
    throw new Error(`"${topic}" is not cancelled (lifecycle: ${lifecycle})`);
  }
  const restored = restoreDiscoveryUnit(manifest, topic, 'cancelled');
  // A unit still reading cancelled after the restore would round-trip
  // through the reactivate menu forever; refuse instead, and nothing is saved.
  if (computeTopicLifecycle(manifest, topic).lifecycle === 'cancelled') {
    throw new Error(`"${topic}" still reads cancelled after the restore — nothing was written`);
  }
  return { restored, discarded: [] };
}

/**
 * The Definition unit's reactivate: the specification and its same-named
 * cancelled plan, the build order returned unless a live topic took the
 * number. Refused while a source is unavailable — its topic cancelled, or
 * another started specification holding it. A proposed grouping over a
 * returning source is discarded: the source is accounted for again.
 * Mutates the loaded manifest.
 * @param {object} manifest @param {string} spec
 * @returns {UnitReactivate}
 */
function reactivateSpecificationUnit(manifest, spec) {
  const item = phaseItem(manifest, 'specification', spec);
  if (item.status !== 'cancelled') {
    throw new Error(`specification "${spec}" is not cancelled (status: ${item.status ?? 'none'})`);
  }
  const locks = specReactivateLocks(manifest, spec);
  if (locks.length > 0) {
    const { holds, recovery } = reactivateLockPhrases(locks, (n) => n);
    throw new Error(`reactivating "${spec}" is refused while ${holds} — ${recovery}`);
  }
  const discarded = [...new Set(sourceRows(item.sources).flatMap(([topic]) => proposedGroupings(manifest, topic)))];
  discardGroupings(manifest, discarded);
  const restored = restoreItems(unitItems(manifest, 'specification', spec), 'cancelled');
  restoreOrder(item, (n) => liveSpecHolds(manifest, spec, n));
  return { restored, discarded };
}

/**
 * Reactivate a cancelled topic — the unit the cancel took — in one locked
 * write, re-index each restored `completed` artifact (warn-don't-block),
 * and commit the manifest write. No roadmap re-join: the revert is one-way.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} phase  `discovery` | `specification`
 * @param {string} topic
 * @returns {TopicReactivateResult}
 */
function reactivateTopic(cwd, workUnit, phase, topic) {
  const stage = assertUnitStage('reactivate', phase);
  const returned = withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const outcome = stage === 'discovery'
      ? reactivateDiscoveryUnit(manifest, topic)
      : reactivateSpecificationUnit(manifest, topic);
    saveWorkUnitManifest(cwd, workUnit, manifest);
    return outcome;
  });

  /** @type {string[]} */
  const warnings = [];
  indexRestored(cwd, workUnit, topic, returned.restored, warnings);

  const outcome = commitStateTail(cwd, `${workUnit}/manifest.json`, `workflow(${workUnit}): reactivate ${topic} (${stage})`, warnings);
  /** @type {TopicReactivateResult} */
  const result = { topic, phase: stage, status: 'reactivated', ...returned, committed: outcome.committed, warnings };
  noteCommitOutcome(result, outcome);
  return result;
}

// ---------------------------------------------------------------------------
// postpone — the Discovery unit's other exit. Cancel says "not doing this";
// postpone says "doing this later": the topic leaves the epic whole, a
// roadmap item is born or re-waits in the same transaction, nothing on disk
// moves, and the pull is the way back. Epic-only, as cancel is. The
// experiment series is never touched — a live record locks instead, because
// abandoning it is the destructive act this exit exists to avoid.
// ---------------------------------------------------------------------------

/**
 * @typedef {object} TopicPostponeResult
 * @property {string} topic
 * @property {'postponed'} status
 * @property {CancelledItem[]} postponed  the phase items the postpone stashed
 * @property {string[]} discarded  proposed groupings deleted with their source
 * @property {import('./roadmap.cjs').PostponeLanding} roadmap  the item that now waits for the topic
 * @property {string|null} committed  short commit sha, or null when nothing was staged
 * @property {string} [note]     set when committed is null
 * @property {string[]} warnings non-blocking failures (knowledge-base sync)
 */

/**
 * The topic's own files, as the roadmap writes a source: state-relative, and
 * only those on disk — the pointers that carry the record's depth to whoever
 * pulls the item back.
 * @param {string} cwd @param {object} manifest @param {string} workUnit @param {string} topic
 * @returns {string[]}
 */
function postponedSources(cwd, manifest, workUnit, topic) {
  const row = itemOf(manifest, 'discovery', topic);
  const brief = row && typeof row.brief_path === 'string' && row.brief_path.trim() !== '' ? row.brief_path : null;
  return [
    ...(brief ? [`${workUnit}/${brief}`] : []),
    `${workUnit}/research/${topic}.md`,
    `${workUnit}/discussion/${topic}.md`,
  ].filter((rel) => fs.existsSync(statePath(cwd, rel)));
}

/**
 * Postpone a topic: the Discovery unit into its hold, the roadmap item born
 * or re-waited under the chosen horizon, and one confined commit over both
 * manifests. All of it under the work unit's lock, the project lock nested
 * inside it: the plan refuses before anything is written, the manifest is
 * mutated in memory, the roadmap lands, and only then is the epic saved — so
 * a project-side refusal (the clash re-read at the landing) leaves the topic
 * where it was rather than postponed with nowhere to wait. The chunks and the
 * heartbeats follow the write, as every transition's do.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} topic
 * @param {{horizon?: string}} opts  the roadmap bucket the topic waits in
 * @returns {TopicPostponeResult}
 */
function postponeTopic(cwd, workUnit, topic, { horizon } = {}) {
  if (typeof horizon !== 'string' || horizon.trim() === '') {
    throw new Error('topic postpone: --horizon is required — the roadmap bucket the topic waits in');
  }
  const taken = withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    if (manifest.work_type !== 'epic') {
      throw new Error(`postpone is epic-only — "${workUnit}" is a ${manifest.work_type}, whose topic is the work unit; a pulled unit's "not now" is the work-unit cancel's revert`);
    }
    const plan = postponePlan(manifest, topic, readProjectManifest(cwd), horizon);
    if (plan.locks.length > 0) throw new Error(plan.locks[0].reason);

    const row = itemOf(manifest, 'discovery', topic);
    const summary = row && typeof row.summary === 'string' && row.summary.trim() !== '' ? row.summary : titlecase(topic);
    const sources = postponedSources(cwd, manifest, workUnit, topic);
    const postponed = stashItems(plan.items, 'postponed');
    discardGroupings(manifest, plan.discards);
    if (row) {
      row.postponed = true;
      stashOrder(row);
    }

    const roadmap = postponeToRoadmap(cwd, workUnit, topic, { horizon, summary, sources });
    saveWorkUnitManifest(cwd, workUnit, manifest);
    return { postponed, discarded: plan.discards, roadmap };
  });

  /** @type {string[]} */
  const warnings = [];
  removeHeldChunks(cwd, workUnit, topic, taken.postponed, warnings);
  for (const { phase } of taken.postponed) clearOwnQuietly(cwd, workUnit, phase, topic);

  const outcome = commitStateTail(
    cwd,
    [`${workUnit}/manifest.json`, PROJECT_MANIFEST_SPEC],
    `workflow(${workUnit}): postpone ${topic} → ${horizon}`,
    warnings,
  );
  /** @type {TopicPostponeResult} */
  const result = {
    topic,
    status: 'postponed',
    postponed: taken.postponed,
    discarded: taken.discarded,
    roadmap: taken.roadmap,
    committed: outcome.committed,
    warnings,
  };
  noteCommitOutcome(result, outcome);
  return result;
}

/**
 * Return a postponed Discovery unit to its epic — the pull's half of the
 * postpone, the mirror of reactivate under the pull's name: the marker
 * cleared, every stash returned, each restored `completed` artifact
 * re-indexed. One locked write and no commit — the pull's own transaction
 * stages both manifests together.
 * @param {string} cwd @param {string} workUnit @param {string} topic
 * @returns {{restored: RestoredItem[], warnings: string[]}}
 */
function restorePostponedUnit(cwd, workUnit, topic) {
  const restored = withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const out = restoreDiscoveryUnit(manifest, topic, 'postponed');
    saveWorkUnitManifest(cwd, workUnit, manifest);
    return out;
  });
  /** @type {string[]} */
  const warnings = [];
  indexRestored(cwd, workUnit, topic, restored, warnings);
  return { restored, warnings };
}

/**
 * Turn a postponed Discovery unit's hold into a cancel — `roadmap remove`
 * over the item the postpone put there, so "actually never" has one door.
 * The marker and every stashed item read `cancelled`, each stash and the
 * stashed map order kept for a later reactivate; the chunks left at the
 * postpone. One locked write and no commit — the remove's own transaction
 * stages both manifests together. A unit holding no postpone refuses: the
 * item's join is stale, and the remove must not report a cancel it never made.
 * @param {string} cwd @param {string} workUnit @param {string} topic
 * @param {string} item  the roadmap item being removed, for the orphan refusal
 * @returns {CancelledItem[]}
 */
function cancelPostponedUnit(cwd, workUnit, topic, item) {
  if (!fs.existsSync(statePath(cwd, workUnit, 'manifest.json'))) {
    throw new Error(`"${item}" was postponed from work unit "${workUnit}", which no longer exists — the join is orphaned`);
  }
  return withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const row = itemOf(manifest, 'discovery', topic);
    const held = unitItems(manifest, 'discovery', topic).filter(({ item: it }) => it.status === 'postponed');
    if ((!row || row.postponed !== true) && held.length === 0) {
      throw new Error(`"${item}" was postponed from "${topic}" in work unit "${workUnit}", where nothing is postponed — the join is stale`);
    }
    if (row) {
      delete row.postponed;
      row.cancelled = true;
    }
    const cancelled = held.map(({ phase, item: it }) => {
      it.status = 'cancelled';
      return { phase, previous_status: it.previous_status };
    });
    saveWorkUnitManifest(cwd, workUnit, manifest);
    return cancelled;
  });
}

module.exports = { startTopic, parkMessageItem, completeTopic, reopenTopic, staleSources, supersedeTopic, cancelTopic, reactivateTopic, postponeTopic, restorePostponedUnit, cancelPostponedUnit, flagDownstream, releaseExperimentWaits, assertLegalTopicName };
