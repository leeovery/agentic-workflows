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
// things beside. `map` moves the last-looked mark as
// it draws, since the map shown in the conversation is the person looking
// (5.8.14). `decided --file` stages Claude's payload in the topic's cache,
// what the gate's yes lands (decided.cjs); `start-this-work --file` and
// `approve-map --file` stage theirs in discovery's cache the same way
// (start-this-work.cjs, approve-map.cjs), and `conclude --file` the recap in
// the investigation's (investigation-conclude.cjs). A menu leaves the
// conversation's position where its registry says (menus.cjs).

const fs = require('fs');
const path = require('path');
const { loadManifest, loadProjectManifest } = require('./reads.cjs');
const { titlecase } = require('./conventions.cjs');
const { section, dataSection, menu, cmdOption, promptOption, MENU_INSTRUCTION } = require('./projections/surfaces.cjs');
const { quickFixBranch } = require('./landing-names.cjs');
const { mayHoldOpen } = require('./landing.cjs');
const { topicReceipt, importReprompt } = require('./projections/transactions.cjs');
const { brownfieldOffer } = require('./brownfield.cjs');
const {
  ORIGINS: WALKTHROUGH_ORIGINS, loadScreen, loadCard, walkthroughOffer, walkthroughScreen, walkthroughTopic,
} = require('./projections/walkthrough.cjs');
const { helpTopicsSurface } = require('./projections/help-topics.cjs');
const { migrationsApplied, migrationGate, stateLostGate, repoStop, migrationGuardStop, migrationChecksStop, githubRuleGate, githubSquashGate, labelGate, brownfieldOfferGate, banner, workPick, knowledgeGate, knowledgeAsk, knowledgeReady, knowledgeNotDone, KEY_PROVIDERS } = require('./projections/boot.cjs');
const { readiness } = require('./knowledge/status.cjs');
const { knowledgeFiles } = require('../kernel/knowledge/files.cjs');
const { readMetadata } = require('../kernel/knowledge/store.cjs');
const { detectSystemConfig } = require('./boot.cjs');
const { pickRows } = require('./boot-route.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { githubSquashNested } = require('./github-setup.cjs');
const { multiplexerHere } = require('./session-label.cjs');
const { roadmapState, hasRoadmapNode } = require('./roadmap.cjs');
const { putBackBy, stillToAsk, thenArgs, ontoMenu } = require('./topic-leave.cjs');
const { roadmapSurface, roadmapHarvestSurface } = require('./projections/roadmap.cjs');
const { experimentRegister, experimentApprovalGate, experimentNextGate, experimentSpawnGate } = require('./projections/experiment.cjs');
const { seriesRows, liveRecords } = require('./experiment-entry.cjs');
const { EXPERIMENT_SPAWN_PHASES, TOPIC_PHASES, assertLegalName } = require('../kernel/manifest-schema.cjs');
const {
  computeTopicLifecycle, awaitedExperiments, itemOf,
  UNIT_PHASES, discoveryUnitExists, cancelPlan, unitOpenRecords,
  postponePlan, postponeTarget, openExperiments,
  topicTitle, topicTitles, goesBy, dismissedNames, topicKey, noTopicRefusal, briefFile, buildDiscoveryMap, quickFixBuild, fixesBegun,
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
const decisionPoint = require('./decision-point.cjs');
const { reviewReportSurface, reviewCallsSurface } = require('./review-round.cjs');
const { reviewTreeSurface } = require('./review-tree.cjs');
const { finishSurface } = require('./finish.cjs');
const { discoveryMapScreen } = require('./projections/discovery-map.cjs');
const { stateRoot, statePath, outsideRepository } = require('../kernel/state-root.cjs');
const { stateMergeGateSurface } = require('./state-merge.cjs');
const { ledgerStopSurface } = require('./ledger.cjs');
const { directiveStopSurface, takenStopSurface, leavingSurface } = require('./directives.cjs');
const { finishing } = require('./migration-commit.cjs');
const { OLD_STATE } = require('../../../ledger-migrate/scripts/old-layout.cjs');
const { gitFloorStopSurface } = require('./git-floor.cjs');
const { projectName } = require('./state-checks.cjs');
const { helpSurface } = require('./projections/help.cjs');
const { verdictsSurface } = require('./verdict.cjs');
const { startMenuSurface } = require('./projections/start-menu.cjs');
const { epicMenuSurface } = require('./projections/epic-menu.cjs');
const { manageSurface, manageUnitSurface, closedSurface, absorbTargetSurface, absorbConfirmSurface } = require('./projections/manage.cjs');
const { triageSurface, archivedSurface, archivedItemSurface, archivedDeleteGateSurface } = require('./projections/triage.cjs');
const { careSurface, careKindSurface, careDropSurface } = require('./person-verbs.cjs');
const { convergenceSurface } = require('./convergence.cjs');
const { matrixSurface, replaySurface } = require('./trust-verbs.cjs');
const { environmentSetupSurface } = require('./environment-verbs.cjs');
const { driversSurface } = require('./drivers-verbs.cjs');

/** @typedef {import('./projections/surfaces.cjs').Next} Next */

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
// The discovery-map surfaces. A closed send target stops with the proposal
// above, the confirm beneath. Judgment supplies the names and values; the
// bodies, the questions and the option sets are fixed here, so a gate reads
// the same whichever flow raised it and at any width.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// The experiment surfaces — the laboratory's gates over one topic's series
// (projections/experiment.cjs renders; the handlers resolve the item and
// refuse states the calling prose never reaches). Address-backed: the
// series lives on the manifest (`experiments.{id}` records), never in a
// hand-maintained file. The pick is the laboratory's entry's
// (experiment-entry.cjs).
// ---------------------------------------------------------------------------

/**
 * Resolve an experiment address to its series rows in register order. A
 * loud error when the phase is wrong or the topic holds no series.
 * @param {string} cwd @param {string} dotpath @param {string} surface
 * @returns {{workUnit: string, topic: string, manifest: Record<string, any>, rows: import('./projections/experiment.cjs').SeriesRow[]}}
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
  return { workUnit, topic, manifest, rows: seriesRows(manifest, topic) };
}

/**
 * @param {string} cwd
 * @param {{dotpath: string, id?: string}} args
 * @returns {string}
 */
function experimentApprovalGateSurface(cwd, { dotpath, id }) {
  const { workUnit, topic, rows } = resolveExperiment(cwd, dotpath, 'experiment-approval-gate');
  if (!isFilled(id)) throw new Error('render experiment-approval-gate: --id is required (E1, E1.1, …)');
  const record = rows.find((r) => r.id === id);
  if (!record) throw new Error(`render experiment-approval-gate: no experiment ${id} in "${topic}"'s series`);
  if (record.status !== 'designed') {
    throw new Error(`render experiment-approval-gate: ${id} is "${record.status}", not designed — the briefing confirm follows the written design`);
  }
  return experimentApprovalGate({ unit: workUnit, topic, id: /** @type {string} */ (id) });
}

/**
 * The return leg's gate — fetched after a top-level record ended while live
 * records remain, under the register: work the next experiment in this
 * session, its yes the laboratory entered again, or back to the menu.
 * Refuses when no live top-level record exists — the laboratory's leave
 * follows then, never this gate.
 * @param {string} cwd
 * @param {{dotpath: string}} args
 * @returns {string}
 */
function experimentNextGateSurface(cwd, { dotpath }) {
  const { workUnit, topic, manifest, rows } = resolveExperiment(cwd, dotpath, 'experiment-next-gate');
  const live = liveRecords(rows);
  if (live.length === 0) {
    throw new Error(`render experiment-next-gate: "${topic}"'s series holds no live experiments — the laboratory's leave follows a finished series`);
  }
  return experimentRegister(topicTitle(manifest, topic), rows) + experimentNextGate(live, {
    next: { kind: 'engine', argv: ['enter', 'experiment', workUnit, topic] },
    leave: ontoMenu(workUnit, manifest.work_type),
  });
}

/**
 * Resolve an address restricted to a set of phases. Loud on any other.
 * @param {string} cwd @param {string} dotpath @param {string} surface
 * @param {readonly string[]} phases  the phases the surface serves
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
  const step = decisionPoint.gateStep('experiment spawn gate', { cwd, place: { unit: workUnit, phase, topic }, key: id });
  return experimentSpawnGate({ phase, id: /** @type {string} */ (id), unit: workUnit, topic, workType: manifest.work_type }, step);
}

