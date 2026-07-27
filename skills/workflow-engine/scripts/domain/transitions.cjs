'use strict';

// ---------------------------------------------------------------------------
// Domain ring: topic transitions — start, triage, complete, reopen,
// supersede, amend, cancel, and reactivate, each a single transaction from the
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
// amend is the corrigendum transaction — specification only, because every
// other phase decays out of the knowledge base on its own while a spec is
// indexed forever, so a wrong claim in one is served authoritatively until
// somebody corrects it. It records provenance, flags the plan built on the
// old text, re-indexes, and commits; it never touches the item's status —
// the target's pipeline is over, and an annotation is not a reopening. Its
// disk and git checks run inside the lock alongside the manifest reads, so
// the whole validation is one consistent observation.
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
const { hasUncommittedChanges } = require('../kernel/git.cjs');
const { commitScopedWithKb, noteIfNothingCommitted } = require('./commit.cjs');
const { knowledge, INDEXED_ARTIFACTS } = require('./kb.cjs');
const { todayStamp } = require('./dates.cjs');

const { VALID_PHASES, VALID_PHASE_STATUSES } = require('../kernel/manifest-schema.cjs');

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
 */

/**
 * The phase item for `topic`, or a loud error.
 * @param {object} manifest @param {string} phase @param {string} topic
 * @returns {{status?: string, previous_status?: string, superseded_by?: string, amended_by?: unknown}}
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
 */

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
function triageTopic(cwd, workUnit, phase, topic) {
  assertLegalWrite(phase, 'triaged');
  return withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const phases = ensureContainer(manifest, 'phases', 'phases');
    const ph = ensureContainer(phases, phase, `phases.${phase}`);
    const items = ensureContainer(ph, 'items', `phases.${phase}.items`);

    const existing = items[topic];
    if (!existing || typeof existing !== 'object') {
      items[topic] = { status: 'triaged' };
      saveWorkUnitManifest(cwd, workUnit, manifest);
      return { topic, phase, status: 'triaged', created: true, status_before: null };
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
      saveWorkUnitManifest(cwd, workUnit, manifest);
      return { topic, phase, status: 'in-progress', created: false, status_before: before, reopened: true };
    }
    if (before === null) {
      // A status-less item (partial field writes) has never been started —
      // heal it to triaged, the same way start heals it to in-progress.
      existing.status = 'triaged';
      saveWorkUnitManifest(cwd, workUnit, manifest);
      return { topic, phase, status: 'triaged', created: false, status_before: null };
    }
    return { topic, phase, status: before, created: false, status_before: before };
  });
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
 */

/**
 * Reopen a completed phase item: set `status: in-progress`. Only a completed
 * item reopens — anything else keeps its own flow (a cancelled item must go
 * through reactivate). No knowledge-base sync — the item's chunks stay live
 * until re-completion re-indexes over the same identity. No git commit.
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

    saveWorkUnitManifest(cwd, workUnit, manifest);
    return { topic, phase, status: 'in-progress' };
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
 * @typedef {object} AmendmentRecord
 * @property {string} work_unit  the work unit that found the wrong claim
 * @property {string} date       ISO date, UTC
 */

/**
 * @typedef {object} TopicAmendResult
 * @property {string} work_unit
 * @property {string} topic
 * @property {AmendmentRecord[]} amended_by  the item's full amendment record, newest last
 * @property {boolean} spec_reconcile_needed  true when a planning item was flagged
 * @property {string|null} committed  short commit sha, or null when nothing was staged
 * @property {string} [note]     set when committed is null
 * @property {string[]} warnings non-blocking failures (knowledge-base index)
 */

/**
 * Amend a completed specification: record the corrigendum's provenance on the
 * spec item, flag the plan built on the old text, re-index the corrected file,
 * and commit — one transaction over an edit the caller has already written to
 * disk. The item's status is never touched: the target's pipeline is over, and
 * an annotation is not a reopening.
 *
 * Specification only. Research, discussion, and investigation are records of
 * what was said and found — they decay out of the knowledge base on their own
 * and are never corrected. Everything is validated before anything is mutated,
 * so a refusal leaves the target byte-pristine.
 * @param {string} cwd project root
 * @param {string} workUnit  the work unit whose spec is being corrected
 * @param {string} phase     must be `specification` — positional so the rule can refuse loudly
 * @param {string} topic
 * @param {{from: string}} opts  the work unit that found the wrong claim
 * @returns {TopicAmendResult}
 */
