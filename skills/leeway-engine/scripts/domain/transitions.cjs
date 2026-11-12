'use strict';

// ---------------------------------------------------------------------------
// Domain ring: topic transitions — start, cancel, reactivate and postpone,
// each a single transaction from the caller's perspective — and the parking a
// message's landing applies to the topic it reaches (mail.cjs).
//
// start is `enter`'s, phase-item lifecycle bookkeeping: a manifest write and
// no git commit — the entry's own commit picks the manifest change up.
// cancel/reactivate are the epic transactions over a topic's unit: manifest
// write, scoped git commit. Past the unit's spec no map topic is cancelled or
// reactivated (4.11.2, 18.4.19, spec-standing.cjs); a topic is postponed until
// ready to build's yes (P3).
//
// Validation throws loud and specific before anything is touched. Every
// load→mutate→save runs under the work unit's manifest lock (the same lock
// every manifest writer honours); the commit runs after release — the lock
// protects the manifest read-modify-write, nothing else.
// ---------------------------------------------------------------------------

const fs = require('fs');
const { loadWorkUnitManifest, saveWorkUnitManifest, withWorkUnitLock, readProjectManifest, ensureContainer } = require('../kernel/manifest.cjs');
const { commitStateTail, noteCommitOutcome, PROJECT_MANIFEST_SPEC } = require('./commit.cjs');
const {
  phaseItems, itemOf, computeTopicLifecycle, computeNextAction, CONVERSATION_ACTIONS, CLOSED_LIFECYCLES, lifecyclePhrase, mapWayOn, topicTitle,
  awaitedExperiments, waits, settleItemStatus,
  UNIT_PHASES, unitItems, discoveryUnitExists, promotedRefusal,
  cancelPlan, postponePlan, briefFile, topicDir, topicKey, noTopicRefusal, topicTitles, goesBy,
} = require('./derivations.cjs');
const { revertJoins, recordPutBack, retakeJoins, postponeToRoadmap } = require('./roadmap.cjs');
const { clearOwnQuietly } = require('./presence.cjs');
const { closeInFlight } = require('./agent-state.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { statePath } = require('../kernel/state-root.cjs');

const { VALID_PHASES, VALID_PHASE_STATUSES, DERIVED_PHASES, EXPERIMENT_SPAWN_PHASES, BUILD_PHASES } = require('../kernel/manifest-schema.cjs');
const { assertBeforeSpec } = require('./spec-standing.cjs');

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
 * @property {'discovery'} phase  the topic's unit
 * @property {'cancelled'} status
 * @property {CancelledItem[]} cancelled  the phase items the cancel took
 * @property {string[]} abandoned  the open records closed as abandoned, reason recorded on each row
 * @property {WaitRelease[]} released_waits  the evidence waits the topic's conversations held
 * @property {string[]} roadmap_reverted  roadmap items handed back to waiting by the cancel-revert hop
 * @property {import('./roadmap.cjs').HorizonGone[]} [roadmap_horizon_gone]  those of them whose horizon was removed meanwhile, now on none
 * @property {string[]} inbox  each waiting message's idea in the inbox, absolute
 * @property {string[]} closed_agents  the agents still running on the items taken, closed
 * @property {string|null} committed  short commit sha, or null when nothing was staged
 * @property {string} [note]     set when committed is null
 * @property {string[]} warnings non-blocking failures (closing the agents, the commit)
 */

/**
 * @typedef {object} RestoredItem
 * @property {string} phase
 * @property {string|null} status  the status the item returned to — null when it returned to never-attempted
 */

/**
 * @typedef {object} TopicReactivateResult
 * @property {string} topic
 * @property {'discovery'} phase  the topic's unit
 * @property {'reactivated'} status
 * @property {RestoredItem[]} restored  the phase items the reactivate restored — empty for a never-started topic
 * @property {string[]} [roadmap_rejoined]  the roadmap items its cancel put back, taken back
 * @property {string[]} [roadmap_stayed]  those other work took meanwhile, or archived, left where they are
 * @property {string|null} committed  short commit sha, or null when nothing was staged
 * @property {string} [note]     set when committed is null
 * @property {string[]} warnings non-blocking failures (the commit)
 */

/**
 * @typedef {object} TopicStartResult
 * @property {string} topic
 * @property {string} phase
 * @property {string} status   always `in-progress`
 * @property {boolean} created true when the phase item was created, false when resumed
 */

// The one spec keeps no items (P7), and a concluded spec is never corrected
// (11.9.1).

/** @param {Record<string, any>} manifest @param {string} phase */
function assertNoSpecItem(manifest, phase) {
  if (phase === 'specification') {
    throw new Error(`${manifest.name}'s spec keeps no items — it is entered at the work unit: engine enter specification ${manifest.name}`);
  }
}

// The build's places stand by its cut (buildPlaceStatus): no topic verb
// writes an implementation or review item.

/** @param {string} phase */
function assertNotBuildPlace(phase) {
  if (BUILD_PHASES.includes(phase)) {
    throw new Error(`${phase} stands by the build's cut — it is entered by \`engine enter ${phase} <work-unit>\`, never written by a topic verb`);
  }
}

// The map decides whether a topic's discussion can be born — the same join
// the epic menu renders its rows from, so the engine is never the permissive
// path around it. The gate is on birth alone: an in-progress item resumes
// regardless (the map already shows that phase live). A topic off the map —
// removed while the start waited on the lock among them — has none.

/**
 * @param {object} manifest @param {string} phase @param {string} topic
 * @param {{status?: string}|undefined} existing  the phase's own item, if any
 */
function assertMapAllowsStart(manifest, phase, topic, existing) {
  if (manifest.work_type !== 'epic') return;
  const allowed = CONVERSATION_ACTIONS[/** @type {keyof typeof CONVERSATION_ACTIONS} */ (phase)];
  if (!allowed) return;
  if (existing && existing.status === 'in-progress') return;
  if (!phaseItems(manifest, 'discovery').some((i) => i.name === topic)) {
    throw new Error(`${phase} can't start on "${topic}" — it is not on the map; a topic starts from its row on the epic menu`);
  }
  const { lifecycle } = computeTopicLifecycle(manifest, topic);
  const next = computeNextAction(lifecycle);
  if (next && allowed.includes(next)) return;
  throw new Error(
    `${phase} can't start on "${topic}" — ${lifecyclePhrase(lifecycle)}; in ${manifest.name}'s discovery, ${mapWayOn(manifest.name, topic, lifecycle)}`,
  );
}

/**
 * Start a phase item: create it with `status: in-progress` when absent
 * (init-phase semantics), or set an existing item back to `in-progress`.
 * A completed item reopens only through a message sent to it — resuming is
 * not starting — and a cancelled item through reactivate. On an epic the discovery map gates
 * the birth (see assertMapAllowsStart). No git commit.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} phase
 * @param {string} topic
 * @returns {TopicStartResult}
 */
function startTopic(cwd, workUnit, phase, topic) {
  assertLegalWrite(phase, 'in-progress');
  assertNotBuildPlace(phase);
  assertNotDerived(phase, 'the experiment item is derived bookkeeping — the spawn creates and reopens it (experiment create), never a start');
  return withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    assertNoSpecItem(manifest, phase);
    const phases = ensureContainer(manifest, 'phases', 'phases');
    const ph = ensureContainer(phases, phase, `phases.${phase}`);
    const items = ensureContainer(ph, 'items', `phases.${phase}.items`);

    const existing = items[topic] && typeof items[topic] === 'object' ? items[topic] : undefined;
    if (existing && existing.status === 'completed') {
      throw new Error(`${phase} item "${topic}" is already completed — a message sent to it reopens it`);
    } else if (existing && existing.status === 'cancelled') {
      throw new Error(`${phase} item "${topic}" is cancelled — reactivate it instead`);
    } else if (existing && existing.status === 'postponed') {
      throw new Error(postponedRefusal(phase, topic));
    } else if (existing && existing.status === 'promoted') {
      throw new Error(promotedRefusal(phase, topic, existing));
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
 * @typedef {object} WaitRelease
 * @property {string} phase       the holder — the spawning discussion
 * @property {string[]} released
 * @property {string[]} remaining
 */

/**
 * Release the evidence waits `topic`'s spawn-phase items hold on the named
 * experiments — the edge every terminal experiment transition rides
 * (conclude, abandon, the epic cancel), so a wait can never dangle. Removes
 * `ids` (or every id) from each holder's `awaiting_experiments` and deletes
 * the emptied field. No flag: the result reaches the discussion as the
 * map's waiting point settling, or as the report's message. Mutates the
 * loaded manifest; the caller saves under its own lock.
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
    releases.push({ phase, released: releasing, remaining });
  }
  return releases;
}

/**
 * Apply the parking semantics to a phase item receiving a message: create it
 * as `unstarted` when absent — a parked message must never read as started
 * work — heal a status-less item to `unstarted`, leave an `unstarted` or
 * `in-progress` item untouched, and set a `completed` item back to
 * `in-progress` (a landed message reopens the conversation).
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

// ---------------------------------------------------------------------------
// cancel / reactivate — topic-level, over the Discovery unit: the map row
// with everything under its name, its discussion and the experiment series.
// The work-unit cancel abandons the epic.
// ---------------------------------------------------------------------------

const UNIT_STAGES = Object.keys(UNIT_PHASES);

/** @typedef {Pick<TopicCancelResult, 'cancelled'|'abandoned'|'released_waits'>} UnitCancel */
/** @typedef {Pick<TopicReactivateResult, 'restored'>} UnitReactivate */

/**
 * Refuses a unit verb's phase argument unless it names the topic's unit —
 * there is no phase-level cancel.
 * @param {'cancel'|'reactivate'} verb @param {string} phase
 */
function assertUnitStage(verb, phase) {
  if (!UNIT_STAGES.includes(phase)) {
    throw new Error(`${verb} is topic-level — discovery, the map row with its discussion and experiments`);
  }
}

/**
 * Stash a live `order` for the reactivate round-trip — the map's execution
 * order leaves the live set with its row and comes back with it, so a
 * cancel/reactivate never forces a re-sequence.
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
 * Closed rows (cancelled, postponed) carry no order and never block.
 * @param {object} manifest @param {string} except @param {number} n
 */
function liveMapRowHolds(manifest, except, n) {
  return phaseItems(manifest, 'discovery').some((row) => row.name !== except && row.order === n
    && !CLOSED_LIFECYCLES.includes(computeTopicLifecycle(manifest, row.name).lifecycle));
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
 * What a cancel ends of a topic's experiments (18.4.22), whether it takes
 * the topic or the whole unit: every evidence wait its conversations hold
 * released, each of `ids` — its open records — ended abandoned with `reason`,
 * the register keeping its row, and the series settled. So no live record
 * survives the cancel, and a reactivate finds them abandoned. Mutates the
 * loaded manifest.
 * @param {Record<string, any>} manifest @param {string} topic
 * @param {string[]} ids @param {string} reason
 * @returns {WaitRelease[]}
 */
function abandonExperiments(manifest, topic, ids, reason) {
  const released = releaseExperimentWaits(manifest, topic);
  const series = itemOf(manifest, 'experiment', topic);
  if (series) {
    for (const id of ids) Object.assign(series.experiments[id], { status: 'abandoned', reason });
    settleItemStatus(series);
  }
  return released;
}

/**
 * The agents still running on each item a hold took, closed (agent-state's
 * `closeInFlight`); a store that does not read is a warning, the hold standing.
 * @param {string} cwd @param {string} workUnit @param {string} topic
 * @param {{phase: string}[]} held @param {string[]} warnings
 * @returns {string[]} the ids closed
 */
function closeHeldAgents(cwd, workUnit, topic, held, warnings) {
  return [...new Set(held.map(({ phase }) => phase))].flatMap((phase) => {
    try {
      return closeInFlight(cwd, workUnit, phase, topic);
    } catch (err) {
      warnings.push(`the ${phase} agents of "${topic}" were left as they stand: ${messageOf(err)}`);
      return [];
    }
  });
}

/** @param {object} manifest @param {string} topic */
function assertDiscoveryUnit(manifest, topic) {
  if (!discoveryUnitExists(manifest, topic)) {
    throw new Error(noTopicRefusal(manifest, topic));
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
    throw new Error(`"${topic}" is postponed — the roadmap owns it; archive its item there to cancel it, or pull it forward first`);
  }
  const plan = cancelPlan(manifest, topic);
  const mapItem = itemOf(manifest, 'discovery', topic);
  if (plan.items.length === 0 && !mapItem) {
    throw new Error(`"${topic}" has nothing to cancel — no live item under its name and no map row`);
  }

  const released_waits = abandonExperiments(manifest, topic, plan.records, 'topic cancelled');
  const cancelled = stashItems(plan.items, 'cancelled');
  if (mapItem) {
    mapItem.cancelled = true;
    stashOrder(mapItem);
  }
  return { cancelled, abandoned: plan.records, released_waits };
}

/**
 * @typedef {{message: string, idea: string}} MailMoved  a message that waited
 *   for the topic, and the idea it became in the inbox, state-relative
 */

/**
 * The one door a topic's cancel goes through, whichever hold it ends: under
 * the work unit's lock, `cancel` flips the loaded manifest and names the
 * topic, the manifest is saved, and every message waiting for the topic
 * moves to the inbox as an idea (10.1.6). Commits nothing.
 * @template {{topic: string}} T
 * @param {string} cwd @param {string} workUnit
 * @param {(manifest: Record<string, any>) => T} cancel
 * @returns {T & {mail: MailMoved[]}}
 */
function cancelUnderLock(cwd, workUnit, cancel) {
  return withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const outcome = cancel(manifest);
    saveWorkUnitManifest(cwd, workUnit, manifest);
    const { moveWaitingToInbox } = require('./mail.cjs');
    return { ...outcome, mail: moveWaitingToInbox(cwd, workUnit, outcome.topic) };
  });
}

/**
 * Cancel a topic — the Discovery unit under the name — in one locked write,
 * the roadmap's cancel-revert hop run and its waiting mail moved to the
 * inbox as ideas under the same lock (18.8.20, 10.1.6), then release the
 * calling session's own heartbeat on each item taken, and commit the
 * manifest write. Any other phase is refused: there is no phase-level cancel.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} phase  `discovery`
 * @param {string} said  the topic, by its key or its title (8.8.17)
 * @returns {TopicCancelResult}
 */
function cancelTopic(cwd, workUnit, phase, said) {
  assertUnitStage('cancel', phase);
  const { mail, topic, reverted, gone, ...taken } = cancelUnderLock(cwd, workUnit, (manifest) => {
    assertBeforeSpec(cwd, manifest, 'cancel');
    const topic = topicKey(manifest, said);
    const outcome = cancelDiscoveryUnit(manifest, topic);
    // The cancel-revert hop: a topic whose cancellation leaves its map
    // lifecycle cancelled hands any roadmap item joined to it back to
    // waiting (sources/origin intact) — the un-pull path — the joins
    // recorded on its map row for its reactivate. The project manifest
    // rides this transaction's commit when a revert landed.
    const hop = computeTopicLifecycle(manifest, topic).lifecycle === 'cancelled'
      ? revertJoins(cwd, workUnit, { topic })
      : { reverted: [], joins: [], horizon_gone: [] };
    const row = itemOf(manifest, 'discovery', topic);
    if (row) recordPutBack(row, hop.joins);
    return { ...outcome, topic, reverted: hop.reverted, gone: hop.horizon_gone };
  });

  /** @type {string[]} */
  const warnings = [];
  const closedAgents = closeHeldAgents(cwd, workUnit, topic, taken.cancelled, warnings);

  for (const { phase: p } of taken.cancelled) clearOwnQuietly(cwd, workUnit, p, topic);

  // A cancel writes the work-unit manifest, the topic's waiting mail moved
  // to the inbox, and the project manifest when a roadmap join reverted, and
  // nothing else on disk — it runs from the epic menu, beside sessions
  // holding the unit's other topics.
  const cancelSpec = [
    `${workUnit}/manifest.json`,
    ...mail.flatMap(({ message, idea }) => [message, idea]),
    ...(reverted.length > 0 ? [PROJECT_MANIFEST_SPEC] : []),
  ];
  const outcome = commitStateTail(cwd, cancelSpec, `workflow(${workUnit}): cancel ${topic} (discovery)`, warnings);
  /** @type {TopicCancelResult} */
  const result = {
    topic, phase: 'discovery', status: 'cancelled', ...taken, roadmap_reverted: reverted, inbox: mail.map(({ idea }) => statePath(cwd, idea)),
    closed_agents: closedAgents, committed: outcome.committed, warnings,
  };
  if (gone.length > 0) result.roadmap_horizon_gone = gone;
  // The manifest alone is narrower than any state scope, so the retry stays
  // generic — the commit door's own rule.
  noteCommitOutcome(result, outcome);
  return result;
}

/**
 * Take a Discovery unit out of a hold — the shared body of the cancel's
 * reactivate and the pull forward's return: the map row's marker cleared,
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
  return { restored };
}

/**
 * Reactivate a cancelled topic — the unit the cancel took — in one locked
 * write, the roadmap items its cancel put back taken back where they still
 * wait (18.8.20), and commit the manifest write.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} phase  `discovery`
 * @param {string} said  the topic, by its key or its title (8.8.17)
 * @returns {TopicReactivateResult}
 */
function reactivateTopic(cwd, workUnit, phase, said) {
  assertUnitStage('reactivate', phase);
  const { topic, rejoined, stayed, ...returned } = withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    assertBeforeSpec(cwd, manifest, 'change');
    const topic = topicKey(manifest, said);
    const outcome = reactivateDiscoveryUnit(manifest, topic);
    const row = itemOf(manifest, 'discovery', topic);
    const retaken = row ? retakeJoins(cwd, workUnit, row) : { rejoined: [], stayed: [] };
    saveWorkUnitManifest(cwd, workUnit, manifest);
    return { ...outcome, ...retaken, topic };
  });

  /** @type {string[]} */
  const warnings = [];
  const specs = [`${workUnit}/manifest.json`, ...(rejoined.length > 0 ? [PROJECT_MANIFEST_SPEC] : [])];
  const outcome = commitStateTail(cwd, specs, `workflow(${workUnit}): reactivate ${topic} (discovery)`, warnings);
  /** @type {TopicReactivateResult} */
  const result = { topic, phase: 'discovery', status: 'reactivated', ...returned, committed: outcome.committed, warnings };
  if (rejoined.length > 0) result.roadmap_rejoined = rejoined;
  if (stayed.length > 0) result.roadmap_stayed = stayed;
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
 * @property {import('./roadmap.cjs').PostponeLanding} roadmap  the item that now waits for the topic
 * @property {string[]} closed_agents  the agents still running on the items stashed, closed
 * @property {string|null} committed  short commit sha, or null when nothing was staged
 * @property {string} [note]     set when committed is null
 * @property {string[]} warnings non-blocking failures (closing the agents, the commit)
 */

/**
 * The topic's own files, as the roadmap writes a source: state-relative, and
 * only those on disk — the pointers that carry the record's depth to whoever
 * pulls the item back.
 * @param {string} cwd @param {string} workUnit @param {string} topic
 * @returns {string[]}
 */
function postponedSources(cwd, workUnit, topic) {
  return [briefFile(workUnit, topic), `${topicDir(workUnit, topic)}/log.md`].filter((rel) => fs.existsSync(statePath(cwd, rel)));
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
 * @param {string} said  the topic, by its key or its title (8.8.17)
 * @param {{horizon?: string}} opts  the roadmap bucket the topic waits in
 * @returns {TopicPostponeResult}
 */
function postponeTopic(cwd, workUnit, said, { horizon } = {}) {
  if (typeof horizon !== 'string' || horizon.trim() === '') {
    throw new Error('topic postpone: --horizon is required — the roadmap bucket the topic waits in');
  }
  const { topic, ...taken } = withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const topic = topicKey(manifest, said);
    if (manifest.work_type !== 'epic') {
      throw new Error(`postpone is epic-only — "${workUnit}" is a ${manifest.work_type}, whose topic is the work unit; a pulled unit's "not now" is the work-unit cancel's revert`);
    }
    const plan = postponePlan(manifest, topic, readProjectManifest(cwd), horizon);
    if (plan.locks.length > 0) throw new Error(plan.locks[0].reason);

    const row = itemOf(manifest, 'discovery', topic);
    const summary = row && typeof row.summary === 'string' && row.summary.trim() !== '' ? row.summary : topicTitle(manifest, topic);
    const sources = postponedSources(cwd, workUnit, topic);
    const postponed = stashItems(plan.items, 'postponed');
    if (row) {
      row.postponed = true;
      stashOrder(row);
    }

    const roadmap = postponeToRoadmap(cwd, workUnit, topic, { goes: goesBy(topicTitles(manifest), topic), horizon, summary, sources });
    saveWorkUnitManifest(cwd, workUnit, manifest);
    return { topic, postponed, roadmap };
  });

  /** @type {string[]} */
  const warnings = [];
  const closedAgents = closeHeldAgents(cwd, workUnit, topic, taken.postponed, warnings);
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
    roadmap: taken.roadmap,
    closed_agents: closedAgents,
    committed: outcome.committed,
    warnings,
  };
  noteCommitOutcome(result, outcome);
  return result;
}