// ---------------------------------------------------------------------------
// Work-unit surfaces — the cancel and postpone gates.
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
  if (plan.records.length > 0) parts.push(abandonedLine([{ name: null, experiments: openExperiments(plan.records) }]));
  return parts.join(' ');
}

/**
 * What a cancel ends on the register, said one way for a topic's cancel and
 * a unit's: its open experiments, a split counted with its parent
 * (`openExperiments`), each topic's named by its title where the cancel
 * spans several.
 * @param {{name: string|null, experiments: string[]}[]} byTopic
 * @returns {string}
 */
function abandonedLine(byTopic) {
  const count = byTopic.reduce((n, { experiments }) => n + experiments.length, 0);
  const one = count === 1;
  const named = byTopic.map(({ name, experiments }) => (name === null ? experiments.join(', ') : `${name}: ${experiments.join(', ')}`)).join('; ');
  return `${count} open experiment${one ? '' : 's'} (${named}) end${one ? 's' : ''} abandoned on the register.`;
}

/**
 * The cancel confirm over one unit — `<wu>.discovery.<topic>` of an epic, or
 * a unit by its bare name — fetched by the epic menu, by a session
 * cancelling its own topic or its unit, and by manage.
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
 * What a unit's cancel does to its code, as its gate says it before the yes
 * (18.3.9): a quick-fix's, once its fixes have begun, its branch kept and
 * each checkout taken off it, its work not committed set aside; any other
 * unit's, its branches kept — each saying its pull requests closed only
 * where one may stand open (landing.cjs, `mayHoldOpen`); null where it
 * says nothing.
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest
 * @returns {string|null}
 */
