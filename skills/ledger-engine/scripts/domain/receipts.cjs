'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the receipts the lifecycle and inbox verbs draw after their
// one JSON line (projections/transactions.cjs), each from what the verb
// answered and the state it left — so a warning, a count or an item left
// where it stands reaches the person with no caller carrying it across: a
// work unit cancelled, reactivated or pivoted, a feature absorbed into an
// epic, a topic cancelled, reactivated, postponed or pulled forward, inbox
// items archived, restored or deleted; and in the start menu's place, a
// unit finished, or cancelled from inside it, with what waits on the
// person (projections/start-menu.cjs, `endedReceipt`).
// ---------------------------------------------------------------------------

const { loadWorkUnitManifest } = require('../kernel/manifest.cjs');
const { keptAside, keptWords } = require('./fix-aside.cjs');
const { cancelKept } = require('./fix-branch.cjs');
const { lastClosed } = require('./cancel-closed.cjs');
const { quickFixBuild, liveUnitItems, itemTitle, postponedItem } = require('./derivations.cjs');
const { loadProjectManifest } = require('./reads.cjs');
const { roadmapState } = require('./roadmap.cjs');
const { liveItem, archivedOne, deletedItemTitle } = require('./inbox-set.cjs');
const { workunitReceipt, topicReceipt, absorbReceipt, inboxArchiveReceipt, inboxRestoreReceipt, inboxDeleteReceipt } = require('./projections/transactions.cjs');
const { endedReceipt, closedReceipt } = require('./projections/start-menu.cjs');
const { startMenuRead } = require('./start-menu.cjs');

/** @typedef {import('./projections/transactions.cjs').Stayed} Stayed */

/** Whether a verb's answer carried a warning. @param {{warnings?: string[]}} answered */
const warned = (answered) => (answered.warnings ?? []).length > 0;

/**
 * Where each roadmap item a reactivate left stands (18.8.20): with the work
 * that took it meanwhile, archived, or under that name no more.
 * @param {string} cwd @param {string[]} names
 * @returns {Stayed[]}
 */
function stayedWhere(cwd, names) {
  if (names.length === 0) return [];
  const state = roadmapState(cwd);
  return names.map((name) => {
    if (state.archived.some((row) => row.name === name)) return { name, archived: true };
    const row = state.items.find((r) => r.name === name);
    return row?.work_unit === undefined ? { name } : { name, work_unit: row.work_unit };
  });
}

/**
 * A work unit's cancel, reactivate or pivot receipt, from the verb's answer
 * and the unit as it left it: a cancel's pull requests closed, a quick-fix's
 * branches and each fix's work it kept, and the waiting messages it moved to
 * the inbox; a reactivate's roadmap items left where they stand.
 * @param {string} cwd @param {'cancel'|'reactivate'|'pivot'} verb
 * @param {{work_unit: string, warnings?: string[], inbox?: string[], roadmap_stayed?: string[]}} answered
 * @returns {string}
 */
function unitReceipt(cwd, verb, answered) {
  const unit = answered.work_unit;
  const warn = warned(answered);
  if (verb === 'reactivate') return workunitReceipt(verb, unit, { warn, stayed: stayedWhere(cwd, answered.roadmap_stayed ?? []) });
  if (verb === 'pivot') return workunitReceipt(verb, unit, { warn });
  const manifest = loadWorkUnitManifest(cwd, unit);
  return workunitReceipt(verb, unit, {
    warn,
    inbox: (answered.inbox ?? []).length,
    closed: lastClosed(manifest),
    branches: quickFixBuild(manifest) ? cancelKept(cwd, unit) : [],
    kept: keptAside(cwd, unit).map(keptWords),
  });
}

/**
 * A topic's cancel, reactivate, postpone or pull forward receipt, from the
 * verb's answer and the epic as it left it: the topic by its title, the
 * waiting messages a cancel moved to the inbox, the horizon a postpone left
 * it waiting under, the statuses a reactivate or a return from the roadmap
 * gave its items back, and the roadmap items a reactivate left where they
 * stand. A pull forward that lands a new topic restores nothing.
 * @param {string} cwd @param {'cancel'|'reactivate'|'postpone'|'restore'} verb @param {string} workUnit
 * @param {{topic: string, warnings?: string[], inbox?: string[], roadmap_stayed?: string[], restored?: unknown[]}} answered
 * @returns {string}
 */