/**
 * Return a postponed Discovery unit to its epic — the pull's half of the
 * postpone, the mirror of reactivate under the pull's name: the marker
 * cleared, every stash returned. One locked write and no commit — the
 * pull's own transaction stages both manifests together.
 * @param {string} cwd @param {string} workUnit @param {string} topic
 * @returns {RestoredItem[]}
 */
function restorePostponedUnit(cwd, workUnit, topic) {
  return withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const restored = restoreDiscoveryUnit(manifest, topic, 'postponed');
    saveWorkUnitManifest(cwd, workUnit, manifest);
    return restored;
  });
}

/**
 * Turn a postponed Discovery unit's hold into a cancel — `roadmap archive`
 * over the item the postpone put there, so "actually never" has one door.
 * The marker and every stashed item read `cancelled`, each stash and the
 * stashed map order kept for a later reactivate; the chunks left at the
 * postpone; the mail that waited for the topic's return moved to the inbox,
 * through the cancel's own door (cancelUnderLock). No commit — the archive's
 * own transaction stages both manifests and the mail together. A unit
 * holding no postpone refuses: the item's join is stale, and the archive
 * must not report a cancel it never made.
 * @param {string} cwd @param {string} workUnit @param {string} topic
 * @param {string} item  the roadmap item being archived, for the orphan refusal
 * @returns {{topic: string, cancelled: CancelledItem[], mail: MailMoved[]}}
 */
function cancelPostponedUnit(cwd, workUnit, topic, item) {
  if (!fs.existsSync(statePath(cwd, workUnit, 'manifest.json'))) {
    throw new Error(`"${item}" was postponed from work unit "${workUnit}", which no longer exists — the join is orphaned`);
  }
  return cancelUnderLock(cwd, workUnit, (manifest) => {
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
    return { topic, cancelled };
  });
}

module.exports = { startTopic, parkMessageItem, cancelTopic, reactivateTopic, postponeTopic, restorePostponedUnit, cancelPostponedUnit, releaseExperimentWaits, abandonExperiments, assertLegalTopicName };