function cancelCodeLine(cwd, unit, manifest) {
  if (quickFixBuild(manifest)) {
    if (!fixesBegun(manifest)) return null;
    const keeps = `keeps ${quickFixBranch(unit)}, taking each checkout off it, any work not committed set aside and kept.`;
    return mayHoldOpen(cwd, unit) ? `It closes its open pull requests and ${keeps}` : `It ${keeps}`;
  }
  return mayHoldOpen(cwd, unit) ? 'It closes its open pull requests, keeping each branch for a reactivate to carry on from.' : null;
}

/**
 * A unit by its bare name under the cancel gate: the whole unit called off
 * where it stands — a single-topic unit's its one topic, an epic's asked for
 * in a session of the unit, its spec, build or review (18.4.20), or through
 * manage (18.3.4) — what it does to the unit's code said (`cancelCodeLine`),
 * each open experiment record of its ending abandoned (18.4.22), an epic's
 * named by their topics.
 * @param {string} cwd @param {string} dotpath
 * @returns {{statement: string, cancel: string[]}}
 */
function workUnitCancel(cwd, dotpath) {
  const { workUnit, manifest, typeLabel } = resolveWorkUnit(cwd, dotpath, 'cancel-gate');
  if (manifest.status !== 'in-progress') {
    throw new Error(`render cancel-gate: "${workUnit}" is ${manifest.status} — only work in progress is cancelled`);
  }
  const parts = [`Cancelling **${titlecase(workUnit)}** calls off the whole ${typeLabel.toLowerCase()} — it stops where it stands, and can be reactivated later.`];
  const code = cancelCodeLine(cwd, workUnit, manifest);
  if (code !== null) parts.push(code);
  const open = unitOpenRecords(manifest);
  const epic = manifest.work_type === 'epic';
  if (open.length > 0) parts.push(abandonedLine(open.map(({ topic, ids }) => ({ name: epic ? topicTitle(manifest, topic) : null, experiments: openExperiments(ids) }))));
  return { statement: parts.join(' '), cancel: ['workunit', 'cancel', workUnit] };
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
// import-reprompt — the re-prompt after a landing refused on `missing_imports`,
// a learned gate (8.8.12). No address: the refusal names paths, and the work
// unit it was aimed at may not exist yet (the work-type commit's own landing
// refuses before creation), so the decision point steps it at no place, each
// showing told from another by when the place the conversation sits at was
// entered and the paths it names.

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
  return importReprompt(p.missing, decisionPoint.gateStep('import reprompt', { cwd, place: { unit: null, phase: null, topic: null }, key: p.missing }));
}