function topicReceiptOf(cwd, verb, workUnit, answered) {
  const { topic } = answered;
  const manifest = loadWorkUnitManifest(cwd, workUnit);
  const name = itemTitle(manifest, 'discovery', topic);
  const warn = warned(answered);
  if (verb === 'cancel') return topicReceipt(verb, name, { warn, inbox: (answered.inbox ?? []).length });
  if (verb === 'postpone') return topicReceipt(verb, name, { warn, horizon: postponedItem(loadProjectManifest(cwd), workUnit, topic)?.horizon ?? null });
  const restored = verb === 'restore' && answered.restored === undefined ? [] : unitStatuses(manifest, topic);
  return topicReceipt(verb, name, { warn, restored, stayed: stayedWhere(cwd, answered.roadmap_stayed ?? []) });
}

/**
 * The statuses a topic's live items stand at, phase by phase.
 * @param {object} manifest @param {string} topic
 * @returns {{phase: string, status: string}[]}
 */
function unitStatuses(manifest, topic) {
  return liveUnitItems(manifest, 'discovery', topic).map(({ phase, item }) => ({ phase, status: item.status }));
}

/**
 * An absorb's receipt: what moved into the epic, the experiments counted by
 * their top-level records — a split is worked inside its parent — and what
 * a collision renamed.
 * @param {import('./workunit-absorb.cjs').WorkUnitAbsorbResult} answered
 * @returns {string}
 */
function absorbedReceipt(answered) {
  const moved = /** @type {const} */ (['seeds', 'assets', 'spikes']).filter((home) => answered[home].length > 0);
  const experiments = (answered.experiment?.experiments ?? []).filter((id) => !id.includes('.')).length;
  return absorbReceipt(answered.epic, answered.topic, moved, {
    warn: warned(answered),
    experiments,
    renamed: [...answered.renamed_assets, ...answered.renamed_spikes],
  });
}

/**
 * The archive's receipt over the items it moved, each titled from its file
 * in the archive.
 * @param {string} cwd @param {{archived: string[]}} answered
 * @returns {string}
 */
function archivedReceipt(cwd, { archived }) {
  return inboxArchiveReceipt(archived.map((at) => archivedOne(cwd, at).title));
}

/**
 * The restore's receipt, an item at a time, each naming the unit whose build
 * log it took the item's claim out of, where it took one.
 * @param {string} cwd @param {{restored: string[], unclaimed?: {path: string, unit: string}[]}} answered
 * @returns {string}
 */
function restoredReceipt(cwd, { restored, unclaimed = [] }) {
  return inboxRestoreReceipt(restored.map((at) => ({
    title: liveItem(cwd, at).title,
    unclaimedFrom: unclaimed.find((claim) => claim.path === at)?.unit ?? null,
  })));
}

/**
 * The delete's receipt, each item titled from git's last copy of its file.
 * @param {string} cwd @param {{deleted: string[]}} answered
 * @returns {string}
 */
function deletedReceipt(cwd, { deleted }) {
  return inboxDeleteReceipt(deleted.map((at) => deletedItemTitle(cwd, at)));
}

/**
 * A unit's finish said in the start menu's place: its title done, and what
 * waits on the person across the project; for a quick-fix, whose close
 * carries on in its conversation (24.1.5), the board's done line for it
 * where the close put the conversation back at another place (`back_to`),
 * and each branch here its landing left behind what it landed, where one
 * did.
 * @param {string} cwd @param {{unit: string, back_to?: string, landed?: {repo: string, into: string, behind?: {branch: string, why: string}}[]}} answered
 * @returns {string}
 */
function finishedOf(cwd, { unit, back_to: back, landed = [] }) {
  const manifest = loadWorkUnitManifest(cwd, unit);
  if (quickFixBuild(manifest)) {
    const behind = landed.flatMap(({ repo, into, behind: held }) => (held === undefined ? [] : [{ repo, into, ...held }]));
    return closedReceipt(back === undefined ? null : `✓ ${itemTitle(manifest, 'implementation', unit)} · quick-fix · complete`, behind);
  }
  return endedReceipt(`${itemTitle(manifest, 'review', unit)} is done.`, startMenuRead(cwd));
}

/**
 * A unit's cancel receipt, and where the cancel left the conversation that
 * sat in it (topic-leave.cjs, `leftUnit`), what waits on the person said in
 * the start menu's place — but at a quick-fix, whose cancel carries on as
 * its close does (24.1.5).
 * @param {string} cwd @param {{work_unit: string, warnings?: string[], inbox?: string[]}} answered @param {boolean} left
 * @returns {string}
 */
function cancelledOf(cwd, answered, left) {
  const ended = left && !quickFixBuild(loadWorkUnitManifest(cwd, answered.work_unit));
  return unitReceipt(cwd, 'cancel', answered) + (ended ? endedReceipt(null, startMenuRead(cwd)) : '');
}

module.exports = { unitReceipt, topicReceiptOf, absorbedReceipt, archivedReceipt, restoredReceipt, deletedReceipt, finishedOf, cancelledOf };