function amendTopic(cwd, workUnit, phase, topic, { from }) {
  if (phase !== 'specification') {
    throw new Error(
      `amend is specification-only — "${phase}" is a record of what was said or found, not a claim about the system; ` +
      'records are never corrected, and they decay out of the knowledge base on their own'
    );
  }
  if (!fs.existsSync(path.join(cwd, '.workflows', from))) {
    throw new Error(`unknown --from work unit "${from}" — the corrigendum's provenance must name a real work unit`);
  }

  const specPath = INDEXED_ARTIFACTS.specification(workUnit, topic);
  const stamp = todayStamp();

  const applied = withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    if (manifest.status === 'cancelled') {
      throw new Error(
        `work unit "${workUnit}" is cancelled — cancelling removed its knowledge-base chunks; ` +
        're-indexing behind that would resurrect them. Reactivate it first if the spec should still be served'
      );
    }
    const item = phaseItem(manifest, phase, topic);
    if (item.status === 'superseded') {
      const by = 'superseded_by' in item ? ` (by "${item.superseded_by}")` : '';
      throw new Error(`specification item "${topic}" is superseded${by} — its content moved; amend the absorbing topic instead`);
    }
    if (item.status === 'promoted') {
      const to = 'promoted_to' in item ? ` (to "${item.promoted_to}")` : '';
      throw new Error(`specification item "${topic}" is promoted${to} — its content moved; amend it from the cross-cutting work unit instead`);
    }
    if (item.status === 'in-progress') {
      throw new Error(`specification item "${topic}" is in progress — the topic is live; correct the claim in the work itself, not by corrigendum`);
    }
    if (item.status !== 'completed') {
      throw new Error(`specification item "${topic}" is not completed (status: ${item.status ?? 'none'}) — there is no concluded specification to amend`);
    }
    if (!fs.existsSync(path.join(cwd, specPath))) {
      throw new Error(`no specification on disk at ${specPath} — there is nothing to correct or index`);
    }
    if (!hasUncommittedChanges(cwd, specPath)) {
      throw new Error(
        `${specPath} is unchanged against HEAD — write the corrigendum and correct the affected lines first; ` +
        'amend records and re-indexes an edit that already exists, it does not author one'
      );
    }
    if ('amended_by' in item && item.amended_by !== undefined && !Array.isArray(item.amended_by)) {
      throw new Error(`manifest field "phases.specification.items.${topic}.amended_by" is not an array — fix the manifest by hand`);
    }

    /** @type {AmendmentRecord[]} */
    const amendedBy = Array.isArray(item.amended_by) ? item.amended_by : [];
    amendedBy.push({ work_unit: from, date: stamp });
    item.amended_by = amendedBy;

    // Planning is the spec's first consumer — everything downstream flows from
    // the plan, so one flag there reaches implementation and review too. No
    // planning item means nothing downstream was ever built on the old text.
    const planning = manifest.phases && manifest.phases.planning;
    const planItem = planning && planning.items ? planning.items[topic] : undefined;
    const flagged = Boolean(planItem && typeof planItem === 'object');
    if (flagged) planItem.spec_reconcile_needed = true;

    saveWorkUnitManifest(cwd, workUnit, manifest);
    return { amended_by: amendedBy, spec_reconcile_needed: flagged };
  });

  /** @type {string[]} */
  const warnings = [];
  knowledge(cwd, ['index', specPath], 'knowledge index', warnings);

  const committed = commitScopedWithKb(cwd, `.workflows/${workUnit}`, `spec(${workUnit}): corrigendum from ${from}`);
  /** @type {TopicAmendResult} */
  const result = {
    work_unit: workUnit,
    topic,
    amended_by: applied.amended_by,
    spec_reconcile_needed: applied.spec_reconcile_needed,
    committed,
    warnings,
  };
  noteIfNothingCommitted(result, committed);
  return result;
}

/**
 * Cancel an epic topic: stash the current status into `previous_status`, set
 * `status: cancelled`, drop the topic's discovery-map `order`, remove its
 * knowledge-base chunks (warn-don't-block), commit scoped to the work unit.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} phase
 * @param {string} topic
 * @returns {TopicTransitionResult}
 */
function cancelTopic(cwd, workUnit, phase, topic) {
  withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const item = phaseItem(manifest, phase, topic);
    if (item.status === 'cancelled') {
      throw new Error(`${phase} item "${topic}" is already cancelled`);
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

  const committed = commitScopedWithKb(cwd, `.workflows/${workUnit}`, `workflow(${workUnit}): cancel ${topic} (${phase})`);
  /** @type {TopicTransitionResult} */
  const result = { topic, phase, status: 'cancelled', committed, warnings };
  noteIfNothingCommitted(result, committed);
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

  const committed = commitScopedWithKb(cwd, `.workflows/${workUnit}`, `workflow(${workUnit}): reactivate ${topic} (${phase})`);
  /** @type {TopicTransitionResult} */
  const result = { topic, phase, status: restored, committed, warnings };
  noteIfNothingCommitted(result, committed);
  return result;
}

module.exports = { startTopic, triageTopic, completeTopic, reopenTopic, supersedeTopic, amendTopic, cancelTopic, reactivateTopic };