// ---------------------------------------------------------------------------
// The horizon pick — project-level. It resolves the derived roadmap state
// (domain/roadmap.cjs — lifecycle by join, never stored) and refuses states
// the calling prose never reaches.
// ---------------------------------------------------------------------------

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
 * The pick over the roadmap's horizons, naming none as its own (18.8.2),
 * each with how many wait there, and a new one, named in words; every row
 * carries what answering it leads to, and a pick naming none of the three
 * below is refused. With `--park <name>[,<name>…]` — the items Claude is
 * putting on the roadmap, one or several — it names them above the
 * question (18.8.11), and every row carries on with the horizon picked.
 * Addressed to a topic leaving for the roadmap, `<wu>.discovery.<topic>`,
 * each horizon's row leads to that topic's postpone gate, and a new horizon
 * carries on. With `--back <name> --from <what put it back> [--then
 * <items>]`, it asks where an item a cancel or a removal put back on no
 * horizon goes (18.8.20): each horizon's row moves it there, `roadmap move
 * … --from`, the items still to ask about carried on, whose answer leads on
 * (topic-leave.cjs), and a horizon named in words is moved the same way, as
 * its DATA says.
 * @param {string} cwd @param {{dotpath?: string, park?: string, back?: string, from?: string, then?: string}} args @returns {string}
 */
function horizonPick(cwd, { dotpath, park, back, from, then }) {
  if (back !== undefined) return horizonBack(cwd, back, from, then);
  if (then !== undefined) throw new Error('render horizon-pick: --then carries the items still to ask about after --back');
  if (park !== undefined && dotpath !== undefined) throw new Error('render horizon-pick: --park names the items being put on the roadmap, and takes no address');
  if (park === undefined && dotpath === undefined) {
    throw new Error('render horizon-pick: name what is going on the roadmap — --park <name>[,<name>…], a topic leaving for it as <work_unit>.discovery.<topic>, or --back <name> --from <what put it back>');
  }
  const putting = park === undefined ? '' : puttingLine(parked(park));
  const postponing = dotpath === undefined ? null : postponeAddress(cwd, dotpath);
  const state = roadmapState(cwd);
  if (!state.exists) {
    throw new Error('render horizon-pick: no roadmap on the project manifest — the caller names its first horizon in prose');
  }
  if (state.horizons.length === 0) {
    throw new Error('render horizon-pick: the roadmap holds no horizons — the caller names one in prose');
  }
  /** @type {import('./projections/surfaces.cjs').Next} */
  const carryOn = { kind: 'continue' };
  const options = horizonRows(state, (horizon) => (postponing === null ? carryOn : { kind: 'engine', argv: ['render', 'postpone-gate', postponing, '--horizon', horizon] }));
  options.push(cmdOption('n', 'new', 'A new horizon — name it', { next: carryOn }));
  return section('MENU: horizon pick', MENU_INSTRUCTION, menu(putting, options, { question: 'Which horizon?' }));
}

/**
 * The items `--park` names, comma-joined, each a legal item name, none twice.
 * @param {string} park @returns {string[]}
 */
function parked(park) {
  const names = park.split(',');
  for (const name of names) {
    try {
      assertLegalName('item', name);
    } catch (err) {
      throw new Error(`render horizon-pick: --park takes the items' names, comma-joined — ${messageOf(err)}`);
    }
  }
  const twice = names.find((name, i) => names.indexOf(name) !== i);
  if (twice !== undefined) throw new Error(`render horizon-pick: --park names "${twice}" twice`);
  return names;
}

