'use strict';

// Render-surface catalogue — the named runtime surfaces `engine render
// <surface>` serves to skills. Judgment decides; code renders: address-backed
// values come from the manifest (JSON state only — markdown artifacts are
// never parsed), judgment content arrives as a validated JSON payload file,
// and each surface returns demarcated sections the calling flow emits
// verbatim per their markers, in the step that shows them. Gate-mode
// branching renders inside the surface: the caller never chooses between
// gated and auto output.
//
// Surfaces read; they never write a state commit takes, and write three
// things beside. `phase-note` beats the addressed topic, since announcing a
// phase's start is the session taking it. `map` moves the last-looked mark as
// it draws, since the map shown in the conversation is the person looking
// (5.8.14). `decided --file` stages Claude's payload in the topic's cache,
// what the gate's yes lands (decided.cjs); `start-this-work --file` and
// `approve-map --file` stage theirs in discovery's cache the same way
// (start-this-work.cjs, approve-map.cjs).

const fs = require('fs');
const path = require('path');
const { loadManifest, loadProjectManifest } = require('./reads.cjs');
const { displayWidth } = require('../kernel/terminal.cjs');
const { titlecase, tag } = require('./conventions.cjs');
const { section, dataSection, CONTINUE_INSTRUCTION, CONTINUE_MARKDOWN_INSTRUCTION, timedInstruction, menu, cmdOption, promptOption, indentedBody, emitAs, MENU_INSTRUCTION, AUTO_GATE_CLAUSE } = require('./projections/surfaces.cjs');
const { keptAside, keptWords } = require('./fix-aside.cjs');
const { workunitReceipt, topicReceipt, absorbSummary, ABSORB_MOVED, absorbReceipt, importReprompt, pivotContinuationMenu, absorbContinuationMenu, inboxRestoreReceipt, inboxDeleteReceipt } = require('./projections/transactions.cjs');
const { absorbTargetMenu, absorbConfirmGate, archivedActions, archivedDeleteGate, inboxContent, completedActions } = require('./projections/start.cjs');
const { archivedItem, inboxItems, liveItem, deletedItemTitle } = require('./inbox-set.cjs');
const { sourceLines } = require('../kernel/knowledge/chunker.cjs');
const { brownfieldOffer } = require('./brownfield.cjs');
const {
  ORIGINS: WALKTHROUGH_ORIGINS, loadScreen, loadCard, walkthroughOffer, walkthroughScreen, walkthroughHome, walkthroughTopics, walkthroughTopic,
} = require('./projections/walkthrough.cjs');
const { migrationsApplied, migrationGate, stateLostGate, repoStop, githubRuleGate, githubSquashGate, labelGate, brownfieldOfferGate, knowledgeGate, knowledgeReady, KNOWLEDGE_GATE_VARIANTS, KEY_PROVIDERS } = require('./projections/boot.cjs');
const { knowledgeFiles } = require('../kernel/knowledge/files.cjs');
const { readMetadata } = require('../kernel/knowledge/store.cjs');
const { ENGINE_COMMAND, messageOf } = require('../kernel/call.cjs');
const { githubSquashNested } = require('./github-setup.cjs');
const { beatQuietly } = require('./presence.cjs');
const { roadmapState, hasRoadmapNode, validateKind, markedKind, planRoadmapBatch, addNameRefusal, DEFAULT_KIND } = require('./roadmap.cjs');
const {
  roadmapMapView,
  roadmapAddGate,
  roadmapHarvestGate,
  roadmapParksGate,
} = require('./projections/roadmap.cjs');
const { revisitPhasesSection } = require('./projections/workunit.cjs');
const { experimentRegister, experimentApprovalGate, experimentPick, experimentNextGate, experimentSpawnGate } = require('./projections/experiment.cjs');
const { compareExperimentIds, isParentExperimentId, DERIVED_PHASES, EXPERIMENT_TERMINAL_STATUSES, EXPERIMENT_SPAWN_PHASES, TOPIC_PHASES } = require('../kernel/manifest-schema.cjs');
const { WORK_UNIT_TYPES, phaseTargets } = require('./workunit-detail.cjs');
const {
  computeNextPhase, computeTopicLifecycle, awaitedExperiments, itemOf,
  UNIT_PHASES, liveUnitItems, discoveryUnitExists, cancelPlan,
  postponePlan, postponeTarget, postponedItem, openExperiments, roadmapItems,
  topicTitle, topicTitles, titled, itemTitle, goesBy, dismissedNames, topicKey, noTopicRefusal, briefFile,
} = require('./derivations.cjs');
const { sendReportOf } = require('./mail.cjs');
const { mapSurface } = require('./topic-map.cjs');
const { decidedSurface, decidedStrikeSurface, waitAgentsSurface } = require('./decided.cjs');
const { startThisWorkSurface } = require('./start-this-work.cjs');
const { approveMapSurface, approveMapStrikeSurface } = require('./approve-map.cjs');
const { readyToBuildSurface } = require('./ready-to-build.cjs');
const { buildHeadlineSurface, taskLandedSurface, taskAccountSurface, stepGateSurface, phaseMergeGateSurface, buildStopSurface, buildProgressSurface } = require('./build-screens.cjs');
const { investigationPlanSurface, investigationCheckInSurface } = require('./investigation.cjs');
const { concludeSurface } = require('./investigation-conclude.cjs');
const { reviewReportSurface, reviewCallsSurface } = require('./review-round.cjs');
const { reviewTreeSurface } = require('./review-tree.cjs');
const { finishSurface } = require('./finish.cjs');
const { discoveryMapScreen } = require('./projections/discovery-map.cjs');
const { manageDetail } = require('./workunit-manage.cjs');
const { absorbedMaterial } = require('./workunit-absorb.cjs');
const { stateRoot, statePath, outsideRepository } = require('../kernel/state-root.cjs');
const { stateMergeGateSurface } = require('./state-merge.cjs');
const { ledgerStopSurface } = require('./ledger.cjs');
const { directiveStopSurface } = require('./directives.cjs');
const { gitFloorStopSurface } = require('./git-floor.cjs');
const { projectName } = require('./state-checks.cjs');
const { helpSurface } = require('./projections/help.cjs');
const { verdictsSurface } = require('./verdict.cjs');
const { startMenuSurface } = require('./projections/start-menu.cjs');

/**
 * Parse a 3-segment dotpath `work_unit.phase.topic`, validating the work unit
 * exists; a topic phase's topic is named by its key or its title, and
 * answered as its key. Loud on shape errors — surfaces are called from
 * prescribed prose and a malformed address is an authoring bug.
 * @param {string} cwd @param {string} dotpath @param {string} surface
 * @returns {{workUnit: string, phase: string, topic: string, manifest: object}}
 */
function resolveAddress(cwd, dotpath, surface) {
  const parts = (dotpath || '').split('.');
  if (parts.length !== 3 || parts.some((p) => p === '')) {
    throw new Error(`render ${surface}: address must be <work_unit>.<phase>.<topic>, got "${dotpath}"`);
  }
  const [workUnit, phase, said] = parts;
  const manifest = loadManifest(cwd, workUnit);
  if (!manifest) throw new Error(`render ${surface}: work unit "${workUnit}" not found`);
  const topic = TOPIC_PHASES.includes(phase) ? topicKey(manifest, said) : said;
  return { workUnit, phase, topic, manifest };
}