/** What the pick says is going on the roadmap: the item by its title, or how many. @param {string[]} names */
const puttingLine = (names) => (names.length === 1 ? `Putting "${titlecase(names[0])}" on the roadmap.` : `Putting ${names.length} items on the roadmap.`);

/**
 * A row for each of the roadmap's horizons, with how many wait there.
 * @param {{horizons: string[], items: {horizon: string|null, state: string}[]}} state
 * @param {(horizon: string) => import('./projections/surfaces.cjs').Next|undefined} nextOf
 */
function horizonRows(state, nextOf) {
  return state.horizons.map((horizon, i) => {
    const waiting = state.items.filter((r) => r.horizon === horizon && r.state === 'waiting').length;
    const next = nextOf(horizon);
    return cmdOption(String(i + 1), null, { head: horizon, tail: `${waiting} waiting` }, next === undefined ? {} : { next });
  });
}

/**
 * `render horizon-pick --back <name> --from <what put it back> [--then
 * <items>]` (the pick's): refused for an item not waiting on no horizon.
 * @param {string} cwd @param {string} name @param {string|undefined} from @param {string|undefined} then @returns {string}
 */
function horizonBack(cwd, name, from, then) {
  if (from === undefined) throw new Error('render horizon-pick: --back takes --from, what put it back — <work_unit>, or <work_unit>.discovery.<topic>');
  putBackBy(from);
  const carried = ['--from', from, ...thenArgs(stillToAsk(then))];
  const state = roadmapState(cwd);
  const row = state.items.find((r) => r.name === name);
  if (row === undefined || row.horizon !== null || row.state !== 'waiting') throw new Error(`render horizon-pick: "${name}" is no roadmap item waiting on no horizon`);
  /** @param {string} horizon @returns {import('./projections/surfaces.cjs').Next} */
  const moved = (horizon) => ({ kind: 'engine', argv: ['roadmap', 'move', name, '--horizon', horizon, ...carried] });
  return dataSection([`a horizon named in words: engine roadmap move ${name} --horizon "<the horizon>" ${carried.join(' ')}, then follow its next`])
    + section('MENU: horizon pick', MENU_INSTRUCTION, menu(
      `"${titlecase(name)}" is back on the roadmap, and the horizon it came from has been removed.`,
      [...horizonRows(state, moved), cmdOption('n', 'new', 'A new horizon — name it', { next: { kind: 'continue' } })],
      { question: 'Which horizon?' },
    ));
}

// The cross-flow static gates — adopted engine-side as their files were
// touched (menus are engine-rendered, static sets included). Wording is
// the gates' own; each is fetched at the exact point it displays.

/**
 * ledger's migration summary — the payload is the session's summary,
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
 * The one-time session-label opt-in, naming the multiplexer this session
 * runs in; refused inside none, where boot never offers it.
 * @returns {string}
 */
function labelGateSurface() {
  const multiplexer = multiplexerHere();
  if (multiplexer === null) throw new Error('render label-gate: the session runs inside neither tmux nor Portal — boot offers session labels only inside one');
  return labelGate(multiplexer);
}

const GUARD_FACTS = Object.freeze(['unit', 'phase', 'topic', 'active']);

/**
 * Boot's `guard` stop, from the facts its response carries: `--cause
 * live` with the session's `--unit`, `--phase`, `--topic` and `--active`,
 * its seconds since last active; `--cause dirty` with a `--path` for each
 * path changed, and none of the session's.
 * @param {string} _cwd @param {Record<string, string|undefined>} args @param {Record<string, string[]>} lists
 * @returns {string}
 */
function migrationGuardStopSurface(_cwd, args, lists) {
  const { cause, unit, phase, topic, active } = args;
  const paths = lists.path ?? [];
  if (cause === 'dirty') {
    const given = GUARD_FACTS.filter((fact) => args[fact] !== undefined);
    if (given.length > 0) throw new Error(`render migration-guard-stop: --${given[0]} names the live session a refusal for uncommitted changes has none of`);
    if (paths.length === 0 || !paths.every(isFilled)) throw new Error('render migration-guard-stop: --cause dirty names each path changed by a --path of its own');
    return migrationGuardStop({ cause, folder: OLD_STATE, paths });
  }
  if (cause !== 'live') throw new Error(`render migration-guard-stop: --cause is live or dirty, as boot's guard stop answers it, got "${cause ?? ''}"`);
  if (paths.length > 0) throw new Error('render migration-guard-stop: --path names an uncommitted change a refusal for a live session has none of');
  if (!isFilled(unit) || !isFilled(phase) || !isFilled(topic)) throw new Error('render migration-guard-stop: --cause live names the live session by --unit, --phase and --topic');
  if (active === undefined || !/^(0|[1-9][0-9]*)$/.test(active)) throw new Error(`render migration-guard-stop: --active takes the seconds since the live session was last active, got "${active ?? ''}"`);
  return migrationGuardStop({ cause, unit, phase, topic, active: Number(active) });
}

// ---------------------------------------------------------------------------
// The start's own screens (boot-route.cjs): the banner the bare command
// opens on, its version the one the release writes into the engine, and
// the pick between the pieces of work the person's words name.
// ---------------------------------------------------------------------------

/** Where the release writes the installed version (`.mint.toml`). */
const VERSION_FILE = path.join(__dirname, '..', '..', 'content', 'version.txt');

/** @returns {string} */
function bannerSurface() {
  return banner(fs.readFileSync(VERSION_FILE, 'utf8').trim());
}