/** @param {string} cwd @param {string} file @param {string} surface @returns {any} */
function readJsonPayload(cwd, file, surface) {
  let raw;
  try {
    raw = fs.readFileSync(path.resolve(cwd, file), 'utf8');
  } catch {
    throw new Error(`render ${surface}: payload file not found: ${file}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`render ${surface}: payload is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (parsed === null || typeof parsed !== 'object') {
    throw new Error(`render ${surface}: payload must be a JSON object or array`);
  }
  return parsed;
}

/** @param {unknown} v @returns {v is string} */
function isFilled(v) {
  return typeof v === 'string' && v.trim() !== '';
}

/**
 * @param {string} cwd
 * @param {{dotpath: string, file?: string}} args
 * @returns {string}
 */
function backlogGate(cwd, { dotpath, file }) {
  if (!file) throw new Error('render backlog-gate: --file <payload.json> is required');
  resolveAddress(cwd, dotpath, 'backlog-gate');
  const p = readJsonPayload(cwd, file, 'backlog-gate');
  if (!isFilled(p.title)) throw new Error('render backlog-gate: "title" must be a non-empty string');
  return section('MENU: backlog gate', MENU_INSTRUCTION, menu(
    `Setting **${p.title}** aside.`,
    [
      cmdOption('r', 'roadmap', "On the roadmap — you've decided to do it; it waits under a horizon"),
      cmdOption('i', 'inbox', "In the inbox — not decided yet; you'll triage it later"),
    ],
    { question: 'Where should it wait?' },
  ));
}

// ---------------------------------------------------------------------------
// The discovery-map gates. A staged candidate and a closed send target each
// stop the same way: the proposal above, the confirm beneath. Judgment supplies the names and values; the bodies,
// the questions and the option sets are fixed here, so a gate reads the same
// whichever flow raised it and at any width.
// ---------------------------------------------------------------------------

// candidate-gate — the analysis approval gate's per-candidate stop. The
// candidate's own fields are judgment content staged by the analysis; the
// gate mode is manifest state at the staging subtree, so the branch renders
// inside the surface: the caller never chooses between gated and auto
// output. A candidate the manifest does not mark `pending` never renders —
// a stale payload refuses rather than gating something already decided.
// The announce variant opens the walk: how many candidates wait pending,
// counted from the same subtree — nothing to review where none do, or the
// analysis staged nothing.

/** The gap analysis's staging subtree, or undefined. @param {object} manifest @returns {any} */
function gapStaging(manifest) {
  return ((((manifest.phases || {}).discovery || {}).analysis_staging) || {})['discovery-gap-analysis'];
}

/** @param {string} cwd @param {string} dotpath @returns {string} */
function candidateAnnounce(cwd, dotpath) {
  const { manifest } = resolveWorkUnit(cwd, dotpath, 'candidate-gate');
  const staging = gapStaging(manifest);
  const rows = Object.values((staging && staging.candidates) || {});
  const pending = rows.filter((row) => row && row.status === 'pending').length;
  return section('DISPLAY: candidates announced', CONTINUE_INSTRUCTION,
    pending === 0 ? 'Nothing new to review.' : `Gap analysis surfaced ${pending} candidate topic(s).`);
}

/**
 * @param {string} cwd
 * @param {{dotpath: string, file?: string, variant?: string}} args
 * @returns {string}
 */
function candidateGate(cwd, { dotpath, file, variant }) {
  if (variant !== undefined && variant !== 'announce') {
    throw new Error(`render candidate-gate: --variant takes "announce" alone — the per-candidate gate takes none, got "${variant}"`);
  }
  if (variant === 'announce') return candidateAnnounce(cwd, dotpath);
  if (!file) throw new Error('render candidate-gate: --file <payload.json> is required');
  const { workUnit, manifest } = resolveWorkUnit(cwd, dotpath, 'candidate-gate');
  const staging = gapStaging(manifest);
  if (!staging || typeof staging !== 'object') {
    throw new Error(`render candidate-gate: no staged gap-analysis candidates for "${workUnit}"`);
  }
  const p = readJsonPayload(cwd, file, 'candidate-gate');
  if (!isFilled(p.name)) throw new Error('render candidate-gate: "name" must be a non-empty string');
  if (!isFilled(p.summary)) throw new Error('render candidate-gate: "summary" must be a non-empty string');
  const row = (staging.candidates || {})[p.name];
  if (!row || typeof row !== 'object' || row.status !== 'pending') {
    throw new Error(`render candidate-gate: "${p.name}" is not a pending candidate — a stale payload never renders`);
  }
  const mode = staging.gate_mode;
  if (mode !== 'gated' && mode !== 'auto') {
    throw new Error(`render candidate-gate: gate_mode must be "gated" or "auto", got "${mode}"`);
  }
  const name = titlecase(p.name);
  const display = section('DISPLAY: candidate', emitAs('text'), [
    name,
    ...indentedBody([p.summary, 'surfaced by gap analysis']),
  ].join('\n'));
  if (mode === 'auto') {
    return [display, section(
      'DISPLAY: candidate approved',
      timedInstruction('text', 'after recording the approval', AUTO_GATE_CLAUSE),
      `${name} — approved [auto].`,
    )].join('\n');
  }
  return [display, section('MENU: candidate gate', MENU_INSTRUCTION, menu('', [
    cmdOption('y', 'yes', 'Approve — the topic joins the map and its phase can start from the epic menu'),
    cmdOption('a', 'auto', 'Approve this and all remaining candidates automatically'),
    cmdOption('s', 'skip', 'Skip and dismiss — the analysis never re-proposes this name'),
    cmdOption('p', 'postpone', 'Postpone — the topic joins the map with its brief and waits on the roadmap under a horizon you name'),
    promptOption('Comment', 'Tell me what to change (summary or description)'),
  ], { question: 'Add this topic to the map?' }))].join('\n');
}

// discovery-map — an epic's map for Claude and for the person: its topics in
// their order with their lifecycles, an unstarted topic's brief, the one a
// rewrite reads first, and the names struck from it.

/**
 * @param {string} cwd
 * @param {{dotpath: string}} args
 * @returns {string}
 */
function discoveryMapSurface(cwd, { dotpath }) {
  const { workUnit, manifest } = resolveWorkUnit(cwd, dotpath, 'discovery-map');
  if (manifest.work_type !== 'epic') throw new Error(`render discovery-map: a ${manifest.work_type} has no map — its one topic is the unit itself`);
  const { map, summary } = buildDiscoveryMap(manifest, stateRoot(cwd));
  const rows = map.map((row) => (row.lifecycle === 'fresh' ? { ...row, brief: statePath(cwd, briefFile(workUnit, row.name)) } : row));
  return discoveryMapScreen(workUnit, { rows, summary }, dismissedNames(manifest));
}

// send-closed-target — the send's stop over a cancelled target, which no
// future session will surface. The address names the target and the surface
// derives its lifecycle with the same join every other map consumer uses.
// The statement names the target; the ask beneath it is fixed.

/**
 * @param {string} cwd
 * @param {{dotpath: string}} args
 * @returns {string}
 */
function sendClosedTarget(cwd, { dotpath }) {
  const { phase, topic, manifest } = resolveAddress(cwd, dotpath, 'send-closed-target');
  if (phase !== 'discovery') {
    throw new Error(`render send-closed-target: address must be <work_unit>.discovery.<target>, got phase "${phase}"`);
  }
  if (!itemOf(manifest, 'discovery', topic)) {
    throw new Error(`render send-closed-target: ${noTopicRefusal(manifest, topic)}`);
  }
  const { lifecycle } = computeTopicLifecycle(manifest, topic);
  if (lifecycle !== 'cancelled') {
    throw new Error(`render send-closed-target: "${topic}" is "${lifecycle}", not cancelled — the gate serves cancelled targets`);
  }
  // The reopen row states its consequence: choosing it does not only land the
  // message, it puts the topic back in front of every convergence read.
  return section('MENU: closed target gate', MENU_INSTRUCTION, menu(`"${topic}" is cancelled, so it won't pick up messages.`, [
    cmdOption('o', 'open', 'Reactivate it and send the message there — the topic returns to its previous state and counts as open again'),
    cmdOption('e', 'elsewhere', 'Pick a different target'),
    cmdOption('d', 'drop', "Don't send it; it stays with the current topic"),
  ], { question: 'Where should the message go?' }));
}

// ---------------------------------------------------------------------------
// The experiment surfaces — the laboratory's gates and displays over one
// topic's series (projections/experiment.cjs renders; the handlers resolve
// the item and refuse states the calling prose never reaches).
// Address-backed: the series lives on the manifest (`experiments.{id}`
// records), never in a hand-maintained file.
// ---------------------------------------------------------------------------

/**
 * Resolve an experiment address to its series rows in id order — parents by
 * number, each parent's sub-experiments beneath it. A loud error when the
 * phase is wrong or the topic holds no series.
 * @param {string} cwd @param {string} dotpath @param {string} surface
 * @returns {{workUnit: string, topic: string, title: string, rows: import('./projections/experiment.cjs').SeriesRow[]}}
 */
function resolveExperiment(cwd, dotpath, surface) {
  const { workUnit, phase, topic, manifest } = resolveAddress(cwd, dotpath, surface);
  if (phase !== 'experiment') {
    throw new Error(`render ${surface}: address must be <work_unit>.experiment.<topic>, got phase "${phase}"`);
  }
  const item = itemOf(manifest, 'experiment', topic);
  if (!item || typeof item !== 'object') {
    throw new Error(`render ${surface}: no experiment series for "${topic}" in "${workUnit}"`);
  }
  const experiments = (item.experiments && typeof item.experiments === 'object') ? item.experiments : {};
  const rows = Object.entries(experiments)
    .map(([id, r]) => ({ id, ...(r && typeof r === 'object' ? r : {}) }))
    .sort((a, b) => compareExperimentIds(a.id, b.id));
  return { workUnit, topic, title: topicTitle(manifest, topic), rows };
}

/** The series' live top-level records, id order. @param {import('./projections/experiment.cjs').SeriesRow[]} rows */
function liveExperiments(rows) {
  return rows.filter((r) => isParentExperimentId(r.id) && !EXPERIMENT_TERMINAL_STATUSES.includes(r.status));
}

/**
 * @param {string} cwd
 * @param {{dotpath: string}} args
 * @returns {string}
 */
function experimentRegisterSurface(cwd, { dotpath }) {
  const { title, rows } = resolveExperiment(cwd, dotpath, 'experiment-register');
  return experimentRegister(title, rows);
}

/**
 * @param {string} cwd
 * @param {{dotpath: string, id?: string}} args
 * @returns {string}
 */
function experimentApprovalGateSurface(cwd, { dotpath, id }) {
  const { topic, rows } = resolveExperiment(cwd, dotpath, 'experiment-approval-gate');
  if (!isFilled(id)) throw new Error('render experiment-approval-gate: --id is required (E1, E1.1, …)');
  const record = rows.find((r) => r.id === id);
  if (!record) throw new Error(`render experiment-approval-gate: no experiment ${id} in "${topic}"'s series`);
  if (record.status !== 'designed') {
    throw new Error(`render experiment-approval-gate: ${id} is "${record.status}", not designed — the briefing confirm follows the written design`);
  }
  return experimentApprovalGate(/** @type {string} */ (id));
}

/**
 * The record picker — the several-live-records path, rendered directly
 * beneath the register it picks from. Refuses a series with no live
 * top-level record — the pick has nothing to offer.
 * @param {string} cwd
 * @param {{dotpath: string}} args
 * @returns {string}
 */
function experimentPickSurface(cwd, { dotpath }) {
  const { topic, rows } = resolveExperiment(cwd, dotpath, 'experiment-pick');
  const live = liveExperiments(rows);
  if (live.length === 0) {
    throw new Error(`render experiment-pick: "${topic}"'s series holds no live experiments — there is nothing to pick`);
  }
  return experimentPick(live);
}

/**
 * The return leg's gate — fetched after a terminal record transition while
 * live records remain: work the next experiment in this session, or back to
 * the menu. Refuses when no live top-level record exists — the calling
 * prose takes the bridge exit then, never this gate.
 * @param {string} cwd
 * @param {{dotpath: string}} args
 * @returns {string}
 */
function experimentNextGateSurface(cwd, { dotpath }) {
  const { topic, rows } = resolveExperiment(cwd, dotpath, 'experiment-next-gate');
  const live = liveExperiments(rows);
  if (live.length === 0) {
    throw new Error(`render experiment-next-gate: "${topic}"'s series holds no live experiments — the bridge exit follows a finished series`);
  }
  return experimentNextGate(live);
}

/**
 * Resolve an address restricted to a set of phases. Loud on any other.
 * @param {string} cwd @param {string} dotpath @param {string} surface
 * @param {string[]} phases  the phases the surface serves
 * @param {string} noun      what the address names, for the refusal
 * @returns {{workUnit: string, phase: string, topic: string, manifest: object}}
 */
function resolvePhaseItem(cwd, dotpath, surface, phases, noun) {
  const address = resolveAddress(cwd, dotpath, surface);
  if (!phases.includes(address.phase)) {
    throw new Error(`render ${surface}: address must be <work_unit>.<${phases.join('|')}>.<topic> — ${noun}; got phase "${address.phase}"`);
  }
  return address;
}

/**
 * Resolve a conversation address — a discussion item, the phase that spawns
 * experiments.
 * @param {string} cwd @param {string} dotpath @param {string} surface
 * @returns {{workUnit: string, phase: string, topic: string, manifest: object}}
 */
function resolveConversation(cwd, dotpath, surface) {
  return resolvePhaseItem(cwd, dotpath, surface, EXPERIMENT_SPAWN_PHASES, "the conversation's own item");
}

/**
 * The now-or-later gate — refuses an id the addressed item holds no wait on:
 * the gate follows the recorded spawn, never precedes it.
 * @param {string} cwd
 * @param {{dotpath: string, id?: string}} args
 * @returns {string}
 */
function experimentSpawnGateSurface(cwd, { dotpath, id }) {
  const { workUnit, phase, topic, manifest } = resolveConversation(cwd, dotpath, 'experiment-spawn-gate');
  if (!isFilled(id)) throw new Error('render experiment-spawn-gate: --id is required (E1, E2, …)');
  if (!awaitedExperiments(manifest, phase, topic).includes(/** @type {string} */ (id))) {
    throw new Error(`render experiment-spawn-gate: ${phase} "${topic}" holds no evidence wait on ${id} — the gate follows the recorded spawn (experiment create)`);
  }
  return experimentSpawnGate({ phase, id: /** @type {string} */ (id), unit: workUnit, topic, workType: manifest.work_type });
}

// summary-backfill-gate — the epic's provenance recovery. The topics it
// recovers are the map's rows missing a summary or a description, read from
// the manifest in map order; the summaries drafted for the rows missing one
// are judgment content and ride a payload keyed by topic. batch = the
// proposed summaries above the accept gate, proposed = the same display
// alone (the edit loop's re-render), unsourced = the topics no source file
// could be drafted from, named by payload.

const { buildDiscoveryMap } = require('./derivations.cjs');

const SUMMARY_BACKFILL_VARIANTS = ['batch', 'proposed', 'unsourced'];

/** @param {string} cwd @param {string} workUnit @param {object} manifest @returns {import('./derivations.cjs').DiscoveryMapRow[]} */
function backfillRows(cwd, workUnit, manifest) {
  const rows = buildDiscoveryMap(manifest, stateRoot(cwd)).map
    .filter((row) => !row.summary_present || !row.description_present);
  if (rows.length === 0) {
    throw new Error(`render summary-backfill-gate: "${workUnit}" has no discovery item missing a summary or description — nothing to backfill`);
  }
  return rows;
}

/**
 * The drafted summaries, one per row missing its summary — null where the
 * topic's source file is missing.
 * @param {string} cwd @param {string|undefined} file @param {import('./derivations.cjs').DiscoveryMapRow[]} rows
 * @returns {Record<string, string|null>}
 */
function draftedSummaries(cwd, file, rows) {
  if (!file) throw new Error('render summary-backfill-gate: --file <payload.json> is required — the drafted summaries');
  const drafted = readJsonPayload(cwd, file, 'summary-backfill-gate').summaries;
  if (!drafted || typeof drafted !== 'object' || Array.isArray(drafted)) {
    throw new Error('render summary-backfill-gate: "summaries" must be an object keyed by topic name');
  }
  const needing = rows.filter((row) => !row.summary_present).map((row) => row.name);
  const stray = Object.keys(drafted).find((name) => !needing.includes(name));
  if (stray) throw new Error(`render summary-backfill-gate: "${stray}" is not a topic missing its summary — only those take a drafted line`);
  const unanswered = needing.find((name) => drafted[name] !== null && !isFilled(drafted[name]));
  if (unanswered) {
    throw new Error(`render summary-backfill-gate: "summaries.${unanswered}" must be its drafted line, or null where its source file is missing`);
  }
  return drafted;
}

/**
 * The proposed summaries, one numbered row per topic.
 * @param {import('./derivations.cjs').DiscoveryMapRow[]} rows @param {Record<string, string|null>} drafted @param {string} instruction
 * @returns {string}
 */
function proposedSummaries(rows, drafted, instruction) {
  const indent = '       ';
  const lines = [`Proposed summaries for ${rows.length} topic(s):`, ''];
  rows.forEach((row, i) => {
    lines.push(`  ${i + 1}. ${row.title}`);
    if (!row.summary_present) {
      lines.push(...indentedBody([drafted[row.name] ?? '(source file missing — please provide)'], { indent }));
      return;
    }
    // The tag keeps its two-space gap, dropping to a line of its own where the summary's last line has no room.
    const summary = indentedBody([/** @type {string} */ (row.summary)], { indent });
    const tagged = `${summary[summary.length - 1]}  (already populated)`;
    if (tagged.length <= displayWidth()) summary[summary.length - 1] = tagged;
    else summary.push(`${indent}(already populated)`);
    lines.push(...summary);
  });
  return section('DISPLAY: proposed summaries', instruction, lines.join('\n'));
}

/**
 * @param {string} cwd
 * @param {{dotpath: string, variant?: string, file?: string}} args
 * @returns {string}
 */
function summaryBackfillGate(cwd, { dotpath, variant, file }) {
  if (variant === undefined || !SUMMARY_BACKFILL_VARIANTS.includes(variant)) {
    throw new Error(`render summary-backfill-gate: --variant must be one of ${SUMMARY_BACKFILL_VARIANTS.join(', ')}, got "${variant ?? ''}"`);
  }
  const { workUnit, manifest } = resolveWorkUnit(cwd, dotpath, 'summary-backfill-gate');
  if (variant === 'unsourced') return unsourcedGate(cwd, file, topicTitles(manifest));
  const rows = backfillRows(cwd, workUnit, manifest);
  const drafted = draftedSummaries(cwd, file, rows);
  if (variant === 'proposed') return proposedSummaries(rows, drafted, CONTINUE_INSTRUCTION);
  return [
    proposedSummaries(rows, drafted, emitAs('text', ', directly above the menu')),
    section('MENU: summary batch gate', MENU_INSTRUCTION, menu('', [
      cmdOption('y', 'yes', 'Accept all summaries as drafted (description is auto-drafted silently)'),
      cmdOption('e', 'edit', 'Edit one or more summary lines before accepting'),
      cmdOption('s', 'skip', 'Skip the whole batch (leave fields blank)'),
    ], { question: 'Accept these summaries?' })),
  ].join('\n');
}

/** The topics no source file could be drafted from. @param {string} cwd @param {string|undefined} file @param {Record<string, string>} titles @returns {string} */
function unsourcedGate(cwd, file, titles) {
  if (!file) throw new Error('render summary-backfill-gate: --file <payload.json> is required for --variant unsourced');
  const p = readJsonPayload(cwd, file, 'summary-backfill-gate');
  if (!Array.isArray(p.names) || p.names.length === 0 || p.names.some((n) => !isFilled(n))) {
    throw new Error('render summary-backfill-gate: "names" must be a non-empty array of topic names');
  }
  const unsourced = [`${p.names.length} topic(s) have no source file to draft from:`, '', ...p.names.map((n) => `- ${titled(titles, n)}`)];
  return section('MENU: unsourced topics gate', MENU_INSTRUCTION, menu(unsourced.join('\n'), [
    cmdOption('p', 'provide', "Tell me the summary for each and I'll write it"),
    cmdOption('d', 'dismiss', 'Write a minimal name-derived summary noting the missing source, so this stops re-prompting'),
    cmdOption('l', 'leave', 'Leave them unset; this flow re-offers next time'),
  ], { question: 'How do you want to handle them?' }));
}

// ---------------------------------------------------------------------------
// Work-unit surfaces — the completion banner, the cancel and postpone gates.
// Address-backed (work_type from the manifest); phases ride as flags.
// ---------------------------------------------------------------------------

/** @type {Record<string, string>} */
const TYPE_LABELS = {
  feature: 'Feature',
  bugfix: 'Bugfix',
  'quick-fix': 'Quick-Fix',
  epic: 'Epic',
};

/**
 * Resolve a 1-segment work-unit address.
 * @param {string} cwd @param {string} dotpath @param {string} surface
 * @returns {{workUnit: string, manifest: any, typeLabel: string}}
 */
function resolveWorkUnit(cwd, dotpath, surface) {
  if (!dotpath || dotpath.includes('.')) {
    throw new Error(`render ${surface}: address must be a bare <work_unit>, got "${dotpath}"`);
  }
  const manifest = loadManifest(cwd, dotpath);
  if (!manifest) throw new Error(`render ${surface}: work unit "${dotpath}" not found`);
  const typeLabel = TYPE_LABELS[manifest.work_type] || titlecase(String(manifest.work_type || ''));
  return { workUnit: dotpath, manifest, typeLabel };
}

/**
 * @param {string} cwd
 * @param {{dotpath: string, phase?: string}} args
 * @returns {string}
 */
function phaseCompleted(cwd, { dotpath, phase }) {
  const { workUnit } = resolveWorkUnit(cwd, dotpath, 'phase-completed');
  if (!isFilled(phase)) throw new Error('render phase-completed: --phase is required');
  // A derived phase has no completion ceremony — the record closed, the
  // session ends, and sibling records may still live — so its line says what
  // is true: the session is complete, never the phase.
  const line = DERIVED_PHASES.includes(phase)
    ? `${titlecase(phase)} session complete for "${titlecase(workUnit)}".`
    : `${titlecase(phase)} completed for "${titlecase(workUnit)}".`;
  return section('DISPLAY: phase completed', CONTINUE_INSTRUCTION, line);
}

/** `a`, `a and b`, `a, b, and c`. @param {string[]} parts */
function listJoin(parts) {
  if (parts.length <= 1) return parts.join('');
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

/**
 * The cancel gate's statement over a Discovery unit — exactly what the
 * cancel takes: the map row alone for a never-started topic; otherwise the
 * items by phase and the open experiment records that end abandoned.
 * @param {object} manifest @param {string} topic
 */
function discoveryCancelStatement(manifest, topic) {
  if (!discoveryUnitExists(manifest, topic)) {
    throw new Error(`render cancel-gate: ${noTopicRefusal(manifest, topic)}`);
  }
  const { lifecycle } = computeTopicLifecycle(manifest, topic);
  if (lifecycle === 'cancelled') {
    throw new Error(`render cancel-gate: "${topic}" is already cancelled — the menu never offers it`);
  }
  if (lifecycle === 'postponed') {
    throw new Error(`render cancel-gate: "${topic}" is postponed — the roadmap owns it; archive its item there to cancel it, or pull it forward first`);
  }
  const name = topicTitle(manifest, topic);
  const plan = cancelPlan(manifest, topic);
  if (plan.items.length === 0) {
    if (!itemOf(manifest, 'discovery', topic)) {
      throw new Error(`render cancel-gate: "${topic}" has nothing to cancel — no live item under its name and no map row, so the menu never offers it`);
    }
    return `Cancelling **${name}** takes it off the board — nothing has started, so only the map row is marked; it can be reactivated later.`;
  }
  const parts = [`Cancelling **${name}** marks its ${listJoin(plan.items.map(({ phase, item }) => `${phase} [${item.status}]`))} cancelled — it can be reactivated later.`];
  const experiments = openExperiments(plan.records);
  if (experiments.length > 0) {
    const one = experiments.length === 1;
    parts.push(`${experiments.length} open experiment${one ? '' : 's'} (${experiments.join(', ')}) end${one ? 's' : ''} abandoned on the register.`);
  }
  return parts.join(' ');
}

/**
 * The cancel confirm over one unit — `<wu>.discovery.<topic>` of an epic, or
 * a single-topic unit by its bare name — fetched by the epic menu and by a
 * session cancelling its own topic.
 * The statement names exactly what the cancel takes and stays context; the
 * short question takes the glyph. Yes runs the cancel, `topic cancel` or
 * `workunit cancel`; no carries on. A locked or already-cancelled unit
 * refuses: the menu never offers it.
 * @param {string} cwd
 * @param {{dotpath: string}} args
 * @returns {string}
 */
function cancelGate(cwd, { dotpath }) {
  const { statement, cancel } = (dotpath || '').includes('.') ? epicUnitCancel(cwd, dotpath) : workUnitCancel(cwd, dotpath);
  return section(
    'MENU: cancel gate',
    MENU_INSTRUCTION,
    menu(statement, [
      cmdOption('y', 'yes', 'Confirm cancellation', { next: { kind: 'engine', argv: cancel } }),
      cmdOption('n', 'no', 'Keep it', { next: { kind: 'continue' } }),
    ], { question: 'Cancel it?' }),
  );
}

/**
 * An epic's unit under the cancel gate: what the cancel takes, and the cancel.
 * @param {string} cwd @param {string} dotpath
 * @returns {{statement: string, cancel: string[]}}
 */
function epicUnitCancel(cwd, dotpath) {
  const { workUnit, phase, topic, manifest } = resolveAddress(cwd, dotpath, 'cancel-gate');
  if (!(phase in UNIT_PHASES)) {
    throw new Error(`render cancel-gate: address must be <work_unit>.discovery.<topic>, got phase "${phase}"`);
  }
  return { statement: discoveryCancelStatement(manifest, topic), cancel: ['topic', 'cancel', workUnit, phase, topic] };
}

/**
 * A single-topic unit under the cancel gate: the unit is its one topic, so
 * the whole unit is called off.
 * @param {string} cwd @param {string} dotpath
 * @returns {{statement: string, cancel: string[]}}
 */
function workUnitCancel(cwd, dotpath) {
  const { workUnit, manifest, typeLabel } = resolveWorkUnit(cwd, dotpath, 'cancel-gate');
  if (manifest.work_type === 'epic') {
    throw new Error(`render cancel-gate: "${workUnit}" is an epic — address the topic to cancel, <work_unit>.discovery.<topic>`);
  }
  if (manifest.status !== 'in-progress') {
    throw new Error(`render cancel-gate: "${workUnit}" is ${manifest.status} — only work in progress is cancelled`);
  }
  return {
    statement: `Cancelling **${titlecase(workUnit)}** calls off the whole ${typeLabel.toLowerCase()} — it stops where it stands, and can be reactivated later.`,
    cancel: ['workunit', 'cancel', workUnit],
  };
}

/**
 * The postpone gate's statement in two halves: what goes — the map row alone
 * for a never-started topic, otherwise the items by phase — and where it
 * lands, in the park gate's shape.
 * @param {string} workUnit @param {string} topic
 * @param {import('./derivations.cjs').PostponePlan} plan @param {string} horizon
 * @param {Record<string, any>|null} project  the project manifest, the gate's one read
 * @param {string} name  the topic as screens title it
 * @param {string} goesAs  the name the topic goes by
 * @returns {string}
 */
function postponeStatement(workUnit, topic, plan, horizon, project, name, goesAs) {
  const goes = plan.items.length === 0
    ? `Postponing **${name}** sets it aside — nothing has started, so only the map row is marked.`
    : `Postponing **${name}** marks its ${listJoin(plan.items.map(({ phase, item }) => `${phase} [${item.status}]`))} postponed — its record stays on disk and comes back with the pull.`;
  const roadmap = project && hasRoadmapNode(project) ? project.roadmap : null;
  const horizons = roadmap && Array.isArray(roadmap.horizons) ? roadmap.horizons : [];
  const target = postponeTarget(project, workUnit, topic, goesAs);
  const flag = roadmap && !horizons.includes(horizon) ? ' (new)' : '';
  const lands = target.joined || target.archived
    ? `Its own item **${titlecase(target.name)}** ${target.joined ? 're-waits' : 'comes back from the archive'} under "${horizon}"${flag}.`
    : `It waits on the roadmap under "${horizon}"${flag}, until it is pulled into work.`;
  return [goes, lands, ...(roadmap ? [] : ['The roadmap is created with it.'])]
    .filter(Boolean).join(' ');
}

/**
 * The postpone confirm over one Discovery unit — `<wu>.discovery.<topic>`,
 * the horizon named. The statement says what goes and where it lands and
 * stays context; the short question takes the glyph. A locked unit is
 * refused with the plan's first lock, so it is met here rather than after
 * the yes.
 * @param {string} cwd
 * @param {{dotpath: string, horizon?: string}} args
 * @returns {string}
 */
function postponeGate(cwd, { dotpath, horizon }) {
  const { workUnit, phase, topic, manifest } = resolveAddress(cwd, dotpath, 'postpone-gate');
  if (phase !== 'discovery') {
    throw new Error(`render postpone-gate: address must be <work_unit>.discovery.<topic>, got phase "${phase}"`);
  }
  if (!isFilled(horizon)) throw new Error('render postpone-gate: --horizon is required');
  const project = loadProjectManifest(cwd);
  const plan = postponePlan(manifest, topic, project, horizon);
  if (plan.locks.length > 0) throw new Error(`render postpone-gate: ${plan.locks[0].reason}`);
  return section(
    'MENU: postpone gate',
    MENU_INSTRUCTION,
    menu(postponeStatement(workUnit, topic, plan, /** @type {string} */ (horizon), project, topicTitle(manifest, topic), goesBy(topicTitles(manifest), topic)), [
      cmdOption('y', 'yes', 'Postpone it', { next: { kind: 'engine', argv: ['topic', 'postpone', workUnit, topic, '--horizon', /** @type {string} */ (horizon)] } }),
      cmdOption('n', 'no', 'Keep it here', { next: { kind: 'continue' } }),
      promptOption('Comment', 'Tell me what to change (the horizon)', { next: { kind: 'continue' } }),
    ], { question: 'Postpone it?' }),
  );
}

// ---------------------------------------------------------------------------
// phase-note — the one-line status notes a phase's start renders (Resuming /
// Starting / Reopening …). Address-backed; the verb is the caller's word, the
// noun defaults to the phase segment. Only ever rendered where a phase
// starts, for its own topic, so it beats the addressed topic: announcing
// the start is the same act as claiming it.
// ---------------------------------------------------------------------------

/**
 * @param {string} cwd
 * @param {{dotpath: string, verb?: string, noun?: string}} args
 * @returns {string}
 */
function phaseNote(cwd, { dotpath, verb, noun }) {
  const { workUnit, phase, topic, manifest } = resolveAddress(cwd, dotpath, 'phase-note');
  if (!isFilled(verb)) throw new Error('render phase-note: --verb is required (e.g. Resuming, Reopening, Starting)');
  beatQuietly(cwd, workUnit, phase, topic);
  return section(
    'DISPLAY: phase note',
    CONTINUE_INSTRUCTION,
    `${verb} ${isFilled(noun) ? noun : phase}: ${itemTitle(topicTitles(manifest), phase, topic)}`,
  );
}

// ---------------------------------------------------------------------------
// Transaction receipts — fetched by the calling flow right after its
// lifecycle verb, so the verb's stdout stays one JSON line. Each surface
// validates that the state it renders from matches the verb it receipts:
// a receipt fetched out of place refuses loudly. `--warn` prepends the
// knowledge advisory — the caller sets it when the transaction's JSON
// carried `warnings`.
// ---------------------------------------------------------------------------

const WORKUNIT_RECEIPT_STATUS = { cancel: 'cancelled', reactivate: 'in-progress' };

/**
 * How many waiting messages a cancel moved to the inbox, as `--inbox <n>`
 * carries it from the cancel's `inbox` — none where it is not given;
 * refused for another verb, and for a value that is no count.
 * @param {string} surface @param {string|undefined} verb @param {string|undefined} inbox
 * @returns {number}
 */
function inboxCount(surface, verb, inbox) {
  if (inbox === undefined) return 0;
  if (verb !== 'cancel') throw new Error(`render ${surface}: --inbox counts what a cancel moved to the inbox — it takes --verb cancel`);
  if (!/^(0|[1-9][0-9]*)$/.test(inbox)) throw new Error(`render ${surface}: --inbox takes how many messages the cancel moved, got "${inbox}"`);
  return Number(inbox);
}

/** @param {string} cwd @param {{dotpath: string, verb?: string, warn?: string, inbox?: string}} args @returns {string} */
function workunitReceiptSurface(cwd, args) {
  const { manifest, workUnit } = resolveWorkUnit(cwd, args.dotpath, 'workunit-receipt');
  const verb = args.verb;
  if (verb !== 'cancel' && verb !== 'reactivate' && verb !== 'pivot') {
    throw new Error(`render workunit-receipt: --verb must be cancel, reactivate, or pivot, got "${verb}"`);
  }
  const inbox = inboxCount('workunit-receipt', verb, args.inbox);
  if (verb === 'pivot') {
    if (manifest.work_type !== 'epic') {
      throw new Error(`render workunit-receipt: "${workUnit}" is not an epic — nothing to receipt for a pivot`);
    }
  } else if (manifest.status !== WORKUNIT_RECEIPT_STATUS[verb]) {
    throw new Error(`render workunit-receipt: "${workUnit}" is "${manifest.status}", not "${WORKUNIT_RECEIPT_STATUS[verb]}" — the ${verb} has not run`);
  }
  return workunitReceipt(verb, workUnit, {
    warn: args.warn === '1',
    inbox,
    kept: verb === 'cancel' ? keptAside(cwd, workUnit).map(keptWords) : [],
  });
}

/**
 * The statuses a topic's live items stand at — what a reactivate or a pull
 * forward returned them to.
 * @param {object} manifest @param {string} name
 */
function unitStatuses(manifest, name) {
  return liveUnitItems(manifest, 'discovery', name).map(({ phase, item }) => ({ phase, status: item.status }));
}

/**
 * The Discovery unit a unit receipt addresses, refused when the dotpath
 * names another phase or no unit of the name.
 * @param {object} manifest @param {string} phase @param {string} topic @param {string} verb
 */
function assertDiscoveryUnitAddress(manifest, phase, topic, verb) {
  if (phase !== 'discovery') {
    throw new Error(`render topic-receipt: --verb ${verb} addresses the Discovery unit — <work_unit>.discovery.<topic>, got phase "${phase}"`);
  }
  if (!discoveryUnitExists(manifest, topic)) {
    throw new Error(`render topic-receipt: ${noTopicRefusal(manifest, topic)}`);
  }
}

/**
 * The topic receipts: `cancel`, `reactivate`, `postpone` and `restore`
 * address the unit, `<wu>.discovery.<topic>`, and read its state after the
 * verb ran.
 * @param {string} cwd @param {{dotpath: string, verb?: string, warn?: string, inbox?: string}} args @returns {string}
 */
function topicReceiptSurface(cwd, args) {
  const { workUnit, phase, topic, manifest } = resolveAddress(cwd, args.dotpath, 'topic-receipt');
  const verb = args.verb;
  const warn = args.warn === '1';
  const inbox = inboxCount('topic-receipt', verb, args.inbox);
  const name = itemTitle(topicTitles(manifest), phase, topic);
  if (verb === 'postpone') {
    assertDiscoveryUnitAddress(manifest, phase, topic, verb);
    if (computeTopicLifecycle(manifest, topic).lifecycle !== 'postponed') {
      throw new Error(`render topic-receipt: "${topic}" is not postponed — the postpone has not run`);
    }
    const waiting = postponedItem(loadProjectManifest(cwd), workUnit, topic);
    return topicReceipt(verb, name, { warn, horizon: waiting ? waiting.horizon : null });
  }
  if (verb === 'restore') {
    assertDiscoveryUnitAddress(manifest, phase, topic, verb);
    if (computeTopicLifecycle(manifest, topic).lifecycle === 'postponed') {
      throw new Error(`render topic-receipt: "${topic}" is still postponed — the pull forward has not run`);
    }
    return topicReceipt(verb, name, { warn, restored: unitStatuses(manifest, topic) });
  }
  if (verb !== 'cancel' && verb !== 'reactivate') {
    throw new Error(`render topic-receipt: --verb must be cancel, reactivate, postpone, or restore, got "${verb}"`);
  }
  assertDiscoveryUnitAddress(manifest, phase, topic, verb);
  const cancelled = computeTopicLifecycle(manifest, topic).lifecycle === 'cancelled';
  if (verb === 'cancel') {
    if (!cancelled) throw new Error(`render topic-receipt: "${topic}" is not cancelled — the cancel has not run`);
    return topicReceipt(verb, name, { warn, inbox });
  }
  if (cancelled) {
    throw new Error(`render topic-receipt: "${topic}" is still cancelled — the reactivate has not run`);
  }
  return topicReceipt(verb, name, { warn, restored: unitStatuses(manifest, topic) });
}

/**
 * The pre-confirm absorb summary — every fact is the feature's own manifest
 * state, read here so the display can never disagree with what the
 * transaction will move. Experiments count top-level records only.
 * @param {string} cwd @param {{dotpath: string, into?: string, topic?: string}} args @returns {string}
 */
function absorbSummarySurface(cwd, args) {
  const { manifest, workUnit } = resolveWorkUnit(cwd, args.dotpath, 'absorb-summary');
  if (manifest.work_type !== 'feature') {
    throw new Error(`render absorb-summary: "${workUnit}" is not a feature — only features absorb into epics`);
  }
  if (!isFilled(args.into)) throw new Error('render absorb-summary: --into is required — the target epic');
  if (!isFilled(args.topic)) throw new Error('render absorb-summary: --topic is required — the landing topic name');
  const discussion = itemOf(manifest, 'discussion', workUnit);
  if (!discussion || typeof discussion !== 'object' || typeof discussion.status !== 'string') {
    throw new Error(`render absorb-summary: feature "${workUnit}" has no discussion — nothing to absorb`);
  }
  const series = itemOf(manifest, 'experiment', workUnit);
  const experiments = series && typeof series === 'object'
    ? Object.keys(series.experiments || {}).filter((id) => isParentExperimentId(id)).length
    : 0;
  return absorbSummary(workUnit, /** @type {string} */ (args.into), /** @type {string} */ (args.topic), {
    discussion: discussion.status,
    experiments,
    seeds: Array.isArray(manifest.seeds) ? manifest.seeds.length : 0,
    ...absorbedMaterial(cwd, workUnit),
  });
}

/** @param {string} cwd @param {{dotpath: string, topic?: string, moved?: string, experiments?: string, renamed?: string, warn?: string}} args @returns {string} */
function absorbReceiptSurface(cwd, args) {
  const { manifest, workUnit } = resolveWorkUnit(cwd, args.dotpath, 'absorb-receipt');
  if (manifest.work_type !== 'epic') {
    throw new Error(`render absorb-receipt: "${workUnit}" is not an epic`);
  }
  const topic = args.topic;
  if (!topic) throw new Error('render absorb-receipt: --topic is required');
  if (!itemOf(manifest, 'discussion', topic)) {
    throw new Error(`render absorb-receipt: no discussion item "${topic}" on "${workUnit}" — the absorb has not run`);
  }
  const moved = (args.moved || '').split(',').map((s) => s.trim()).filter(Boolean);
  const unknown = moved.filter((m) => !Object.hasOwn(ABSORB_MOVED, m));
  if (unknown.length > 0) {
    throw new Error(`render absorb-receipt: --moved entries must be ${Object.keys(ABSORB_MOVED).join(', ')}, got "${unknown.join(', ')}"`);
  }
  let experiments = 0;
  if (args.experiments !== undefined) {
    experiments = Number(args.experiments);
    if (!Number.isInteger(experiments) || experiments < 1) {
      throw new Error(`render absorb-receipt: --experiments must be a positive experiment count, got "${args.experiments}"`);
    }
    if (!itemOf(manifest, 'experiment', topic)) {
      throw new Error(`render absorb-receipt: no experiment series "${topic}" on "${workUnit}" — the receipt renders what the absorb moved`);
    }
  }
  const renamed = (args.renamed || '').split(',').map((s) => s.trim()).filter(Boolean).map((pair) => {
    const [from, to, ...extra] = pair.split(':');
    if (!from || !to || extra.length > 0) {
      throw new Error(`render absorb-receipt: --renamed entries are <from>:<to> pairs, got "${pair}"`);
    }
    return { from, to };
  });
  return absorbReceipt(workUnit, topic, moved, { warn: args.warn === '1', experiments, renamed });
}

/** @param {string} cwd @param {{dotpath: string, feature?: string}} args @returns {string} */
function absorbContinuationSurface(cwd, args) {
  const { manifest, workUnit } = resolveWorkUnit(cwd, args.dotpath, 'absorb-continuation');
  if (manifest.work_type !== 'epic') {
    throw new Error(`render absorb-continuation: "${workUnit}" is not an epic — the absorb has not run`);
  }
  if (!isFilled(args.feature)) {
    throw new Error("render absorb-continuation: --feature is required — the absorbed feature's name");
  }
  return absorbContinuationMenu(/** @type {string} */ (args.feature), workUnit);
}

// import-reprompt — the re-prompt after a landing refused on `missing_imports`.
// No address: the refusal names paths, and the work unit it was aimed at may
// not exist yet (the work-type commit's own landing refuses before creation).

/** @param {string} cwd @param {Record<string, string|undefined>} args @returns {string} */
function importRepromptSurface(cwd, { file }) {
  if (!file) throw new Error('render import-reprompt: --file <payload.json> is required');
  const p = readJsonPayload(cwd, file, 'import-reprompt');
  if (!Array.isArray(p.missing) || p.missing.length === 0) {
    throw new Error('render import-reprompt: "missing" must be a non-empty array of the refused paths');
  }
  p.missing.forEach((/** @type {unknown} */ m, /** @type {number} */ i) => {
    if (!isFilled(m)) throw new Error(`render import-reprompt: missing[${i}] must be a non-empty string`);
  });
  return importReprompt(p.missing);
}

/** @param {string} cwd @param {{dotpath: string}} args @returns {string} */
function pivotContinuation(cwd, args) {
  const { manifest, workUnit } = resolveWorkUnit(cwd, args.dotpath, 'pivot-continuation');
  if (manifest.work_type !== 'epic') {
    throw new Error(`render pivot-continuation: "${workUnit}" is not an epic — the pivot has not run`);
  }
  return pivotContinuationMenu(workUnit);
}

// ---------------------------------------------------------------------------
// Manage-flow gates — scoped selections the manage sub-flows fetch at their
// own gate, computed fresh from the same detail the manage snapshot reads.
// ---------------------------------------------------------------------------

/** @param {string} cwd @param {{dotpath: string}} args @returns {string} */
function absorbTarget(cwd, args) {
  const { workUnit } = resolveWorkUnit(cwd, args.dotpath, 'absorb-target');
  const md = manageDetail(cwd, workUnit);
  if (!md) throw new Error(`render absorb-target: work unit "${workUnit}" not found`);
  if (!md.absorb_available) {
    throw new Error(`render absorb-target: "${workUnit}" is not absorbable — the guard (discussion, no spec-or-beyond, an in-progress epic) does not hold`);
  }
  return absorbTargetMenu(md);
}

/** @param {string} cwd @param {{dotpath: string}} args @returns {string} */
function absorbConfirmGateSurface(cwd, args) {
  const { workUnit } = resolveWorkUnit(cwd, args.dotpath, 'absorb-confirm-gate');
  const md = manageDetail(cwd, workUnit);
  if (!md) throw new Error(`render absorb-confirm-gate: work unit "${workUnit}" not found`);
  if (!md.absorb_available) {
    throw new Error(`render absorb-confirm-gate: "${workUnit}" is not absorbable — the guard (discussion, no spec-or-beyond, an in-progress epic) does not hold`);
  }
  return absorbConfirmGate();
}

// ---------------------------------------------------------------------------
// Archived-store gates — the sub-view's menus over one archived item,
// resolved by its store path so the title on the label is the file's own.
// ---------------------------------------------------------------------------

/**
 * @param {string} cwd @param {{dotpath: string, path?: string}} args @param {string} surface
 * @returns {import('./inbox-set.cjs').PickupItem}
 */
function resolveArchivedItem(cwd, { path: given }, surface) {
  if (!isFilled(given)) throw new Error(`render ${surface}: --path is required — the selected archived item`);
  try {
    return archivedItem(cwd, /** @type {string} */ (given));
  } catch (err) {
    throw new Error(`render ${surface}: ${/** @type {Error} */ (err).message}`);
  }
}

/** @param {string} cwd @param {{dotpath: string, path?: string}} args @returns {string} */
function archivedActionsSurface(cwd, args) {
  return archivedActions(resolveArchivedItem(cwd, args, 'archived-actions'));
}

/** @param {string} cwd @param {{dotpath: string, path?: string}} args @returns {string} */
function archivedDeleteGateSurface(cwd, args) {
  return archivedDeleteGate(resolveArchivedItem(cwd, args, 'archived-delete-gate'));
}

// The inbox surfaces over several items take their paths comma-joined, the
// shape the inbox seeds take.
/** @param {string|undefined} given @param {string} surface @param {string} what @returns {string[]} */
function inboxPathsArg(given, surface, what) {
  if (!isFilled(given)) throw new Error(`render ${surface}: --path is required — ${what}`);
  return /** @type {string} */ (given).split(',');
}

// inbox-content — inbox items in full, live or archived, in the order given;
// each file's content as written, its frontmatter skipped.
/** @param {string} cwd @param {{dotpath: string, path?: string}} args @returns {string} */
function inboxContentSurface(cwd, args) {
  const paths = inboxPathsArg(args.path, 'inbox-content', 'the inbox items to show, comma-joined');
  /** @type {import('./inbox-set.cjs').PickupItem[]} */
  let items;
  try {
    items = inboxItems(cwd, paths);
  } catch (err) {
    throw new Error(`render inbox-content: ${messageOf(err)}`);
  }
  return inboxContent(items.map((item) => {
    const { lines, bodyStart } = sourceLines(fs.readFileSync(item.path, 'utf8'));
    return { item, body: lines.slice(bodyStart).join('\n').replace(/^\n+/, '').trimEnd() };
  }));
}

/**
 * The single-item receipts after the archived sub-view acts, over the path
 * the verb answered: a restore's item must be live again, and a delete's
 * gone from the archive — its title read from git's last copy.
 * @param {string} cwd @param {{dotpath: string, path?: string}} args
 * @param {string} surface @param {string} what @param {(cwd: string, given: string) => string} titleAt
 * @returns {string}
 */
function receiptTitle(cwd, { path: given }, surface, what, titleAt) {
  if (!isFilled(given)) throw new Error(`render ${surface}: --path is required — ${what}`);
  try {
    return titleAt(cwd, /** @type {string} */ (given));
  } catch (err) {
    throw new Error(`render ${surface}: ${messageOf(err)}`);
  }
}

/** @param {string} cwd @param {{dotpath: string, path?: string}} args @returns {string} */
function inboxRestoreReceiptSurface(cwd, args) {
  return inboxRestoreReceipt(receiptTitle(cwd, args, 'inbox-restore-receipt', 'the live path `inbox restore` answered',
    (root, given) => liveItem(root, given).title));
}

/** @param {string} cwd @param {{dotpath: string, path?: string}} args @returns {string} */
function inboxDeleteReceiptSurface(cwd, args) {
  return inboxDeleteReceipt(receiptTitle(cwd, args, 'inbox-delete-receipt', 'the archived path `inbox delete` answered', deletedItemTitle));
}

// completed-actions — the completed & cancelled view's action menu over the
// selected unit, its status read where the list read it. An active unit
// refuses: the list it is picked from holds closed units alone.

/** @param {string} cwd @param {{dotpath: string}} args @returns {string} */
function completedActionsSurface(cwd, args) {
  const { workUnit, manifest } = resolveWorkUnit(cwd, args.dotpath, 'completed-actions');
  if (manifest.status !== 'completed' && manifest.status !== 'cancelled') {
    throw new Error(`render completed-actions: "${workUnit}" is not completed or cancelled (status: ${manifest.status ?? 'none'})`);
  }
  return completedActions(workUnit, manifest.status);
}

/** @param {string} cwd @param {{dotpath: string}} args @returns {string} */
function revisitPhasesSurface(cwd, args) {
  const { manifest, workUnit } = resolveWorkUnit(cwd, args.dotpath, 'revisit-phases');
  const type = manifest.work_type;
  if (!WORK_UNIT_TYPES[type]) {
    throw new Error(`render revisit-phases: "${workUnit}" is ${type ? `typed "${type}"` : 'untyped'} — the revisit menu serves the linear work types`);
  }
  const { next_phase } = computeNextPhase(manifest);
  const targets = phaseTargets(cwd, manifest, next_phase).revisit;
  if (targets.length === 0) {
    throw new Error(`render revisit-phases: "${workUnit}" has no completed earlier phase to revisit`);
  }
  return revisitPhasesSection(targets);
}

// ---------------------------------------------------------------------------
// The roadmap surfaces — project-level, no address. Each handler resolves
// the derived roadmap state (domain/roadmap.cjs — lifecycle by join, never
// stored), refuses states the calling prose never reaches, and hands the
// pure projection its detail. The pull working set and the proposal overlay
// are gateway views (they carry DATA the flow resolves numbers through), not
// render surfaces.
// ---------------------------------------------------------------------------

/** @param {string} cwd @param {object} _args @returns {string} */
function roadmapViewSurface(cwd, _args) {
  const state = roadmapState(cwd);
  if (!state.exists) {
    throw new Error('render roadmap-view: no roadmap on the project manifest — it is born at the first park, add, or session');
  }
  return section('DISPLAY: roadmap', emitAs('text'), roadmapMapView(state));
}

/**
 * @param {string} cwd @param {Record<string, string|undefined>} args
 * @returns {string} DATA + MENU, or '' where the add passes — no member of
 *   the horizon in an epic underway, the roadmap and the horizon unborn among them
 */
function roadmapAddGateSurface(cwd, args) {
  if (!args.horizon) throw new Error('render roadmap-add-gate: --horizon is required');
  const gate = roadmapAddGate(roadmapState(cwd), args.horizon);
  if (!gate) return '';
  return [
    dataSection([`work_units: ${gate.units.join(', ')}`]),
    section('MENU: roadmap add gate', MENU_INSTRUCTION, gate.menu),
  ].join('\n');
}

/**
 * The address of a topic leaving for the roadmap, checked as the postpone
 * gate reads it, naming the topic by its key.
 * @param {string} cwd @param {string} dotpath @returns {string}
 */
function postponeAddress(cwd, dotpath) {
  const { workUnit, phase, topic } = resolveAddress(cwd, dotpath, 'horizon-pick');
  if (phase !== 'discovery') {
    throw new Error(`render horizon-pick: address must be <work_unit>.discovery.<topic>, got phase "${phase}"`);
  }
  return `${workUnit}.${phase}.${topic}`;
}

/**
 * The pick over the roadmap's horizons, naming none as its own (18.8.2).
 * Addressed to a topic leaving for the roadmap, `<wu>.discovery.<topic>`,
 * each horizon's row leads to that topic's postpone gate; a new horizon,
 * named in words, carries on. With `--park <name>`, it asks where an item
 * Claude is putting on the roadmap goes, saying so above the question
 * (18.8.11), and every row carries on with the horizon picked.
 * @param {string} cwd @param {{dotpath?: string, park?: string}} args @returns {string}
 */
function horizonPick(cwd, { dotpath, park }) {
  if (park !== undefined && dotpath !== undefined) throw new Error('render horizon-pick: --park names the item being put on the roadmap, and takes no address');
  const postponing = dotpath === undefined ? null : postponeAddress(cwd, dotpath);
  const state = roadmapState(cwd);
  if (!state.exists) {
    throw new Error('render horizon-pick: no roadmap on the project manifest — the caller names its first horizon in prose');
  }
  if (state.horizons.length === 0) {
    throw new Error('render horizon-pick: the roadmap holds no horizons — the caller names one in prose');
  }
  /** @type {import('./projections/surfaces.cjs').Next|undefined} */
  const carryOn = postponing === null && park === undefined ? undefined : { kind: 'continue' };
  const options = state.horizons.map((horizon, i) => {
    const waiting = state.items.filter((r) => r.horizon === horizon && r.state === 'waiting').length;
    const next = postponing === null ? carryOn : { kind: /** @type {const} */ ('engine'), argv: ['render', 'postpone-gate', postponing, '--horizon', horizon] };
    return cmdOption(String(i + 1), null, { head: horizon, tail: `${waiting} waiting` }, { next });
  });
  options.push(cmdOption('n', 'new', 'A new horizon — name it', carryOn === undefined ? {} : { next: carryOn }));
  const putting = park === undefined ? '' : `Putting "${titlecase(park)}" on the roadmap.`;
  return section('MENU: horizon pick', MENU_INSTRUCTION, menu(putting, options, { question: 'Which horizon?' }));
}

// ` (new)` for a horizon an existing map does not hold yet; a never-born map
// says its own birth instead.
/** @param {{exists: boolean, horizons: string[]}} roadmap @param {string} horizon */
function horizonFlag(roadmap, horizon) {
  return roadmap.exists && !roadmap.horizons.includes(horizon) ? ' (new)' : '';
}

/**
 * The confirm before inbox items move onto the roadmap, over the very file
 * `roadmap add-batch` takes — every entry with a note, all under one
 * horizon. add-batch's own plan runs as a dry run, so the gate refuses
 * exactly where the verb would; each item shows its name, the kind its
 * note's folder gives it where not an idea, and its summary.
 * @param {string} cwd @param {Record<string, string|undefined>} args @returns {string}
 */
function inboxRoadmapGate(cwd, { file }) {
  if (!file) throw new Error('render inbox-roadmap-gate: --file <entries.json> is required');
  const entries = readJsonPayload(cwd, file, 'inbox-roadmap-gate');
  /** @type {ReturnType<typeof planRoadmapBatch>} */
  let plan;
  try {
    if (Array.isArray(entries) && entries.some((e) => !e || e.note === undefined)) {
      throw new Error('every entry names its inbox note');
    }
    plan = planRoadmapBatch(cwd, entries);
  } catch (err) {
    throw new Error(`render inbox-roadmap-gate: ${err instanceof Error ? err.message : String(err)}`);
  }
  const items = plan.entries;
  const horizon = items[0].horizon;
  if (items.some((item) => item.horizon !== horizon)) {
    throw new Error('render inbox-roadmap-gate: every entry goes under the one horizon');
  }
  const one = items.length === 1;
  const statement = [
    `Putting ${one ? 'this' : 'these'} on the roadmap under "${horizon}"${horizonFlag(plan, horizon)}, waiting until ${one ? 'it is' : 'each is'} pulled into work — ${one ? 'its note leaves' : 'their notes leave'} the inbox with ${one ? 'it' : 'them'}:`,
    '',
    ...items.map((item) => {
      const kind = markedKind(item.kind);
      return `- **${titlecase(item.name)}**${kind ? ` ${tag(kind)}` : ''} — ${item.summary}`;
    }),
    ...(plan.exists ? [] : ['', `The roadmap is created with ${one ? 'it' : 'them'}.`]),
  ].join('\n');
  return section('MENU: inbox roadmap gate', MENU_INSTRUCTION, menu(statement, [
    cmdOption('y', 'yes', `Put ${one ? 'it' : 'them'} on the roadmap`),
    cmdOption('n', 'no', `Leave ${one ? 'it' : 'them'} in the inbox — nothing moves`),
    promptOption('Comment', 'Tell me what to change (name, horizon, or summary)'),
  ], { question: `Put ${one ? 'it' : 'them'} on the roadmap?` }));
}

/** @param {string} cwd @param {Record<string, string|undefined>} args @returns {string} */
function parkGate(cwd, args) {
  const { name, horizon, summary, source, kind = DEFAULT_KIND } = args;
  if (!isFilled(name)) throw new Error('render park-gate: --name is required');
  if (!isFilled(horizon)) throw new Error('render park-gate: --horizon is required');
  if (!isFilled(summary)) throw new Error('render park-gate: --summary is required');
  try {
    validateKind(kind);
  } catch (err) {
    throw new Error(`render park-gate: ${err instanceof Error ? err.message : String(err)}`);
  }
  const taken = addNameRefusal(roadmapItems(loadProjectManifest(cwd)), name);
  if (taken !== null) throw new Error(`render park-gate: ${taken}`);
  const state = roadmapState(cwd);
  const marked = markedKind(/** @type {import('./roadmap.cjs').RoadmapKind} */ (kind));
  const what = marked ? `the ${marked} ` : '';
  const statement = [
    `Parking ${what}**${titlecase(name)}** — ${summary} — puts it on the roadmap under "${horizon}"${horizonFlag(state, horizon)}, waiting until it is pulled into work.`,
    ...(state.exists ? [] : ['The roadmap is created with it.']),
    ...(isFilled(source) ? [`Its source is \`${source}\`.`] : []),
  ].join(' ');
  return section('MENU: park gate', MENU_INSTRUCTION, menu(statement, [
    cmdOption('y', 'yes', 'Park it'),
    cmdOption('n', 'no', 'Leave it — nothing is recorded'),
    promptOption('Comment', 'Tell me what to change (name, kind, horizon, or summary)'),
  ], { question: 'Park it on the roadmap?' }));
}

// The static roadmap gate menus — no state to resolve; served as surfaces
// because every menu is engine-rendered, fetched at the point it displays.

/** @param {string} _cwd @param {object} _args @returns {string} */
function roadmapHarvestGateSurface(_cwd, _args) {
  return section('MENU: roadmap harvest gate', MENU_INSTRUCTION, roadmapHarvestGate());
}

/** @param {string} _cwd @param {object} _args @returns {string} */
function roadmapParksGateSurface(_cwd, _args) {
  return section('MENU: roadmap parks gate', MENU_INSTRUCTION, roadmapParksGate());
}

// The cross-flow static gates — adopted engine-side as their files were
// touched (menus are engine-rendered, static sets included). Wording is
// the gates' own; each is fetched at the exact point it displays.

/**
 * leeway's migration summary — the payload is the session's summary,
 * the notices the run handed back for the person, and, where the run updated
 * files, its two counts.
 * @param {string} cwd @param {Record<string, string|undefined>} args @returns {string}
 */
function migrationsAppliedSurface(cwd, { file }) {
  if (!file) throw new Error('render migrations-applied: --file <payload.json> is required');
  const p = readJsonPayload(cwd, file, 'migrations-applied');
  if (!isFilled(p.summary)) throw new Error('render migrations-applied: "summary" must be a non-empty string');
  const notices = p.notices ?? [];
  if (!Array.isArray(notices) || !notices.every(isFilled)) {
    throw new Error('render migrations-applied: "notices" must be a list of non-empty strings');
  }
  const given = ['migrations', 'files'].filter((key) => p[key] !== undefined);
  if (given.length === 1) {
    throw new Error('render migrations-applied: "migrations" and "files" come together — both counts, or neither where the run updated no file');
  }
  for (const key of given) {
    if (!Number.isInteger(p[key]) || p[key] < 1) throw new Error(`render migrations-applied: "${key}" must be a positive integer`);
  }
  return migrationsApplied({
    summary: p.summary.trim(),
    notices: notices.map((notice) => notice.trim()),
    counts: given.length ? { migrations: p.migrations, files: p.files } : null,
  });
}

/**
 * Boot's `repo` stop, naming the folder it was called from; refused where
 * that folder is in a repository, as nothing stopped boot.
 * @param {string} cwd @returns {string}
 */
function repoStopSurface(cwd) {
  const folder = path.resolve(cwd);
  if (!outsideRepository(folder)) throw new Error(`render repo-stop: ${folder} is in a git repository — nothing stopped boot`);
  return repoStop(folder);
}

/**
 * A command's error output beneath a callout heading: each line two columns
 * in, keeping its own indentation, wrapped at the display width.
 * @param {string} output @returns {string[]}
 */
function errorOutputLines(output) {
  const lines = output.replace(/\s+$/, '').split('\n').map((l) => l.trimEnd());
  while (lines.length > 0 && lines[0] === '') lines.shift();
  return lines.flatMap((line) => {
    if (line === '') return [''];
    const own = /** @type {RegExpMatchArray} */ (line.match(/^\s*/))[0];
    return indentedBody([line.slice(own.length)], { indent: `  ${own}` });
  });
}

/**
 * The knowledge query-failure gate — the failed query's error output and how
 * to diagnose it, then retry or proceed without context.
 * @param {string} cwd @param {Record<string, string|undefined>} args @returns {string}
 */
function queryFailureGateSurface(cwd, { file }) {
  if (!file) throw new Error('render query-failure-gate: --file <payload.json> is required');
  const p = readJsonPayload(cwd, file, 'query-failure-gate');
  if (!isFilled(p.error)) throw new Error('render query-failure-gate: "error" must be the query\'s error output, a non-empty string');
  const display = section('DISPLAY: query failure', emitAs('text', ', directly above the menu'), [
    '⚑ Knowledge query failed',
    ...errorOutputLines(p.error),
    '',
    ...indentedBody(["Likely causes: a knowledge config that can't be read or names a provider it can't use, or a store that can't be read or has lost its metadata. Run this to diagnose:"]),
    '',
    `    ${ENGINE_COMMAND} knowledge status`,
  ].join('\n'));
  const gate = section('MENU: query failure gate', MENU_INSTRUCTION, menu('', [
    cmdOption('r', 'retry', "I'll fix the issue; retry the query"),
    cmdOption('s', 'skip', 'Proceed without knowledge context for this phase'),
  ], { question: 'How should I proceed?' }));
  return [display, gate].join('\n');
}

// ---------------------------------------------------------------------------
// The brownfield offer — project-level, no address, drawn only while the
// offer is unanswered (domain/brownfield.cjs).
// ---------------------------------------------------------------------------

/** @param {string} cwd @returns {string} */
function brownfieldOfferGateSurface(cwd) {
  const answer = brownfieldOffer(cwd);
  if (answer !== 'none') throw new Error(`render brownfield-offer-gate: the offer's answer is "${answer}" — the offer is made once, while nothing is recorded`);
  return brownfieldOfferGate();
}

// ---------------------------------------------------------------------------
// The walkthrough surfaces — project-level, no address, no state. A screen is
// a content file, so the only things to resolve are which screen and where
// the walk was entered from; the recorded answer drives the offer alone, and
// no surface reads it.
// ---------------------------------------------------------------------------

/**
 * leeway's one-time offer, standing before the walk. `--menu-only`
 * serves the return from a question.
 * @param {string} _cwd @param {Record<string, string|undefined>} args @returns {string}
 */
function walkthroughOfferSurface(_cwd, args) {
  return walkthroughOffer(Boolean(args['menu-only']));
}

/**
 * One screen of the walk. `--from` carries the caller, which is what varies
 * the exits: a first run can skip to the start menu, a walk opened from help
 * goes back to it. `--menu-only` serves the return from a question — the
 * screen is already on the reader's terminal.
 * @param {string} _cwd @param {Record<string, string|undefined>} args @returns {string}
 */
function walkthroughScreenSurface(_cwd, args) {
  const origin = args.from;
  if (origin === undefined || !WALKTHROUGH_ORIGINS.includes(origin)) {
    throw new Error(`render walkthrough-screen: --from must be one of ${WALKTHROUGH_ORIGINS.join(', ')}, got "${origin ?? ''}"`);
  }
  return walkthroughScreen(loadScreen(args.screen), origin, Boolean(args['menu-only']));
}

/** @param {string} _cwd @param {object} _args @returns {string} */
function walkthroughHomeSurface(_cwd, _args) {
  return walkthroughHome();
}

/** @param {string} _cwd @param {object} _args @returns {string} */
function walkthroughTopicsSurface(_cwd, _args) {
  return walkthroughTopics();
}

/**
 * One reference card, addressed by the slug the topics menu's DATA table
 * gives for the number the reader pressed. `--menu-only` serves the card's
 * menu alone, fetched by the help flow where it shows it.
 * @param {string} _cwd @param {Record<string, string|undefined>} args @returns {string}
 */
function walkthroughTopicSurface(_cwd, args) {
  return walkthroughTopic(loadCard(args.name), Boolean(args['menu-only']));
}

// The flags each knowledge gate variant takes: the reuse variant's system
// configuration (its yes row names it), the retry variant's provider (whose
// missing key its display says how to store). Every other variant takes none.
/** @type {Record<string, string[]>} */
const KNOWLEDGE_GATE_FLAGS = { reuse: ['provider', 'model'], retry: ['provider'] };

/**
 * leeway's knowledge gate menus. A reuse provider stands without a
 * model (the provider defaults it); a model without a provider names
 * nothing. The retry variant names the provider its key is for.
 * @param {string} _cwd @param {Record<string, string|undefined>} args @returns {string}
 */
function knowledgeGateSurface(_cwd, { variant, provider, model }) {
  if (variant === undefined || !KNOWLEDGE_GATE_VARIANTS.includes(variant)) {
    throw new Error(`render knowledge-gate: --variant must be one of ${KNOWLEDGE_GATE_VARIANTS.join(', ')}, got "${variant ?? ''}"`);
  }
  const takes = KNOWLEDGE_GATE_FLAGS[variant] ?? [];
  const stray = Object.entries({ provider, model }).find(([flag, value]) => value !== undefined && !takes.includes(flag));
  if (stray) {
    throw new Error(`render knowledge-gate: --${stray[0]} does not belong to the ${variant} variant — --provider/--model name the reuse variant's configuration, --provider the retry variant's key`);
  }
  if (variant === 'retry' && !KEY_PROVIDERS.includes(provider ?? '')) {
    throw new Error(`render knowledge-gate: the retry variant needs --provider ${KEY_PROVIDERS.join('|')} — the provider whose key the setup could not find, got "${provider ?? ''}"`);
  }
  if (isFilled(model) && !isFilled(provider)) {
    throw new Error('render knowledge-gate: --model names nothing without --provider — the provider is the configuration, the model rides with it');
  }
  return knowledgeGate(variant, { provider, model });
}

/**
 * The knowledge gate's closing line, read from this checkout's store
 * metadata — the configuration the store was built with.
 * @param {string} cwd @returns {string}
 */
function knowledgeReadySurface(cwd) {
  const file = knowledgeFiles(stateRoot(cwd)).metadata;
  if (!fs.existsSync(file)) {
    throw new Error(`render knowledge-ready: no ${file} — this checkout has no knowledge store yet`);
  }
  let metadata;
  try {
    metadata = readMetadata(file);
  } catch (err) {
    throw new Error(`render knowledge-ready: ${file} is not valid JSON — ${messageOf(err)}`);
  }
  return knowledgeReady(metadata);
}

/** The catalogue: surface name → handler. @type {Record<string, (cwd: string, args: {dotpath: string} & Record<string, string|undefined>) => string>} */
const SURFACES = {
  'backlog-gate': backlogGate,
  'candidate-gate': candidateGate,
  'send-closed-target': sendClosedTarget,
  'experiment-register': experimentRegisterSurface,
  'experiment-approval-gate': experimentApprovalGateSurface,
  'experiment-pick': experimentPickSurface,
  'experiment-next-gate': experimentNextGateSurface,
  'experiment-spawn-gate': experimentSpawnGateSurface,
  'summary-backfill-gate': summaryBackfillGate,
  'phase-completed': phaseCompleted,
  'phase-note': phaseNote,
  'cancel-gate': cancelGate,
  'postpone-gate': postponeGate,
  'workunit-receipt': workunitReceiptSurface,
  'topic-receipt': topicReceiptSurface,
  'absorb-summary': absorbSummarySurface,
  'absorb-receipt': absorbReceiptSurface,
  'absorb-continuation': absorbContinuationSurface,
  'import-reprompt': importRepromptSurface,
  'pivot-continuation': pivotContinuation,
  'absorb-target': absorbTarget,
  'absorb-confirm-gate': absorbConfirmGateSurface,
  'archived-actions': archivedActionsSurface,
  'archived-delete-gate': archivedDeleteGateSurface,
  'inbox-content': inboxContentSurface,
  'inbox-restore-receipt': inboxRestoreReceiptSurface,
  'inbox-delete-receipt': inboxDeleteReceiptSurface,
  'completed-actions': completedActionsSurface,
  'revisit-phases': revisitPhasesSurface,
  'roadmap-view': roadmapViewSurface,
  'roadmap-add-gate': roadmapAddGateSurface,
  'horizon-pick': horizonPick,
  'park-gate': parkGate,
  'inbox-roadmap-gate': inboxRoadmapGate,
  'roadmap-harvest-gate': roadmapHarvestGateSurface,
  'roadmap-parks-gate': roadmapParksGateSurface,
  'query-failure-gate': queryFailureGateSurface,
  'brownfield-offer-gate': brownfieldOfferGateSurface,
  'walkthrough-offer': walkthroughOfferSurface,
  'walkthrough-screen': walkthroughScreenSurface,
  'walkthrough-home': walkthroughHomeSurface,
  'walkthrough-topics': walkthroughTopicsSurface,
  'walkthrough-topic': walkthroughTopicSurface,
  'migrations-applied': migrationsAppliedSurface,
  'migration-gate': () => migrationGate(),
  'state-lost-gate': (cwd) => stateLostGate(projectName(cwd)),
  'git-floor-stop': () => gitFloorStopSurface(),
  'repo-stop': repoStopSurface,
  'github-rule-gate': (cwd) => githubRuleGate(projectName(cwd)),
  'github-squash-gate': (cwd) => githubSquashGate(projectName(cwd), githubSquashNested(cwd)),
  'label-gate': () => labelGate(),
  'knowledge-gate': knowledgeGateSurface,
  'knowledge-ready': knowledgeReadySurface,
  'state-merge-gate': stateMergeGateSurface,
  'ledger-stop': ledgerStopSurface,
  'directive-stop': directiveStopSurface,
  'send-report': (cwd, { dotpath, sent }) => sendReportOf(cwd, dotpath, sent),
  'map': mapSurface,
  'decided': decidedSurface,
  'decided-strike': decidedStrikeSurface,
  'wait-agents': waitAgentsSurface,
  'start-this-work': startThisWorkSurface,
  'approve-map': approveMapSurface,
  'discovery-map': discoveryMapSurface,
  'approve-map-strike': approveMapStrikeSurface,
  'ready-to-build': readyToBuildSurface,
  'build-headline': buildHeadlineSurface,
  'task-landed': taskLandedSurface,
  'task-account': taskAccountSurface,
  'step-gate': stepGateSurface,
  'phase-merge-gate': phaseMergeGateSurface,
  'build-stop': buildStopSurface,
  'build-progress': buildProgressSurface,
  'review-report': reviewReportSurface,
  'review-calls': reviewCallsSurface,
  'review-tree': reviewTreeSurface,
  'finish': finishSurface,
  'investigation-plan': investigationPlanSurface,
  'investigation-check-in': investigationCheckInSurface,
  'conclude': concludeSurface,
  'help': (_cwd, { dotpath, item, ...flags }) => helpSurface(dotpath, { arg: item, flags }),
  'verdicts': (cwd, { unit }) => verdictsSurface(cwd, unit ?? null),
  'start-menu': (cwd) => startMenuSurface(cwd),
};

/**
 * Dispatch a surface render.
 * @param {string} cwd @param {string} surface @param {{dotpath: string} & Record<string, string|undefined>} args
 * @returns {string}
 */
function renderSurface(cwd, surface, args) {
  const handler = SURFACES[surface];
  if (!handler) {
    throw new Error(`render: unknown surface "${surface}" (surfaces: ${Object.keys(SURFACES).join(', ')})`);
  }
  return handler(cwd, args);
}

module.exports = { renderSurface, SURFACES };