/** @param {string} cwd @param {Record<string, string|undefined>} args @returns {string} */
function workPickSurface(cwd, { matches }) {
  return workPick(pickRows(cwd, matches));
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
 * ledger's one-time offer, standing before the walk. `--menu-only`
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

/**
 * One reference card, addressed by its slug, as the cards' row for it names
 * it: whole, with its menu. `--menu-only` serves the return from a question,
 * the card already on the reader's terminal; `--content-only`, a card shown
 * in an answer, mid-conversation, where it carries no gate.
 * @param {string} _cwd @param {Record<string, string|undefined>} args @returns {string}
 */
function walkthroughTopicSurface(_cwd, args) {
  if (args['menu-only'] && args['content-only']) throw new Error('render walkthrough-topic: --menu-only and --content-only each draw part of the card — give one');
  const card = loadCard(args.name);
  if (args['menu-only']) return walkthroughTopic(card, 'menu');
  return walkthroughTopic(card, args['content-only'] ? 'content' : 'whole');
}

/** The knowledge gate's variants a row draws by name; with none, the gate opens on reuse or mode. */
const KNOWLEDGE_VARIANTS = Object.freeze(['deviate', 'wizard', 'retry']);

/** The flags of a setup's provider form the retry variant runs again, `from-system` aside. */
const PROVIDER_FORM_FLAGS = Object.freeze(['provider', 'model', 'base-url', 'dimensions']);

/**
 * ledger's knowledge gate. With no `--variant` it opens on the system
 * configuration: reused where one is valid, its provider and model named;
 * else the search-mode pick. A row draws `deviate` or `wizard` by name, and
 * a setup refused for its provider's key `retry`, given the setup's flags —
 * `--from-system`, the key the system configuration's provider's, or the
 * provider form's — which its yes runs again.
 * @param {string} _cwd @param {Record<string, string|undefined>} args @returns {string}
 */
function knowledgeGateSurface(_cwd, args) {
  const { variant } = args;
  const given = [...PROVIDER_FORM_FLAGS, 'from-system'].filter((flag) => args[flag] !== undefined);
  if (variant === 'retry') return knowledgeGate('retry', retrySetup(args, given));
  if (given.length > 0) throw new Error(`render knowledge-gate: --${given[0]} names the setup the retry variant runs again — it takes --variant retry`);
  if (variant === undefined) return knowledgeOpening();
  if (!KNOWLEDGE_VARIANTS.includes(variant)) throw new Error(`render knowledge-gate: --variant must be one of ${KNOWLEDGE_VARIANTS.join(', ')}, or none to open the gate, got "${variant}"`);
  return knowledgeGate(variant);
}

/** The knowledge gate's opening: the system configuration reused where one is valid, else the search-mode pick. @returns {string} */
function knowledgeOpening() {
  const system = detectSystemConfig();
  return system.status === 'valid' ? knowledgeGate('reuse', system) : knowledgeGate('mode');
}

/**
 * The check once the person says the terminal wizard completed: the
 * configuration the checkout's store was built with where it is ready, as an
 * in-chat setup says it; else that the wizard did not complete, over the
 * gate's opening again.
 * @param {string} cwd @returns {string}
 */
function knowledgeDoneSurface(cwd) {
  const root = stateRoot(cwd);
  if (readiness(root, () => {}) === 'ready') return knowledgeReady(readMetadata(knowledgeFiles(root).metadata));
  return [knowledgeNotDone(), knowledgeOpening()].join('\n');
}

/**
 * The provider whose key the retry variant asks for, and the setup's flags
 * it runs again: `--from-system` alone, the system configuration's provider;
 * or the provider form's, as the setup was given them.
 * @param {Record<string, string|undefined>} args @param {string[]} given
 * @returns {{provider: string, setup: string[]}}
 */
function retrySetup(args, given) {
  if (args['from-system'] !== undefined) {
    if (given.length > 1) throw new Error('render knowledge-gate: --from-system runs the system configuration again, and takes none of the provider form\'s flags');
    const { provider } = detectSystemConfig();
    if (!KEY_PROVIDERS.includes(provider ?? '')) throw new Error(`render knowledge-gate: the system configuration's provider is "${provider ?? 'none'}", no provider of ${KEY_PROVIDERS.join('|')} whose key could be missing`);
    return { provider: /** @type {string} */ (provider), setup: ['--from-system'] };
  }
  const { provider, model } = args;
  if (!KEY_PROVIDERS.includes(provider ?? '') || !isFilled(model)) {
    throw new Error(`render knowledge-gate: the retry variant takes the setup it runs again — --from-system, or --provider ${KEY_PROVIDERS.join('|')} with its --model and any --base-url and --dimensions — got "${given.map((flag) => `--${flag}`).join(' ')}"`);
  }
  return { provider: /** @type {string} */ (provider), setup: given.flatMap((flag) => [`--${flag}`, /** @type {string} */ (args[flag])]) };
}

/**
 * The knowledge gate's questions for a provider's setup, which the person
 * answers in words.
 * @param {string} _cwd @param {Record<string, string|undefined>} args @returns {string}
 */
function knowledgeAskSurface(_cwd, { provider }) {
  if (!KEY_PROVIDERS.includes(provider ?? '')) throw new Error(`render knowledge-ask: --provider must be one of ${KEY_PROVIDERS.join(', ')}, got "${provider ?? ''}"`);
  return knowledgeAsk(/** @type {string} */ (provider));
}

/** The catalogue: surface name → handler. @type {Record<string, (cwd: string, args: {dotpath: string} & Record<string, string|undefined>, lists: Record<string, string[]>) => string>} */
const SURFACES = {
  'backlog-gate': backlogGate,
  'experiment-approval-gate': experimentApprovalGateSurface,
  'experiment-next-gate': experimentNextGateSurface,
  'experiment-spawn-gate': experimentSpawnGateSurface,
  'cancel-gate': cancelGate,
  'postpone-gate': postponeGate,
  'import-reprompt': importRepromptSurface,
  'absorb-target': (cwd, { dotpath }) => absorbTargetSurface(cwd, dotpath),
  'absorb-confirm-gate': absorbConfirmSurface,
  'archived-delete-gate': (cwd, { path: given, file }) => archivedDeleteGateSurface(cwd, given, file),
  'horizon-pick': horizonPick,
  banner: bannerSurface,
  'work-pick': workPickSurface,
  'brownfield-offer-gate': brownfieldOfferGateSurface,
  'walkthrough-offer': walkthroughOfferSurface,
  'walkthrough-screen': walkthroughScreenSurface,
  'walkthrough-topic': walkthroughTopicSurface,
  'migrations-applied': migrationsAppliedSurface,
  'migration-gate': (cwd) => migrationGate({ codeOnly: finishing(cwd)?.commits.includes('state') === false }),
  'state-lost-gate': (cwd) => stateLostGate(projectName(cwd)),
  'git-floor-stop': () => gitFloorStopSurface(),
  'repo-stop': repoStopSurface,
  'github-rule-gate': (cwd) => githubRuleGate(projectName(cwd)),
  'github-squash-gate': (cwd) => githubSquashGate(projectName(cwd), githubSquashNested(cwd)),
  'label-gate': () => labelGateSurface(),
  'knowledge-gate': knowledgeGateSurface,
  'knowledge-ask': knowledgeAskSurface,
  'knowledge-done': knowledgeDoneSurface,
  'state-merge-gate': stateMergeGateSurface,
  'ledger-stop': ledgerStopSurface,
  'directive-stop': directiveStopSurface,
  'migration-guard-stop': migrationGuardStopSurface,
  'migration-checks-stop': () => migrationChecksStop(),
  'migration-taken-stop': takenStopSurface,
  'migration-leaving': leavingSurface,
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
  'epic-menu': (cwd, { dotpath }) => epicMenuSurface(cwd, dotpath),
  manage: (cwd) => manageSurface(cwd),
  'manage-unit': (cwd, { dotpath, from, matches }) => manageUnitSurface(cwd, dotpath, { from, matches }),
  closed: (cwd) => closedSurface(cwd),
  'care': (cwd, { added, dropped }) => careSurface(cwd, { added, dropped }),
  'care-kind': careKindSurface,
  'care-drop': careDropSurface,
  triage: (cwd, { file }) => triageSurface(cwd, file),
  archived: (cwd, { file }) => archivedSurface(cwd, file),
  'archived-item': (cwd, { path: given, file }) => archivedItemSurface(cwd, given, file),
  convergence: (cwd, { dotpath, asked }) => convergenceSurface(cwd, { dotpath, asked }),
  roadmap: (cwd) => roadmapSurface(cwd),
  'roadmap-harvest': (cwd, { file }) => roadmapHarvestSurface(cwd, file),
  matrix: (cwd) => matrixSurface(cwd),
  'matrix-replay': (cwd, { threshold, build }) => replaySurface(cwd, { threshold, build }),
  'environment-setup': (cwd, { from }) => environmentSetupSurface(cwd, { from }),
  drivers: (cwd) => driversSurface(cwd),
  'help-topics': (cwd) => helpTopicsSurface(cwd),
};

/**
 * Dispatch a surface render, `lists` the values of each flag a surface
 * takes more than once.
 * @param {string} cwd @param {string} surface @param {{dotpath: string} & Record<string, string|undefined>} args
 * @param {Record<string, string[]>} [lists]
 * @returns {string}
 */
function renderSurface(cwd, surface, args, lists = {}) {
  const handler = SURFACES[surface];
  if (!handler) {
    throw new Error(`render: unknown surface "${surface}" (surfaces: ${Object.keys(SURFACES).join(', ')})`);
  }
  return handler(cwd, args, lists);
}

module.exports = { renderSurface, SURFACES };
