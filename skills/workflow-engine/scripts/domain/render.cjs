'use strict';

// Render-surface catalogue — the named runtime surfaces `engine render
// <surface>` serves to skills. Judgment decides; code renders: address-backed
// values come from the manifest (JSON state only — markdown artifacts are
// never parsed), judgment content arrives as a validated JSON payload file,
// and each surface returns demarcated sections the calling flow emits
// verbatim at its prescribed moment. Gate-mode branching renders inside the
// surface: the caller never chooses between gated and auto output.
//
// Surfaces read; they never write — with one exception. `code-gate`'s empty
// path beats the addressed topic, because claiming the code slot and reading
// it are the same act: the read that finds the slot free is what takes it.

const fs = require('fs');
const path = require('path');
const { loadAllManifests, loadManifest, loadProjectManifest } = require('./reads.cjs');
const { signpost } = require('../kernel/render.cjs');
const { TREE_WIDTH, titlecase, WORKLIST_GLYPH, DISCOVERY_GLYPH, discoveryLifecycleLabel } = require('./conventions.cjs');
const { section, titleSection, CONTINUE_INSTRUCTION, CONTINUE_MARKDOWN_INSTRUCTION, AUTO_GATE_INSTRUCTION, AUTO_GATE_MARKDOWN_INSTRUCTION, menu, menuFrame, MENU_GLYPH, cmdOption, bareOption, promptOption, callout, indentedBody, bulletRow, subDetail, treeList } = require('./projections/surfaces.cjs');
const { buildOrderLive } = require('./build-order.cjs');
const { worklist, escapeMarkdown } = require('./projections/worklist.cjs');
const { blockedTasksMenu, taskGateSection, fixGateSection, cycleLimitDisplay, specCorrectionsDisplay, cycleGateMenu } = require('./projections/tasks.cjs');
const { workunitReceipt, topicReceipt, absorbSummary, absorbReceipt, promoteReceipt, importReprompt, pivotContinuationMenu, absorbContinuationMenu, sessionReceipt } = require('./projections/transactions.cjs');
const { absorbTargetMenu, absorbConfirmGate, planTopicsMenu, archivedActions, archivedDeleteGate, completedActions } = require('./projections/start.cjs');
const { archivedItem } = require('./inbox-set.cjs');
const {
  baselineProgress, baselineAreaGate, baselinePaused, baselineReceipt,
  baselineScopeGate, baselineRound, baselineDocGate, baselineManageGate, baselineDocPick,
  baselineOfferGate,
} = require('./projections/baseline.cjs');
const { baselineState } = require('./baseline.cjs');
const {
  ORIGINS: WALKTHROUGH_ORIGINS, loadScreen, loadCard, walkthroughScreen, walkthroughHome, walkthroughTopics, walkthroughTopic,
} = require('./projections/walkthrough.cjs');
const { migrationGate, labelGate, knowledgeGate, KNOWLEDGE_GATE_VARIANTS } = require('./projections/boot.cjs');
const { heldCodeSessions, heldDocument, beatQuietly, fmtAge, CODE_PHASES } = require('./presence.cjs');
const { roadmapState, hasRoadmapNode } = require('./roadmap.cjs');
const { latestReview } = require('./agent-state.cjs');
const {
  roadmapMapView,
  roadmapAddGate,
  roadmapHarvestGate,
  roadmapParksGate,
  roadmapShapeGate,
} = require('./projections/roadmap.cjs');
const { revisitablePhases, revisitPhasesSection } = require('./projections/workunit.cjs');
const { experimentRegister, experimentApprovalGate, experimentPick, experimentNextGate, experimentSpawnGate } = require('./projections/experiment.cjs');
const { researchThreads } = require('./projections/research-threads.cjs');
const { registerState } = require('./research-threads.cjs');
const { waitGate, phasePaused, researchWaitState } = require('./projections/wait.cjs');
const { compareExperimentIds, isParentExperimentId, DERIVED_PHASES, EXPERIMENT_TERMINAL_STATUSES, EXPERIMENT_SPAWN_PHASES, WAITING_PHASES, TERMINAL_STATUSES } = require('../kernel/manifest-schema.cjs');
const { WORK_UNIT_TYPES, typeConfig: workUnitTypeConfig, completedPhases } = require('./workunit-detail.cjs');
const {
  phaseItems, computeNextPhase, computeTopicLifecycle, lifecyclePhrase, awaitedExperiments, waits, itemOf,
  outstandingResearch, outstandingResearchPhrase, CLOSED_LIFECYCLES,
  sourceRows, OPEN_SOURCE_STATUSES, specUnsettled, specUnsettledPhrase, UNIT_PHASES, liveUnitItems, discoveryUnitExists, lockingSpecs, deliveryStarted, cancelPlan,
  postponePlan, postponeTarget, postponedItem, openExperiments,
} = require('./derivations.cjs');
const { discoverySpec, specConfirmation } = require('./specification.cjs');
const { specificationConfirmation } = require('./projections/specification.cjs');
const { manageDetail } = require('./workunit-manage.cjs');
const { gateOf, counterOf, FIX_THRESHOLD, CYCLE_LIMIT } = require('./tasks.cjs');

// The payload-facing status vocabulary — the staging values the two
// overview surfaces accept, validated here so the error names the surface
// and the row; the worklist's own throw is the backstop.
const WORKLIST_STATUSES = Object.keys(WORKLIST_GLYPH);

/**
 * Parse a 3-segment dotpath `work_unit.phase.topic`, validating the work unit
 * exists. Loud on shape errors — surfaces are called from prescribed prose
 * and a malformed address is an authoring bug.
 * @param {string} cwd @param {string} dotpath @param {string} surface
 * @returns {{workUnit: string, phase: string, topic: string, manifest: object}}
 */
function resolveAddress(cwd, dotpath, surface) {
  const parts = (dotpath || '').split('.');
  if (parts.length !== 3 || parts.some((p) => p === '')) {
    throw new Error(`render ${surface}: address must be <work_unit>.<phase>.<topic>, got "${dotpath}"`);
  }
  const [workUnit, phase, topic] = parts;
  const manifest = loadManifest(cwd, workUnit);
  if (!manifest) throw new Error(`render ${surface}: work unit "${workUnit}" not found`);
  return { workUnit, phase, topic, manifest };
}

// ---------------------------------------------------------------------------
// resume-gate — the shared continue/restart gate over an in-progress phase
// artifact. Address-backed; the artifact name is the phase segment. The
// optional triage count comes from the caller's `topic queue` read and
// rides as a scalar flag.
// ---------------------------------------------------------------------------

const RESUME_MENU_INSTRUCTION = "emit verbatim as markdown, then STOP for the user's response";
const RESUME_QUESTION = 'How would you like to proceed?';

/**
 * The resume-menu family. The default renders the shared phase-resume menu;
 * variants derive their consumer's label and options from state at the same
 * address: `plan` (position parenthetical from the planning item), `review`
 * (coverage counts from reviewed/completed task arrays), `scoping` (the
 * revisit wording), `session` (bare work-unit address, the interrupted
 * discovery session).
 * @param {string} cwd
 * @param {{dotpath: string, triage?: string, variant?: string}} args
 * @returns {string}
 */
function resumeGate(cwd, args) {
  const { dotpath, triage, variant } = args;
  if (variant !== undefined && !['plan', 'review', 'scoping', 'session'].includes(variant)) {
    throw new Error(`render resume-gate: --variant must be "plan", "review", "scoping", or "session", got "${variant}"`);
  }
  if (variant !== undefined && triage !== undefined) {
    throw new Error('render resume-gate: --triage only applies to the default variant');
  }
  if (variant === 'session') {
    const { workUnit, manifest } = resolveWorkUnit(cwd, dotpath, 'resume-gate');
    const active = ((manifest.phases || {}).discovery || {}).active_session;
    if (active === undefined || active === null || String(active).trim() === '') {
      throw new Error('render resume-gate: no active discovery session to resume');
    }
    return section('MENU: resume gate', RESUME_MENU_INSTRUCTION, menu(
      `Found an in-progress discovery session for **${titlecase(workUnit)}** at \`session-${active}.md\`.`,
      [
        cmdOption('c', 'continue', 'Pick up where you left off'),
        cmdOption('r', 'restart', 'Discard the interrupted log and start a new session (map edits already applied stay applied — only their session record is lost)'),
      ],
      { question: RESUME_QUESTION },
    ));
  }
  const { workUnit, phase, topic, manifest } = resolveAddress(cwd, dotpath, 'resume-gate');
  const t = titlecase(topic);
  if (variant === 'plan') {
    const item = itemOf(manifest, 'planning', topic) || {};
    // A restart deletes the planning directory first and the manifest entry
    // second. Between the two commits the entry survives a crash with nothing
    // left to continue — so the gate offers the restart alone.
    if (!fs.existsSync(path.join(cwd, '.workflows', workUnit, 'planning', topic))) {
      return section('MENU: resume gate', RESUME_MENU_INSTRUCTION, menu(
        `Found a planning entry for **${t}**, but the prior run's files are already cleared.`,
        [cmdOption('r', 'restart', 'Clear what is left and plan from scratch')],
        { question: RESUME_QUESTION },
      ));
    }
    // Partial fill is a real state — define-phases advances `phase` and nulls
    // `task`; keep the known phase anchor rather than dropping the whole
    // parenthetical.
    const hasPhase = isFilled(String(item.phase ?? ''));
    const hasTask = isFilled(String(item.task ?? ''));
    const pos = hasPhase
      ? hasTask
        ? ` (previously reached phase ${item.phase}, task ${item.task})`
        : ` (previously reached phase ${item.phase})`
      : '';
    return section('MENU: resume gate', RESUME_MENU_INSTRUCTION, menu(
      `Found existing plan for **${t}**${pos}.`,
      [
        cmdOption('c', 'continue', 'Walk through the plan from the start. You can review, amend, or navigate at any point — including straight to the leading edge.'),
        cmdOption('r', 'restart', 'Erase all planning work for this topic and start fresh. This deletes the planning file, authored tasks, and clears manifest state. Other topics are unaffected.'),
      ],
      { question: RESUME_QUESTION },
    ));
  }
  if (variant === 'review') {
    const reviewItem = itemOf(manifest, 'review', topic) || {};
    const implItem = itemOf(manifest, 'implementation', topic) || {};
    const reviewed = Array.isArray(reviewItem.reviewed_tasks) ? new Set(reviewItem.reviewed_tasks).size : null;
    const completed = Array.isArray(implItem.completed_tasks) ? implItem.completed_tasks.length : 0;
    if (reviewed !== null && completed - reviewed > 0) {
      const unreviewed = completed - reviewed;
      return section('MENU: resume gate', RESUME_MENU_INSTRUCTION, menu(
        `Found existing review for **${t}**.\nReview covered ${reviewed} of ${completed} tasks. ${unreviewed} task(s) not yet reviewed.`,
        [
          cmdOption('c', 'continue', `Review the ${unreviewed} unreviewed tasks`),
          cmdOption('r', 'restart', `Delete review, re-review all ${completed} tasks`),
        ],
        { question: RESUME_QUESTION },
      ));
    }
    const label = `Found existing review for **${t}**.` + (reviewed !== null ? `\nAll ${completed} tasks have been reviewed.` : '');
    return section('MENU: resume gate', RESUME_MENU_INSTRUCTION, menu(label, [
      cmdOption('c', 'continue', 'Continue from current review state'),
      cmdOption('r', 'restart', 'Delete review, start fresh'),
    ], { question: RESUME_QUESTION }));
  }
  if (variant === 'scoping') {
    return section('MENU: resume gate', RESUME_MENU_INSTRUCTION, menu(
      `Found completed scoping for **${t}** — spec and plan are in place.`,
      [
        cmdOption('c', 'continue', 'Adjust the existing spec and plan'),
        cmdOption('r', 'restart', 'Erase the spec, plan, and task files, then rescope from scratch'),
      ],
      { question: RESUME_QUESTION },
    ));
  }
  const parts = [];
  if (triage !== undefined) {
    const n = parseInt(triage, 10);
    if (!Number.isInteger(n) || n < 1) {
      throw new Error(`render resume-gate: --triage must be a positive integer, got "${triage}"`);
    }
    parts.push(section(
      'DISPLAY: triage warning',
      'emit verbatim as a code block, directly above the menu',
      callout(`${n} rerouted concern(s) from other topics wait in this topic's `
        + 'triage queue. Restart leaves them queued — the restarted session raises them.'),
    ));
  }
  parts.push(section(
    'MENU: resume gate',
    'emit verbatim as markdown, then STOP for the user\'s response',
    menu(`Found existing ${phase} for **${titlecase(topic)}**.`, [
      cmdOption('c', 'continue', 'Pick up where you left off'),
      cmdOption('r', 'restart', `Delete the ${phase} and start fresh`),
    ], { question: RESUME_QUESTION }),
  ));
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// task-list — the planning task-list approval gate. The task content is
// judgment authored this turn (and persisted to markdown, which the engine
// never parses), so it arrives as a payload file; the gate mode is manifest
// state read at the same address. The surface returns the canonical display
// plus either the approval menu (gated) or the auto-proceed line (auto) —
// both callers see identical task-list output.
// ---------------------------------------------------------------------------

/**
 * Parse and validate the task-list payload: `{phase, phase_name, tasks[]}`,
 * each task `{name, summary, edge_cases?}`. Shape errors are loud and name
 * the field, so a malformed write self-corrects.
 * @param {string} cwd @param {string} file
 * @returns {{phase: number, phase_name: string, tasks: {name: string, summary: string, edge_cases?: string[]}[]}}
 */
function readTaskListPayload(cwd, file) {
  let raw;
  try {
    raw = fs.readFileSync(path.resolve(cwd, file), 'utf8');
  } catch {
    throw new Error(`render task-list: payload file not found: ${file}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`render task-list: payload is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('render task-list: payload must be an object {phase, phase_name, tasks}');
  }
  if (!Number.isInteger(parsed.phase) || parsed.phase < 1) {
    throw new Error('render task-list: "phase" must be a positive integer');
  }
  if (typeof parsed.phase_name !== 'string' || parsed.phase_name.trim() === '') {
    throw new Error('render task-list: "phase_name" must be a non-empty string');
  }
  if (!Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
    throw new Error('render task-list: "tasks" must be a non-empty array of {name, summary, edge_cases}');
  }
  for (const [i, t] of parsed.tasks.entries()) {
    for (const field of ['name', 'summary']) {
      if (!t || typeof t[field] !== 'string' || t[field].trim() === '') {
        throw new Error(`render task-list: task ${i + 1} is missing "${field}" (each task needs name, summary, optional edge_cases[])`);
      }
    }
    if (t.edge_cases !== undefined && (!Array.isArray(t.edge_cases) || t.edge_cases.some((e) => typeof e !== 'string' || e.trim() === ''))) {
      throw new Error(`render task-list: task ${i + 1} "edge_cases" must be an array of non-empty strings when present`);
    }
  }
  return parsed;
}

/**
 * @param {string} cwd
 * @param {{dotpath: string, file?: string, variant?: string}} args
 * @returns {string} sections
 */
function taskList(cwd, { dotpath, file, variant: variantArg }) {
  if (!file) throw new Error('render task-list: --file <payload.json> is required');
  const { topic, manifest } = resolveAddress(cwd, dotpath, 'task-list');
  const payload = readTaskListPayload(cwd, file);

  const variant = variantArg === 'existing' ? 'existing' : 'fresh';
  const items = (((manifest.phases || {}).planning || {}).items || {})[topic] || {};
  const gateMode = items.task_list_gate_mode === 'auto' ? 'auto' : 'gated';

  const count = payload.tasks.length;
  const lines = [`Phase ${payload.phase}: ${payload.phase_name} — ${count} task${count === 1 ? '' : 's'}.`, ''];
  payload.tasks.forEach((t, i) => {
    lines.push(`${i + 1}. ${t.name}`);
    lines.push(subDetail(t.summary));
    if (t.edge_cases && t.edge_cases.length > 0) {
      lines.push('   · Edge cases');
      lines.push(treeList(t.edge_cases));
    } else {
      lines.push('   · Edge cases: none');
    }
    if (i < count - 1) lines.push('');
  });

  const parts = [
    section('DISPLAY: task list', 'emit verbatim as a code block', lines.join('\n')),
  ];
  if (gateMode === 'auto') {
    parts.push(section(
      'DISPLAY: task list auto-approved',
      AUTO_GATE_INSTRUCTION,
      variant === 'existing'
        ? `Phase ${payload.phase}: ${payload.phase_name} — task list confirmed. Proceeding to authoring.`
        : `Phase ${payload.phase}: ${payload.phase_name} — task list approved. Proceeding to authoring.`,
    ));
  } else {
    const options = variant === 'existing'
      ? [
          cmdOption('y', 'yes', 'Proceed to authoring'),
          promptOption('Tell me what to change', 'which tasks to revise in this phase'),
          promptOption('Navigate', 'Tell me where to go: a different phase or task, or the leading edge'),
        ]
      : [
          cmdOption('y', 'yes', 'Proceed to authoring'),
          cmdOption('a', 'auto', 'Approve this and all remaining task list gates automatically'),
          promptOption('Tell me what to change', 'which tasks to reorder, split, merge, add, edit, or remove'),
          promptOption('Navigate', 'Tell me where to go: a different phase or task, or the leading edge'),
        ];
    parts.push(section(
      'MENU: task list gate',
      'emit verbatim as markdown, then STOP for the user\'s response',
      menu('Approve this task list?', options),
    ));
  }
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// proposed-task / tasks-overview — the shared task presentation for the
// analysis and review synthesis loops, the ad hoc plan-changes gate, and
// the consolidation-boundary walk. Severity/sources ride the synthesis and
// consolidation payloads, placement/priority/depends_on the ad hoc and
// consolidation ones — all optional, rendered only when present.
// Gate mode rides as a flag, not an address read: the flows carry it in a
// cycle response or the manifest's staging subtree — the surface guarantees
// the form of the output, the flow owns the mode.
// Two altitudes, picked by the payload: a proposal carries title, problem and
// solution (outcome only when it adds something the solution doesn't); a task
// adds the Acceptance Criteria and Do blocks. Judging comes before
// authoring, and detail that doesn't exist yet can't be rendered.
// A proposal carrying an open decision is raised, never rendered: the
// DISPLAY slims to the title and meta lines — no Problem, no Solution, no
// Stakes — and the record stays in the staging file. The session composes
// the raise, in product terms from zero, between the two section
// emissions; that contract is the walk prose's to own. The menu carries
// the question as its statement label with the sides beneath a fixed
// engine question — the conflict-menu idiom: model-authored text never
// enters the glyphed chrome — and a t/technical arm reaches the record's
// depth: the session retells the mechanism from the staged record and the
// findings behind it, then re-runs this render for the header and menu. A
// decision is an irreducible product fork — never a technical call an
// investigation would settle — and the required "stakes" (a top-level
// field beside "decision", never nested inside it) is the payload's
// argument for the stop: each side's product consequence, why no
// investigation settles the tie, and — where a side is marked — the
// grounds for the recommendation. Problem, solution and stakes stay
// required here though the decision path never renders them: the payload
// mirrors its staging row, and a decision with no record behind it is
// refused, not slimmed. The menu fires at either gate
// mode, by design: a bare `y` would hand the call to the executor, and
// auto never settles an irreducible product fork — a decision item always
// stops, and over an auto opt-in its label says so. A decision excludes
// the authored blocks and outcome: the direction is settled before bodies
// exist, and what the change would look like is the raise's to say. The
// question and each side are single lines — they become the menu's label
// and rows, and the head chrome is never scanned for the option column. A
// side may mark itself recommended (at most one); it orders first with a
// "(recommended)" suffix — the findingChoice idiom.
// ---------------------------------------------------------------------------

/**
 * @param {string} cwd
 * @param {{dotpath: string, file?: string, gate?: string, 'comment-hint'?: string}} args
 * @returns {string}
 */
function proposedTask(cwd, args) {
  const { dotpath, file, gate } = args;
  if (!file) throw new Error('render proposed-task: --file <payload.json> is required');
  if (gate !== 'gated' && gate !== 'auto') throw new Error('render proposed-task: --gate must be "gated" or "auto"');
  resolveAddress(cwd, dotpath, 'proposed-task');
  const p = readJsonPayload(cwd, file, 'proposed-task');

  if (!Number.isInteger(p.current) || p.current < 1) throw new Error('render proposed-task: "current" must be a positive integer');
  if (!Number.isInteger(p.total) || p.total < p.current) throw new Error('render proposed-task: "total" must be an integer ≥ "current"');
  for (const field of ['title', 'problem', 'solution']) {
    if (!isFilled(p[field])) throw new Error(`render proposed-task: "${field}" must be a non-empty string`);
  }
  for (const field of ['outcome', 'severity', 'sources', 'placement', 'priority', 'depends_on']) {
    if (p[field] !== undefined && !isFilled(p[field])) throw new Error(`render proposed-task: "${field}" must be a non-empty string when present`);
  }
  /** @type {Record<string, string[]>} */
  const blocks = {};
  for (const field of ['steps', 'criteria']) {
    if (p[field] === undefined) continue;
    const lines = stringLines(p[field], 'proposed-task', field);
    if (lines.length === 0) throw new Error(`render proposed-task: "${field}" must be non-empty`);
    blocks[field] = lines;
  }
  /** @type {string[]} */
  let decisionRows = [];
  if (p.decision !== undefined) {
    if (p.decision === null || typeof p.decision !== 'object' || Array.isArray(p.decision)) {
      throw new Error('render proposed-task: "decision" must be an object carrying "question" and "options"');
    }
    if (!isFilled(p.decision.question)) throw new Error('render proposed-task: "decision.question" must be a non-empty string');
    if (/\n/.test(p.decision.question)) throw new Error('render proposed-task: "decision.question" must be a single line — it becomes the menu\'s statement label');
    if (!Array.isArray(p.decision.options) || p.decision.options.length < 2 || p.decision.options.length > 4) {
      throw new Error('render proposed-task: "decision.options" must be an array of 2–4 sides');
    }
    const sides = p.decision.options.map((/** @type {unknown} */ o, /** @type {number} */ i) => {
      const side = /** @type {{summary?: unknown, recommended?: unknown}} */ (
        typeof o === 'string' ? { summary: o } : (o && typeof o === 'object' && !Array.isArray(o) ? o : {}));
      const summary = side.summary;
      if (!isFilled(summary)) {
        throw new Error(`render proposed-task: decision.options[${i}] must be a non-empty string or an object carrying "summary"`);
      }
      return { summary, recommended: side.recommended === true };
    });
    decisionRows = recommendedMenuRows(sides, 'render proposed-task: at most one option may be recommended');
    if (!isFilled(p.stakes)) {
      throw new Error('render proposed-task: "stakes" must be a non-empty string when "decision" is present — the argument for the stop: each side\'s product consequence, and why no investigation settles the tie');
    }
    if (blocks.steps || blocks.criteria) {
      throw new Error('render proposed-task: "decision" excludes steps/criteria — the direction is settled before bodies are authored');
    }
    if (p.outcome !== undefined) {
      throw new Error('render proposed-task: "decision" excludes outcome — the raise carries what the change would look like; the record keeps the rest');
    }
  } else if (p.stakes !== undefined) {
    throw new Error('render proposed-task: "stakes" requires "decision" — the argument for a stop needs an open fork to argue for');
  }

  const meta = [];
  if (isFilled(p.sources)) meta.push(`Sources: ${p.sources}`);
  if (isFilled(p.placement)) meta.push(`Placement: ${p.placement}`);
  if (isFilled(p.priority)) meta.push(`Priority: ${p.priority}`);
  if (isFilled(p.depends_on)) meta.push(`Depends on: ${p.depends_on}`);
  // The head takes the task-header marker idiom (see taskHeader): the ordinal
  // is batch position, not a plan number — a suffix, and noise for a batch of
  // one, so it renders only when there is a walk to pace.
  const ordinal = p.total > 1 ? ` (${p.current} of ${p.total})` : '';
  const body = [
    `**\`▪ ${p.title.trim()}${ordinal}\`**${isFilled(p.severity) ? ` (${p.severity})` : ''}`,
    ...meta,
  ];
  if (!p.decision) {
    body.push('', `**Problem**: ${p.problem}`, '', `**Solution**: ${p.solution}`);
    if (isFilled(p.outcome)) body.push('', `**Outcome**: ${p.outcome}`);
    for (const [field, heading] of [['criteria', 'Acceptance Criteria'], ['steps', 'Do']]) {
      if (!blocks[field]) continue;
      body.push('', `**${heading}**:`, ...blocks[field]);
    }
  }
  const parts = [section('DISPLAY: proposed task', 'emit verbatim as markdown', body.join('\n'))];

  const hint = isFilled(args['comment-hint']) ? args['comment-hint'] : 'Tell me what to change';
  if (p.decision) {
    parts.push(section(
      'MENU: task decision',
      STOP_FOR_RESPONSE,
      menu(`**Decision**: ${p.decision.question}${gate === 'auto' ? `\n\n${AUTO_OVERRIDE_LINE}` : ''}`, [
        ...decisionRows,
        cmdOption('t', 'technical', "Retell the fork from the code's perspective"),
        cmdOption('d', 'decline', 'Decline this task — it will not be built'),
        promptOption('Comment', hint),
      ], { question: 'Which way?' }),
    ));
  } else if (gate === 'auto') {
    parts.push(section(
      'DISPLAY: task auto-approved',
      `after recording the approval: ${AUTO_GATE_INSTRUCTION}`,
      p.total > 1
        ? `Task ${p.current} of ${p.total}: ${p.title} — approved [auto].`
        : `${p.title} — approved [auto].`,
    ));
  } else {
    parts.push(section(
      'MENU: task approval',
      STOP_FOR_RESPONSE,
      menu('Approve this task?', [
        cmdOption('y', 'yes', 'Approve this task'),
        cmdOption('a', 'auto', 'Approve this and all remaining tasks automatically'),
        cmdOption('d', 'decline', 'Decline this task — it will not be built'),
        promptOption('Comment', hint),
      ]),
    ));
  }
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// spec-review-gate — the review loop's two gates, variant-keyed and
// payload-less: the options are static, the state that picks the variant
// (cycle count, gate mode, finding statuses) lives with the caller.
//   continue — the cycle-count escape hatch: keep reviewing or skip out
//   reloop   — after findings: another full cycle or proceed to completion
// ---------------------------------------------------------------------------

/**
 * @param {string} cwd
 * @param {{dotpath: string, variant?: string}} args
 * @returns {string}
 */
function specReviewGate(cwd, { dotpath, variant }) {
  if (variant === undefined || !['continue', 'reloop'].includes(variant)) {
    throw new Error('render spec-review-gate: --variant must be "continue" or "reloop"');
  }
  const { phase } = resolveAddress(cwd, dotpath, 'spec-review-gate');
  if (phase !== 'specification') {
    throw new Error(`render spec-review-gate: address must be <work_unit>.specification.<topic>, got phase "${phase}"`);
  }
  if (variant === 'continue') {
    return section('MENU: spec review continue gate', STOP_FOR_RESPONSE, menu('', [
      cmdOption('y', 'yes', 'Continue review'),
      cmdOption('s', 'skip', 'Skip review, proceed to completion'),
    ], { question: 'Continue with review?' }));
  }
  return section('MENU: spec review reloop gate', STOP_FOR_RESPONSE, menu('', [
    cmdOption('y', 'yes', 'Run another review cycle (all three phases)'),
    cmdOption('p', 'proceed', 'Proceed to completion'),
  ], { question: 'Run another review cycle?' }));
}

// ---------------------------------------------------------------------------
// convergence-diagnostic — the review/fix escalation diagnostic. The judgment
// (trend classification, finding titles, root-cause hypotheses) rides as the
// payload; the arithmetic (counts from the arrays, review growth) and the
// advisory flags are this surface's own — a flag whose condition lives in
// prose fires by mood.
// ---------------------------------------------------------------------------

const CONVERGENCE_LOOPS = { fix: 'Fix Loop', analysis: 'Analysis', 'planning-review': 'Plan Review', 'spec-review': 'Spec Review' };
const CONVERGENCE_TRENDS = {
  churning: 'Findings resolve but are replaced at the same rate — the edits are generating the next cycle\'s findings.',
  converging: 'Resolved findings outnumber new ones — the cycles are closing ground.',
  stable: 'Resolved and new findings match cycle for cycle — the loop is holding where it is.',
  diverging: 'New findings outnumber resolved ones — the fixes are introducing new issues.',
};
const CONVERGENCE_GROWTH = {
  'spec-review': {
    document: 'construction',
    churn: 'The cycles are adding words while findings churn — the review is writing rules the record never decided. A finding adds what a source states or removes what is wrong; anything else is a decision nobody made.',
    note: 'Growth is the loop working only where each addition traces to a source; growth from review-authored rules is the review deciding for the user.',
  },
  'planning-review': {
    document: 'plan',
    churn: 'The cycles are adding words while findings churn — the review is writing mechanism the specification never decided. A finding restates a behaviour the record decides and the criterion that proves it, or removes what is wrong; a corrected mechanism is the builder\'s.',
    note: 'Growth is the loop working only where each addition traces to the specification; growth from review-authored mechanism is the review deciding for the builder.',
  },
};

/**
 * @param {string} cwd
 * @param {{dotpath: string, file?: string}} args
 * @returns {string}
 */
function convergenceDiagnostic(cwd, { dotpath, file }) {
  if (!file) throw new Error('render convergence-diagnostic: --file <payload.json> is required');
  resolveAddress(cwd, dotpath, 'convergence-diagnostic');
  const p = readJsonPayload(cwd, file, 'convergence-diagnostic');
  if (!(p.loop_type in CONVERGENCE_LOOPS)) {
    throw new Error(`render convergence-diagnostic: "loop_type" must be one of ${Object.keys(CONVERGENCE_LOOPS).join('/')}`);
  }
  if (!(p.trend in CONVERGENCE_TRENDS)) {
    throw new Error(`render convergence-diagnostic: "trend" must be one of ${Object.keys(CONVERGENCE_TRENDS).join('/')}`);
  }
  if (!Number.isInteger(p.latest_cycle) || p.latest_cycle < 2) {
    throw new Error('render convergence-diagnostic: "latest_cycle" must be an integer ≥ 2 — the diagnostic needs at least 2 cycles of data');
  }
  /** @param {unknown} arr @param {string} name @param {string[]} fields @returns {Array<Record<string, unknown>>} */
  const findings = (arr, name, fields) => {
    if (!Array.isArray(arr)) throw new Error(`render convergence-diagnostic: "${name}" must be an array`);
    arr.forEach((it, i) => {
      for (const f of fields) {
        const ok = f === 'last_seen_cycle' ? Number.isInteger(it[f]) : isFilled(it[f]);
        if (!ok) throw new Error(`render convergence-diagnostic: ${name}[${i}] is missing "${f}"`);
      }
    });
    return arr;
  };
  const resolved = findings(p.resolved, 'resolved', ['title', 'last_seen_cycle']);
  const recurring = findings(p.recurring, 'recurring', ['title', 'cycles', 'hypothesis']);
  const fresh = findings(p.new, 'new', ['title']);

  const multi = p.loop_type === 'spec-review' || p.loop_type === 'planning-review';
  if (multi) {
    if (!Array.isArray(p.stream_counts) || p.stream_counts.length < 2) {
      throw new Error(`render convergence-diagnostic: "${p.loop_type}" carries "stream_counts" — one {label, count} per tracking stream`);
    }
    p.stream_counts.forEach((st, i) => {
      if (!isFilled(st.label) || !Number.isInteger(st.count)) {
        throw new Error(`render convergence-diagnostic: stream_counts[${i}] needs "label" and an integer "count"`);
      }
    });
  } else if (p.stream_counts !== undefined) {
    throw new Error(`render convergence-diagnostic: "${p.loop_type}" is single-stream — omit "stream_counts"`);
  }
  const hasGrowth = p.review_baseline_words !== undefined || p.live_words !== undefined;
  if (hasGrowth) {
    if (!multi) {
      throw new Error('render convergence-diagnostic: document growth belongs to spec-review and planning-review — omit the word counts');
    }
    if (!Number.isInteger(p.review_baseline_words) || !Number.isInteger(p.live_words) || p.review_baseline_words < 0 || p.live_words < 0) {
      throw new Error('render convergence-diagnostic: "review_baseline_words" and "live_words" travel together as non-negative integers');
    }
  }

  const growth = hasGrowth ? p.live_words - p.review_baseline_words : 0;
  const head = [
    `Trend: ${p.trend}`,
    `Latest cycle: ${fresh.length + recurring.length} findings (${fresh.length} new, ${recurring.length} recurring)`,
  ];
  if (multi) head.push(`Per stream: ${p.stream_counts.map((st) => `${st.label} ${st.count}`).join(' · ')}`);
  if (hasGrowth) head.push(`Document growth: ${p.review_baseline_words} → ${p.live_words} words (${growth >= 0 ? `+${growth}` : growth} net across review)`);

  const row = (/** @type {string} */ text) => bulletRow(text, { indent: '    ' });
  const note = (/** @type {string} */ text) => subDetail(text, { indent: '      ' });
  const block = (/** @type {string} */ label, /** @type {string[]} */ rows) => [...indentedBody([label]), ...rows].join('\n');

  const heading = signpost(`${CONVERGENCE_LOOPS[p.loop_type]} — cycle ${p.latest_cycle} diagnostic`, { width: TREE_WIDTH });
  const parts = [[heading, '', ...indentedBody(head)].join('\n')];
  if (resolved.length > 0) {
    parts.push(block('Resolved:', resolved.flatMap((f) => row(`${f.title} (fixed in cycle ${f.last_seen_cycle})`))));
  }
  if (recurring.length > 0) {
    parts.push(block('Recurring:', recurring.flatMap((f) => [...row(`${f.title} (cycles ${f.cycles})`), note(`${f.hypothesis}`)])));
  }
  if (fresh.length > 0) {
    parts.push(block('New this cycle:', fresh.flatMap((f) => row(`${f.title}`))));
  }

  const flags = [callout(CONVERGENCE_TRENDS[p.trend])];
  const doc = hasGrowth ? CONVERGENCE_GROWTH[p.loop_type] : null;
  if (doc && p.trend === 'churning' && growth > 0) {
    flags.push(callout(doc.churn));
  }
  if (doc && growth > p.review_baseline_words / 4) {
    flags.push(callout(`Review has added ${growth} words to a ${p.review_baseline_words}-word ${doc.document}. ${doc.note}`));
  }
  parts.push(flags.join('\n'));

  return section('DISPLAY: convergence diagnostic', 'emit verbatim as a code block', parts.join('\n\n'));
}

// ---------------------------------------------------------------------------
// spec-completion-gate — the conclusion flow's two consent gates,
// variant-keyed and payload-less: the surrounding content (the assessment
// display, the completion state) is the caller's; only the ask renders here.
//   assessment — confirm the epic cross-cutting assessment
//   signoff    — the final conclude consent
// ---------------------------------------------------------------------------

/**
 * @param {string} cwd
 * @param {{dotpath: string, variant?: string}} args
 * @returns {string}
 */
function specCompletionGate(cwd, { dotpath, variant }) {
  if (variant === undefined || !['assessment', 'signoff'].includes(variant)) {
    throw new Error('render spec-completion-gate: --variant must be "assessment" or "signoff"');
  }
  const { phase } = resolveAddress(cwd, dotpath, 'spec-completion-gate');
  if (phase !== 'specification') {
    throw new Error(`render spec-completion-gate: address must be <work_unit>.specification.<topic>, got phase "${phase}"`);
  }
  if (variant === 'assessment') {
    return section('MENU: spec assessment gate', STOP_FOR_RESPONSE, menu('', [
      cmdOption('y', 'yes', 'Confirm assessment'),
      promptOption('Comment', 'Suggest a different classification'),
    ], { question: 'Confirm this assessment?' }));
  }
  return section('MENU: spec signoff gate', STOP_FOR_RESPONSE, menu('', [
    cmdOption('y', 'yes', 'Conclude specification and mark as completed'),
    promptOption('Comment', 'Add context before concluding'),
  ], { question: 'Ready to conclude?' }));
}

// ---------------------------------------------------------------------------
// carry-note-gate — research document review's per-note landing consent: the
// note itself and its judged target ride as the payload, the ask renders
// here. The statement label carries the reopen warning, so the menu keeps it.
// ---------------------------------------------------------------------------

/**
 * @param {string} cwd
 * @param {{dotpath: string, file?: string}} args
 * @returns {string}
 */
function carryNoteGate(cwd, { dotpath, file }) {
  if (!file) throw new Error('render carry-note-gate: --file <payload.json> is required');
  const { phase } = resolveAddress(cwd, dotpath, 'carry-note-gate');
  if (phase !== 'research') {
    throw new Error(`render carry-note-gate: address must be <work_unit>.research.<topic>, got phase "${phase}"`);
  }
  const p = readJsonPayload(cwd, file, 'carry-note-gate');
  const note = stringLines(p.note, 'carry-note-gate', 'note');
  if (note.length === 0) throw new Error('render carry-note-gate: "note" must be non-empty');
  if (!isFilled(p.target)) throw new Error('render carry-note-gate: "target" must be a non-empty string');
  if (p.landing_phase !== 'research' && p.landing_phase !== 'discussion') {
    throw new Error(`render carry-note-gate: "landing_phase" must be "research" or "discussion", got "${p.landing_phase}"`);
  }
  const display = section('DISPLAY: carry note', 'emit verbatim as markdown', [
    ...note,
    '',
    `*Addressed to: ${p.target} — lands in its ${p.landing_phase} triage queue*`,
  ].join('\n'));
  const gate = section('MENU: carry note gate', STOP_FOR_RESPONSE, menu(
    `This note lands in "${p.target}"'s triage queue; if "${p.target}" is completed, landing reopens it.`,
    [
      cmdOption('y', 'yes', 'Land it there; this document keeps a reroute record'),
      cmdOption('s', 'skip', 'Leave it as prose in this document'),
      promptOption('Comment', 'Tell me what to change (target, phase, or content)'),
    ],
    { question: 'Land it there?' },
  ));
  return [display, gate].join('\n');
}

// ---------------------------------------------------------------------------
// hypothesis-board — the investigation's hypothesis ledger, in the four
// presentations the analysis needs. One renderer for one object: judgment
// supplies the claims and the evidence beneath them, while the counts, the
// order of the parts, and every gate belong to this surface — so the board
// reads the same however long the analysis runs, and at any width.
//   plan      — the proposed ledger, its trace lines and checkpoint depth
//   resume    — the same ledger re-rendered from an earlier session
//   check-in  — a resolution moment: what just resolved, then the whole board
//   pivot     — a finding invalidated the plan: what changed, then the
//               ledger proposed in its place
// ---------------------------------------------------------------------------

const HYPOTHESIS_VARIANTS = ['plan', 'resume', 'check-in', 'pivot'];
const HYPOTHESIS_STATUSES = ['suspected', 'tracing', 'confirmed', 'ruled-out'];
const CHECKPOINT_DEPTHS = ['straight-through', 'check-ins'];

// A field that lands inside a markdown construct living on one line — a bold
// head, a `- **Label**: value` bullet — cannot carry a newline: it would
// break the construct around it and put a bare fragment on the page. Shared
// by the investigation's row-shaped surfaces, which all take more rows rather
// than longer ones; an artefact too big for a row (a trace, a diff) stays in
// the investigation file, which the display cites rather than reproduces.
/** @param {string} surface @param {string} v @param {string} field @returns {string} */
function oneLine(surface, v, field) {
  if (/[\r\n]/.test(v)) {
    throw new Error(`render ${surface}: ${field} runs to more than one line — split it across rows, or leave the detail in the investigation file`);
  }
  return v;
}

/**
 * Validate the ledger and answer its ids in payload order.
 * @param {unknown} v @returns {string[]}
 */
function hypothesisLedger(v) {
  if (!Array.isArray(v) || v.length === 0) {
    throw new Error('render hypothesis-board: "hypotheses" must be a non-empty array of {id, claim, status, rows}');
  }
  /** @type {string[]} */
  const ids = [];
  v.forEach((h, i) => {
    if (!h || typeof h !== 'object') throw new Error(`render hypothesis-board: hypotheses[${i}] must be an object`);
    if (!isFilled(h.id)) throw new Error(`render hypothesis-board: hypotheses[${i}] is missing "id"`);
    oneLine('hypothesis-board', h.id, `hypotheses[${i}] id`);
    if (ids.includes(h.id)) throw new Error(`render hypothesis-board: duplicate hypothesis id "${h.id}" — an id is the ledger's stable reference and is never reused`);
    if (!isFilled(h.claim)) throw new Error(`render hypothesis-board: hypotheses[${i}] is missing "claim"`);
    oneLine('hypothesis-board', h.claim, `hypotheses[${i}] claim`);
    if (!HYPOTHESIS_STATUSES.includes(h.status)) {
      throw new Error(`render hypothesis-board: hypotheses[${i}] carries unknown status "${h.status}" (expected ${HYPOTHESIS_STATUSES.join('/')})`);
    }
    if (!Array.isArray(h.rows) || h.rows.length === 0) {
      throw new Error(`render hypothesis-board: hypotheses[${i}] needs "rows" — a non-empty array of [label, value] pairs`);
    }
    h.rows.forEach((/** @type {unknown} */ r, /** @type {number} */ j) => {
      if (!Array.isArray(r) || r.length !== 2 || !isFilled(r[0]) || !isFilled(r[1])) {
        throw new Error(`render hypothesis-board: hypotheses[${i}] row ${j + 1} must be a [label, value] pair of non-empty strings`);
      }
      oneLine('hypothesis-board', r[0], `hypotheses[${i}] row ${j + 1} label`);
      oneLine('hypothesis-board', r[1], `hypotheses[${i}] row ${j + 1} value`);
    });
    ids.push(h.id);
  });
  return ids;
}

/** One ledger entry: the claim under its id, status as the metadata tail, evidence beneath. @param {any} h @returns {string} */
function hypothesisEntry(h) {
  return [`**${h.id} — ${h.claim}** — *${h.status}*`, ...h.rows.map((/** @type {string[]} */ r) => `- **${r[0]}**: ${r[1]}`)].join('\n');
}

/** `(N tracked, N confirmed, N ruled out, N open)` — zero-count middles drop out, the open count never does. @param {any[]} hs @returns {string} */
function hypothesisCounts(hs) {
  const of = (/** @type {string} */ s) => hs.filter((h) => h.status === s).length;
  const parts = [`${hs.length} tracked`];
  const confirmed = of('confirmed');
  const ruledOut = of('ruled-out');
  if (confirmed) parts.push(`${confirmed} confirmed`);
  if (ruledOut) parts.push(`${ruledOut} ruled out`);
  parts.push(`${of('suspected') + of('tracing')} open`);
  return `(${parts.join(', ')})`;
}

/** The `**Trace lines**` block. @param {unknown} v @returns {string} */
function traceLines(v) {
  const lines = stringLines(v, 'hypothesis-board', 'trace_lines');
  if (lines.length === 0 || lines.some((l) => !isFilled(l))) {
    throw new Error('render hypothesis-board: "trace_lines" must be a non-empty array of non-empty strings');
  }
  lines.forEach((l, i) => oneLine('hypothesis-board', l, `trace_lines[${i}]`));
  return ['**Trace lines**', ...lines.map((l) => `- ${l}`)].join('\n');
}

/** @param {any} p @returns {string} */
function checkpointDepth(p) {
  if (!CHECKPOINT_DEPTHS.includes(p.depth)) {
    throw new Error(`render hypothesis-board: "depth" must be one of ${CHECKPOINT_DEPTHS.join('/')}`);
  }
  return p.depth;
}

/**
 * @param {string} cwd
 * @param {{dotpath: string, file?: string, variant?: string}} args
 * @returns {string}
 */
function hypothesisBoard(cwd, { dotpath, file, variant }) {
  if (variant === undefined || !HYPOTHESIS_VARIANTS.includes(variant)) {
    throw new Error(`render hypothesis-board: --variant must be one of ${HYPOTHESIS_VARIANTS.join('/')}`);
  }
  if (!file) throw new Error('render hypothesis-board: --file <payload.json> is required');
  const { phase, topic } = resolveAddress(cwd, dotpath, 'hypothesis-board');
  if (phase !== 'investigation') {
    throw new Error(`render hypothesis-board: address must be <work_unit>.investigation.<topic>, got phase "${phase}"`);
  }
  const p = readJsonPayload(cwd, file, 'hypothesis-board');
  const ids = hypothesisLedger(p.hypotheses);
  const name = titlecase(topic);
  const ledger = p.hypotheses.map(hypothesisEntry);

  if (variant === 'plan' || variant === 'pivot') {
    const pivot = variant === 'pivot';
    if (pivot && !isFilled(p.changed)) {
      throw new Error('render hypothesis-board: "changed" must be a non-empty string — a pivot names the finding that invalidated the plan');
    }
    const body = [pivot ? `**Plan pivot — ${name}**` : `**Investigation plan — ${name}**`, ''];
    if (pivot) body.push(`**What changed**: ${oneLine('hypothesis-board', p.changed, '"changed"')}`, '', '**Proposed direction**', '');
    body.push(ledger.join('\n\n'), '', traceLines(p.trace_lines));
    if (!pivot) {
      if (!isFilled(p.depth_reasoning)) throw new Error('render hypothesis-board: "depth_reasoning" must be a non-empty string');
      body.push('', `**Depth**: ${checkpointDepth(p)} — ${oneLine('hypothesis-board', p.depth_reasoning, '"depth_reasoning"')}`);
    }
    return [
      section(pivot ? 'DISPLAY: plan pivot' : 'DISPLAY: investigation plan', 'emit verbatim as markdown', body.join('\n')),
      section(pivot ? 'MENU: pivot gate' : 'MENU: plan gate', STOP_FOR_RESPONSE, pivot
        ? menu('', [
          cmdOption('y', 'yes', 'Proceed as proposed'),
          promptOption('Adjust', 'Tell me what to change'),
        ], { question: 'Proceed on the new direction?' })
        : menu('', [
          cmdOption('y', 'yes', 'Proceed with the analysis as planned'),
          promptOption('Adjust', 'Tell me what to change: hypotheses, trace lines, or depth'),
        ], { question: 'Does this plan look right?' })),
    ].join('\n');
  }

  if (variant === 'resume') {
    if (!isFilled(p.remaining)) {
      throw new Error('render hypothesis-board: "remaining" must be a non-empty string — name the open hypotheses and trace lines, or say all are resolved');
    }
    const body = [
      `**Investigation plan — ${name} · resumed** ${hypothesisCounts(p.hypotheses)}`,
      '',
      ledger.join('\n\n'),
      '',
      `**Depth**: ${checkpointDepth(p)}`,
      `**Remaining**: ${oneLine('hypothesis-board', p.remaining, '"remaining"')}`,
    ];
    return [
      section('DISPLAY: resumed plan', 'emit verbatim as markdown', body.join('\n')),
      section('MENU: resumed plan gate', STOP_FOR_RESPONSE, menu('', [
        cmdOption('y', 'yes', 'Continue as agreed'),
        promptOption('Revise', 'Tell me what to change: hypotheses, trace lines, or depth'),
      ], { question: 'Picking up where we left off — still good?' })),
    ].join('\n');
  }

  if (!Array.isArray(p.resolved_now) || p.resolved_now.length === 0) {
    throw new Error('render hypothesis-board: "resolved_now" must be a non-empty array of hypothesis ids — a check-in is a resolution moment');
  }
  for (const id of p.resolved_now) {
    if (!ids.includes(id)) throw new Error(`render hypothesis-board: "resolved_now" names "${id}", which is not on the board`);
  }
  const open = p.hypotheses.filter((/** @type {any} */ h) => p.resolved_now.includes(h.id) && (h.status === 'suspected' || h.status === 'tracing'));
  if (open.length) {
    throw new Error(`render hypothesis-board: "${open[0].id}" is named in "resolved_now" but its status is "${open[0].status}" — a resolved hypothesis is confirmed or ruled-out`);
  }
  if (!isFilled(p.next)) throw new Error('render hypothesis-board: "next" must be a non-empty string');
  const body = [
    `**Hypothesis board — ${name}** ${hypothesisCounts(p.hypotheses)}`,
    '',
    `Resolved this check-in: ${p.resolved_now.join(', ')}`,
    '',
    ledger.join('\n\n'),
    '',
    `**Next**: ${oneLine('hypothesis-board', p.next, '"next"')}`,
  ];
  return [
    section('DISPLAY: hypothesis board', 'emit verbatim as markdown', body.join('\n')),
    section('MENU: check-in gate', STOP_FOR_RESPONSE, menu('', [
      cmdOption('y', 'yes', 'Continue with the next trace line'),
      promptOption('Steer', 'Tell me what to look at instead, or what this changes'),
    ], { question: 'Continue as planned?' })),
  ].join('\n');
}

// ---------------------------------------------------------------------------
// findings-signoff-gate — the one sign-off on the investigation record. The
// findings are retold above it from the investigation file, and both the
// technical retelling and the view read that same file, so the gate refuses
// where the file is not there: every row it offers would be over nothing.
// ---------------------------------------------------------------------------

/**
 * @param {string} cwd
 * @param {{dotpath: string}} args
 * @returns {string}
 */
function findingsSignoffGate(cwd, { dotpath }) {
  const { workUnit, phase, topic } = resolveAddress(cwd, dotpath, 'findings-signoff-gate');
  if (phase !== 'investigation') {
    throw new Error(`render findings-signoff-gate: address must be <work_unit>.investigation.<topic>, got phase "${phase}"`);
  }
  if (!fs.existsSync(path.join(cwd, '.workflows', workUnit, 'investigation', `${topic}.md`))) {
    throw new Error(`render findings-signoff-gate: no investigation file for "${topic}" — the sign-off is read from the record`);
  }
  return section('MENU: findings sign-off gate', STOP_FOR_RESPONSE, menu('Do these findings match your understanding?', [
    cmdOption('y', 'yes', 'Findings are correct, move to fix exploration'),
    cmdOption('t', 'technical', "Retell the findings from the code's perspective"),
    cmdOption('v', 'view', 'Show the full investigation file'),
    promptOption('Provide feedback', "Tell me what's off or unclear"),
  ]));
}

// ---------------------------------------------------------------------------
// fix-direction — the candidate approaches, presented for the user to steer.
// The shape is the surface's so a reader can compare: every option carries
// the same rows, and what varies with the material — whether options are
// lettered at all, the count in the header — is derived, not decided. A
// recommendation must carry its reasoning: naming a favourite without saying
// why is the move this phase exists to prevent. Where the exploration is
// genuinely unresolved, the open question is a field rather than a paragraph
// someone remembers to add. Agreement carries the pressure test with it —
// there is no direction worth agreeing to and not proving.
// ---------------------------------------------------------------------------

// One option per letter. A fix exploration that reaches the end of this has
// stopped being a comparison and needs the discussion, not more rows.
const OPTION_LETTERS = 'ABCDEFGH';

/**
 * @param {string} cwd
 * @param {{dotpath: string, file?: string}} args
 * @returns {string}
 */
function fixDirection(cwd, { dotpath, file }) {
  if (!file) throw new Error('render fix-direction: --file <payload.json> is required');
  const { phase, topic } = resolveAddress(cwd, dotpath, 'fix-direction');
  if (phase !== 'investigation') {
    throw new Error(`render fix-direction: address must be <work_unit>.investigation.<topic>, got phase "${phase}"`);
  }
  const p = readJsonPayload(cwd, file, 'fix-direction');
  if (!Array.isArray(p.options) || p.options.length === 0) {
    throw new Error('render fix-direction: "options" must be a non-empty array of {name, rows} — one obvious fix is a valid outcome, none is not');
  }
  if (p.options.length > OPTION_LETTERS.length) {
    throw new Error(`render fix-direction: ${p.options.length} options is past comparing — this surface letters at most ${OPTION_LETTERS.length}`);
  }
  p.options.forEach((o, i) => {
    if (!o || typeof o !== 'object') throw new Error(`render fix-direction: options[${i}] must be an object`);
    if (!isFilled(o.name)) throw new Error(`render fix-direction: options[${i}] is missing "name"`);
    oneLine('fix-direction', o.name, `options[${i}] name`);
    if (o.recommended !== undefined && typeof o.recommended !== 'boolean') {
      throw new Error(`render fix-direction: options[${i}] "recommended" must be true or false`);
    }
    if (!Array.isArray(o.rows) || o.rows.length === 0) {
      throw new Error(`render fix-direction: options[${i}] needs "rows" — a non-empty array of [label, value] pairs`);
    }
    o.rows.forEach((/** @type {unknown} */ r, /** @type {number} */ j) => {
      if (!Array.isArray(r) || r.length !== 2 || !isFilled(r[0]) || !isFilled(r[1])) {
        throw new Error(`render fix-direction: options[${i}] row ${j + 1} must be a [label, value] pair of non-empty strings`);
      }
      oneLine('fix-direction', r[0], `options[${i}] row ${j + 1} label`);
      oneLine('fix-direction', r[1], `options[${i}] row ${j + 1} value`);
    });
  });

  const many = p.options.length > 1;
  const picked = p.options.filter((/** @type {any} */ o) => o.recommended);
  if (picked.length > 1) {
    throw new Error('render fix-direction: only one option can be "recommended" — a recommendation that names two is a comparison, and belongs in the rows');
  }
  if (picked.length && !many) {
    throw new Error('render fix-direction: a lone option cannot be "recommended" — there is nothing to recommend it over');
  }
  // The tail marks which; this line says why. One without the other is
  // either a favourite with no reasoning or reasoning with no subject.
  if (picked.length && !isFilled(p.recommendation)) {
    throw new Error('render fix-direction: a recommended option needs "recommendation" — the deciding factor, not just the mark');
  }
  if (!picked.length && p.recommendation !== undefined) {
    throw new Error('render fix-direction: "recommendation" was given but no option is marked "recommended"');
  }
  if (p.recommendation !== undefined) oneLine('fix-direction', p.recommendation, '"recommendation"');
  if (p.open_question !== undefined) {
    if (!isFilled(p.open_question)) throw new Error('render fix-direction: "open_question" must be a non-empty string when present');
    oneLine('fix-direction', p.open_question, '"open_question"');
  }

  const name = titlecase(topic);
  const body = [many ? `**Fix direction — ${name}** (${p.options.length} approaches)` : `**Fix direction — ${name}**`, ''];
  p.options.forEach((/** @type {any} */ o, /** @type {number} */ i) => {
    const id = many ? `${OPTION_LETTERS[i]} — ` : '';
    body.push(`**${id}${o.name}**${o.recommended ? ' — *recommended*' : ''}`);
    for (const [label, value] of o.rows) body.push(`- **${label}**: ${value}`);
    body.push('');
  });
  if (p.recommendation !== undefined) body.push(`**Recommendation**: ${p.recommendation}`);
  if (p.open_question !== undefined) body.push(`**Open question**: ${p.open_question}`);

  return [
    section('DISPLAY: fix direction', 'emit verbatim as markdown', body.join('\n').replace(/\n+$/, '')),
    section('MENU: fix direction gate', STOP_FOR_RESPONSE, menu('', [
      cmdOption('y', 'yes', 'Agree with this direction and pressure-test it'),
      promptOption('Provide feedback', 'Tell me your thoughts: discuss, challenge, or suggest alternatives'),
    ], { question: 'What are your thoughts?' })),
  ].join('\n');
}
// ---------------------------------------------------------------------------
// validation-report — the investigation's two independent-agent passes, which
// differ only in what they hunt: root-cause validation looks for gaps in the
// diagnosis, fix validation for risks in the direction. One surface, because
// a divergence between them would be drift rather than design. The agent's
// own STATUS travels verbatim in the payload and is checked against the
// findings, so a verdict can never disagree with the list beneath it. Both
// verdicts carry the same readout — what was checked, what it concluded,
// where the full analysis sits — because a bare pass is an assertion rather
// than a result. Only the offer differs: the root cause validation is the
// one the user chooses, so it is the only variant `validation-gate` serves.
// ---------------------------------------------------------------------------

const VALIDATION_CONFIDENCE = ['high', 'medium', 'low'];
const VALIDATION_VARIANTS = {
  'root-cause': {
    label: 'Root cause validation',
    found: 'gaps_found',
    noun: 'gap',
    clean: 'validated, no gaps found',
    question: 'How should these gaps be handled?',
    address: 'Work through them and fold the answers into the investigation',
    gate: {
      offer: 'Root cause documented. Run validation?',
      run: 'Run root cause validation',
      decline: 'Skip straight to findings sign-off',
    },
  },
  fix: {
    label: 'Fix validation',
    found: 'risks_found',
    noun: 'risk',
    clean: 'confirmed, no unaddressed risks',
    question: 'How should these risks be handled?',
    address: 'Work through them and fold the outcome into the fix direction',
    // The user agreed to one option out of a lettered comparison, so the
    // verdict names which one it confirms rather than leaving them to recall.
    requiresDirection: true,
  },
};

/**
 * The offer that opens the root cause validation — payload-less: the ask is
 * the same every time, and what it is offering comes from the variant.
 * @param {string} cwd
 * @param {{dotpath: string, variant?: string}} args
 * @returns {string}
 */
function validationGate(cwd, { dotpath, variant }) {
  const v = VALIDATION_VARIANTS[/** @type {keyof typeof VALIDATION_VARIANTS} */ (variant)];
  const gate = v && /** @type {{gate?: {offer: string, run: string, decline: string}}} */ (v).gate;
  if (!gate) {
    throw new Error('render validation-gate: --variant must be root-cause — the fix direction is always pressure-tested, so nothing offers it');
  }
  const { phase } = resolveAddress(cwd, dotpath, 'validation-gate');
  if (phase !== 'investigation') {
    throw new Error(`render validation-gate: address must be <work_unit>.investigation.<topic>, got phase "${phase}"`);
  }
  return section(`MENU: ${variant} validation offer`, STOP_FOR_RESPONSE, menu('', [
    cmdOption('y', 'yes', gate.run),
    cmdOption('s', 'skip', gate.decline),
  ], { question: gate.offer }));
}

/**
 * @param {string} cwd
 * @param {{dotpath: string, file?: string, variant?: string}} args
 * @returns {string}
 */
function validationReport(cwd, { dotpath, file, variant }) {
  const v = VALIDATION_VARIANTS[/** @type {keyof typeof VALIDATION_VARIANTS} */ (variant)];
  if (!v) {
    throw new Error(`render validation-report: --variant must be one of ${Object.keys(VALIDATION_VARIANTS).join('/')}`);
  }
  if (!file) throw new Error('render validation-report: --file <payload.json> is required');
  const { phase } = resolveAddress(cwd, dotpath, 'validation-report');
  if (phase !== 'investigation') {
    throw new Error(`render validation-report: address must be <work_unit>.investigation.<topic>, got phase "${phase}"`);
  }
  const p = readJsonPayload(cwd, file, 'validation-report');
  if (!VALIDATION_CONFIDENCE.includes(p.confidence)) {
    throw new Error(`render validation-report: "confidence" must be one of ${VALIDATION_CONFIDENCE.join('/')}`);
  }
  if (p.status !== 'validated' && p.status !== v.found) {
    throw new Error(`render validation-report: "status" must be "validated" or "${v.found}" for the ${variant} variant, got "${p.status}"`);
  }
  const named = /** @type {{requiresDirection?: boolean}} */ (v).requiresDirection === true;
  if (named) {
    if (!isFilled(p.direction)) {
      throw new Error('render validation-report: "direction" must name the agreed approach — a verdict that does not say what it confirms is not one');
    }
    oneLine('validation-report', p.direction, '"direction"');
  } else if (p.direction !== undefined) {
    throw new Error(`render validation-report: "direction" belongs to the fix variant — ${variant} validation has no chosen approach to name`);
  }
  if (!Array.isArray(p.checks) || p.checks.length === 0) {
    throw new Error('render validation-report: "checks" must be a non-empty array of [label, outcome] pairs — the verdict says what was examined');
  }
  p.checks.forEach((/** @type {unknown} */ c, /** @type {number} */ i) => {
    if (!Array.isArray(c) || c.length !== 2 || !isFilled(c[0]) || !isFilled(c[1])) {
      throw new Error(`render validation-report: checks[${i}] must be a [label, outcome] pair of non-empty strings`);
    }
    oneLine('validation-report', c[0], `checks[${i}] label`);
    oneLine('validation-report', c[1], `checks[${i}] outcome`);
  });
  if (!isFilled(p.summary)) {
    throw new Error('render validation-report: "summary" must be a non-empty string — the agent\'s own one-sentence assessment');
  }
  oneLine('validation-report', p.summary, '"summary"');
  if (!isFilled(p.analysis_path)) {
    throw new Error('render validation-report: "analysis_path" must be a non-empty string — the full analysis stays in cache and the display points at it');
  }
  const items = p.items === undefined ? [] : stringLines(p.items, 'validation-report', 'items');
  items.forEach((it, i) => {
    if (!isFilled(it)) throw new Error(`render validation-report: items[${i}] must be a non-empty string`);
  });

  const head = [v.label, ...(named ? [`"${p.direction}"`] : []), `${p.confidence} confidence`].join(' · ');
  // The checks and the summary close every verdict, clean or not — findings
  // first where there are any, then the scope they were found within.
  const tail = [
    '',
    p.checks.map((/** @type {[string, string]} */ [label, outcome]) => `- **${label}**: ${outcome}`).join('\n'),
    '',
    p.summary,
    '',
    `*Full analysis: \`${p.analysis_path}\`*`,
  ];

  if (p.status === 'validated') {
    if (items.length) {
      throw new Error(`render validation-report: "status" is "validated" but ${items.length} ${v.noun}(s) are listed — the verdict and the findings must agree`);
    }
    return section(
      `DISPLAY: ${variant} validation verdict`,
      CONTINUE_MARKDOWN_INSTRUCTION,
      [`**${head}** — ${v.clean}`, ...tail].join('\n'),
    );
  }

  if (!items.length) {
    throw new Error(`render validation-report: "status" is "${v.found}" but no ${v.noun}s are listed — the verdict and the findings must agree`);
  }
  const body = worklist({
    heading: { label: head, noun: v.noun },
    items: items.map((title) => ({ title })),
  });
  return [
    section(`DISPLAY: ${variant} validation findings`, 'emit verbatim as markdown', [body, ...tail].join('\n')),
    section(`MENU: ${variant} validation gate`, STOP_FOR_RESPONSE, menu('', [
      cmdOption('a', 'address', v.address),
      cmdOption('d', 'dismiss', 'Note them as considered-and-dismissed and proceed'),
    ], { question: v.question })),
  ].join('\n');
}

// ---------------------------------------------------------------------------
// project-skills / linters — implementation's two setup discoveries. A fresh
// discovery renders the full worklist (name — detail rows, plus the
// installed-state tag and install recommendations for linters); confirming a
// project default renders compact — a count line over one comma run of
// names, because the set was already approved once and only needs to be
// seen, not studied.
// ---------------------------------------------------------------------------

const SETUP_VARIANTS = ['confirm', 'discovery', 'skipped'];

/**
 * Validate a name list and render the compact confirm body — the stored,
 * already-approved set as one comma run under a count line.
 * @param {unknown} v @param {string} surface @param {string} field @param {string} label
 * @returns {string}
 */
function setupNameRun(v, surface, field, label) {
  if (!Array.isArray(v) || v.length === 0) {
    throw new Error(`render ${surface}: "${field}" must be a non-empty array of names`);
  }
  const names = v.map((row, i) => {
    if (!isFilled(row)) throw new Error(`render ${surface}: ${field}[${i}] must be a non-empty string`);
    return escapeMarkdown(row);
  });
  // One authored line — the display's renderer soft-wraps the run.
  return [`**${label}** — ${names.length} from the project default`, '', names.join(', ')].join('\n');
}

/**
 * Validate a `{name, detail}` list and render it as the batch worklist.
 * `tagOf` answers a row's short state term, or null where none applies.
 * @param {unknown} v @param {string} surface @param {string} field @param {string} label @param {string} noun
 * @param {(row: any) => string|null} [tagOf]
 * @returns {string}
 */
function setupList(v, surface, field, label, noun, tagOf) {
  if (!Array.isArray(v) || v.length === 0) {
    throw new Error(`render ${surface}: "${field}" must be a non-empty array of {name, detail}`);
  }
  const items = v.map((row, i) => {
    if (!row || typeof row !== 'object') throw new Error(`render ${surface}: ${field}[${i}] must be an object`);
    if (!isFilled(row.name)) throw new Error(`render ${surface}: ${field}[${i}] is missing "name"`);
    if (!isFilled(row.detail)) throw new Error(`render ${surface}: ${field}[${i}] is missing "detail"`);
    const tag = tagOf ? tagOf(row) : null;
    return tag === null ? { title: `${row.name} — ${row.detail}` } : { title: `${row.name} — ${row.detail}`, tag };
  });
  return worklist({ heading: { label, noun }, items });
}

/**
 * @param {string} cwd
 * @param {{dotpath: string, file?: string, variant?: string}} args
 * @returns {string}
 */
function projectSkills(cwd, { dotpath, file, variant }) {
  if (!variant || !SETUP_VARIANTS.includes(variant)) {
    throw new Error(`render project-skills: --variant must be one of ${SETUP_VARIANTS.join('/')}`);
  }
  const { phase } = resolveAddress(cwd, dotpath, 'project-skills');
  if (phase !== 'implementation') {
    throw new Error(`render project-skills: address must be <work_unit>.implementation.<topic>, got phase "${phase}"`);
  }
  if (variant === 'skipped') {
    return [
      section('DISPLAY: project skills skipped', 'emit verbatim as markdown', 'Previous implementations used no project skills.'),
      section('MENU: project skills skipped gate', STOP_FOR_RESPONSE, menu('', [
        cmdOption('y', 'yes', 'Skip and proceed'),
        cmdOption('n', 'no', 'Analyse for project skills'),
      ], { question: 'Skip project skills again?' })),
    ].join('\n');
  }
  if (!file) throw new Error('render project-skills: --file <payload.json> is required');
  const p = readJsonPayload(cwd, file, 'project-skills');
  const confirm = variant === 'confirm';
  const body = confirm
    ? setupNameRun(p.skills, 'project-skills', 'skills', 'Project skills')
    : setupList(p.skills, 'project-skills', 'skills', 'Project skills', 'skill');
  return [
    section(`DISPLAY: project skills ${variant}`, 'emit verbatim as markdown', body),
    section(`MENU: project skills ${variant} gate`, STOP_FOR_RESPONSE, confirm
      ? menu('', [
        cmdOption('y', 'yes', 'Use and proceed'),
        cmdOption('n', 'no', 'Re-discover and choose skills'),
      ], { question: 'Use these project skills?' })
      : menu('', [
        cmdOption('a', 'all', 'Use all listed skills'),
        cmdOption('n', 'none', 'Skip project skills'),
        promptOption('List the ones you want', 'Name them — e.g. "golang-pro, react-patterns"'),
      ], { question: 'Which project skills should be used?' })),
  ].join('\n');
}

/**
 * @param {string} cwd
 * @param {{dotpath: string, file?: string, variant?: string}} args
 * @returns {string}
 */
function linters(cwd, { dotpath, file, variant }) {
  if (!variant || !SETUP_VARIANTS.includes(variant)) {
    throw new Error(`render linters: --variant must be one of ${SETUP_VARIANTS.join('/')}`);
  }
  const { phase } = resolveAddress(cwd, dotpath, 'linters');
  if (phase !== 'implementation') {
    throw new Error(`render linters: address must be <work_unit>.implementation.<topic>, got phase "${phase}"`);
  }
  if (variant === 'skipped') {
    return [
      section('DISPLAY: linters skipped', 'emit verbatim as markdown', 'Previous implementations skipped linters.'),
      section('MENU: linters skipped gate', STOP_FOR_RESPONSE, menu('', [
        cmdOption('y', 'yes', 'Skip and proceed'),
        cmdOption('n', 'no', 'Run full linter discovery'),
      ], { question: 'Skip linters again?' })),
    ].join('\n');
  }
  if (!file) throw new Error('render linters: --file <payload.json> is required');
  const p = readJsonPayload(cwd, file, 'linters');
  const discovery = variant === 'discovery';
  // A fresh discovery reports what is actually on the machine; a stored set
  // was already approved, so it renders compact with nothing to re-assert.
  const body = discovery
    ? setupList(p.linters, 'linters', 'linters', 'Linter discovery', 'linter', (row) => {
      if (typeof row.installed !== 'boolean') {
        throw new Error('render linters: every row of a discovery needs "installed" (true or false)');
      }
      return row.installed ? 'installed' : 'missing';
    })
    : setupNameRun(p.linters, 'linters', 'linters', 'Linters');
  const parts = [body];
  if (discovery && p.recommendations !== undefined) {
    if (!isFilled(p.recommendations)) throw new Error('render linters: "recommendations" must be a non-empty string when present');
    parts.push('', `**Recommended**: ${p.recommendations}`);
  }
  return [
    section(`DISPLAY: linters ${variant}`, 'emit verbatim as markdown', parts.join('\n')),
    section(`MENU: linters ${variant} gate`, STOP_FOR_RESPONSE, discovery
      ? menu('', [
        cmdOption('y', 'yes', 'Approve and proceed'),
        cmdOption('c', 'change', 'Modify the linter list'),
        cmdOption('s', 'skip', 'Skip linter setup (no linting during TDD)'),
      ], { question: 'Approve these linters?' })
      : menu('', [
        cmdOption('y', 'yes', 'Use and proceed'),
        cmdOption('n', 'no', 'Re-discover linters'),
      ], { question: 'Use these linters?' })),
  ].join('\n');
}

// ---------------------------------------------------------------------------
// incoherence-gate — the Resolve Source Incoherence raises (spec construction
// and the review findings walk). Three variants; the stops here override the
// calling flow's auto mode by design, so no --gate flag exists.
//   conflict  — the settle-it-here menu: one numbered option per documented
//               side (recommended first) plus Comment — classification is
//               Claude's, the menu offers only the documented sides
//   gap-route — the gap raise plus its gate (no "no" — an objection arrives
//               as Comment and drops into the settleable exchange): a linear
//               work unit has one home for the gap, so the menu states the
//               routing intent and confirms it; an epic has three — the
//               reopen, a new topic on the map, the roadmap — so it asks the
//               fork
//   held-doc  — the fallback when another session holds the owning document
// The raise body takes the finding idiom: bold head, one meta bullet per
// cited quote, a labelled context paragraph, stakes beneath.
// ---------------------------------------------------------------------------

const INCOHERENCE_STOP = 'emit verbatim as markdown, then STOP for the user\'s response';

// A stop that fires despite the user's auto opt-in says so, in one voice —
// the announcement is engine-rendered so it cannot vary with the session.
const AUTO_OVERRIDE_LINE = "**Auto is on — stopping anyway:** this is one of the calls auto never makes for you.";

// The two gates are independent opt-ins: construction's chunk approvals and
// the findings walk. A stop announces only against its own flow's mode — an
// auto set for the other gate is not being overridden.
const LANE_GATE_FIELDS = { construction: 'construction_gate_mode', review: 'finding_gate_mode' };

/** Whether the named lane's gate mode holds auto at this item. @param {any} item @param {string} lane */
const laneHoldsAuto = (item, lane) => item[LANE_GATE_FIELDS[lane]] === 'auto';

/**
 * @param {string} cwd
 * @param {{dotpath: string, file?: string, variant?: string}} args
 * @returns {string}
 */
function incoherenceGate(cwd, args) {
  const { dotpath, file, variant } = args;
  if (variant === undefined || !['conflict', 'gap-route', 'held-doc'].includes(variant)) {
    throw new Error('render incoherence-gate: --variant must be "conflict", "gap-route", or "held-doc"');
  }
  if (!file) throw new Error('render incoherence-gate: --file <payload.json> is required');
  const { workUnit, phase, topic, manifest } = resolveAddress(cwd, dotpath, 'incoherence-gate');
  const p = readJsonPayload(cwd, file, 'incoherence-gate');
  if (!isFilled(p.doc)) throw new Error('render incoherence-gate: "doc" must be a non-empty string');
  if (!Object.hasOwn(LANE_GATE_FIELDS, p.lane)) {
    throw new Error('render incoherence-gate: "lane" must be "construction" or "review" — the announcement keys on the calling flow\'s own gate mode');
  }
  const overAuto = laneHoldsAuto(itemOf(manifest, phase, topic) || {}, p.lane);

  if (variant === 'conflict' || variant === 'gap-route') {
    if (!isFilled(p.title)) throw new Error('render incoherence-gate: "title" must be a non-empty string');
    if (!isFilled(p.context)) throw new Error('render incoherence-gate: "context" must be a non-empty string');
    if (p.quotes !== undefined) {
      if (!Array.isArray(p.quotes) || p.quotes.length === 0) throw new Error('render incoherence-gate: "quotes" must be a non-empty array when present');
      p.quotes.forEach((/** @type {{doc?: string, section?: string, quote?: string}} */ q, /** @type {number} */ i) => {
        if (!q || typeof q !== 'object' || !isFilled(q.doc) || !isFilled(q.section) || !isFilled(q.quote)) {
          throw new Error(`render incoherence-gate: quotes[${i}] must carry doc, section, and quote`);
        }
      });
    }
    if (p.stakes !== undefined && !isFilled(p.stakes)) throw new Error('render incoherence-gate: "stakes" must be a non-empty string when present');
    const head = variant === 'conflict' ? 'Conflict' : 'Gap';
    const body = [`**${head} — ${p.title}**`];
    if (p.quotes) {
      body.push('');
      for (const q of p.quotes) body.push(`- **${q.doc} · ${q.section}**: "${q.quote}"`);
    }
    body.push('', `**Details**: ${p.context}`);
    if (p.stakes) body.push('', p.stakes);

    if (variant === 'conflict') {
      // A conflict is documents colliding, and the sides are quoted from
      // them — never composed here. Without a quote there is nothing to
      // collide, and the shape would dress a point no source decides as a
      // choice the record already framed. That belongs in the
      // no-sides-documented branch, as a question.
      if (!Array.isArray(p.quotes) || p.quotes.length === 0) {
        throw new Error('render incoherence-gate: a conflict must quote the sides it collides — sides you would compose yourself are not documented, and belong in a conversation, not this gate');
      }
      if (!Array.isArray(p.sides) || p.sides.length < 2) {
        throw new Error('render incoherence-gate: "sides" must carry at least 2 entries');
      }
      p.sides.forEach((/** @type {{summary?: string, recommended?: boolean}} */ s, /** @type {number} */ i) => {
        if (!s || typeof s !== 'object' || !isFilled(s.summary)) {
          throw new Error(`render incoherence-gate: sides[${i}].summary must be a non-empty string`);
        }
      });
      const options = recommendedMenuRows(p.sides, 'render incoherence-gate: at most one side may be recommended');
      const display = section('DISPLAY: incoherence conflict', 'emit verbatim as markdown', body.join('\n'));
      options.push(promptOption('Comment', 'Tell me what you\'re thinking; we\'ll work it through'));
      return [display, section('MENU: incoherence conflict', INCOHERENCE_STOP,
        menu(overAuto ? AUTO_OVERRIDE_LINE : '', options, { question: 'Which decision stands?' }))].join('\n');
    }
    const gap = manifest.work_type === 'epic'
      ? {
        statement: `The gap needs the room. Reopening "${p.doc}" with it pauses this specification until the answer lands; the map offers two other homes.`,
        question: 'Reopen it?',
        rows: [
          cmdOption('y', 'yes', `Reopen "${p.doc}" with the gap and pause here`),
          cmdOption('t', 'topic', 'Open a new topic on the map for it — this specification waits for it to conclude'),
          cmdOption('r', 'roadmap', "Park it on the roadmap — outside this specification's scope"),
        ],
      }
      : {
        statement: `Routing this to "${p.doc}" — it reopens with the gap, and this specification pauses until the answer lands.`,
        question: 'Proceed?',
        rows: [cmdOption('y', 'yes', 'Land the gap and pause here')],
      };
    return [
      section('DISPLAY: incoherence gap', 'emit verbatim as markdown', body.join('\n')),
      section('MENU: incoherence gap', INCOHERENCE_STOP, menu(
        `${overAuto ? `${AUTO_OVERRIDE_LINE}\n\n` : ''}${gap.statement}`,
        [...gap.rows, promptOption('Comment', 'Tell me what you\'re thinking before it moves')],
        { question: gap.question },
      )),
    ].join('\n');
  }
  const holder = heldDocument(cwd, workUnit, p.doc);
  const lastActive = holder ? ` — last active ${fmtAge(holder.age_seconds)} ago —` : ',';
  return section('MENU: incoherence held doc', INCOHERENCE_STOP, menu(
    `${overAuto ? `${AUTO_OVERRIDE_LINE}\n\n` : ''}"${p.doc}" is open in another session${lastActive} so the fix belongs there; this topic waits for it.`,
    [
      cmdOption('n', 'next', 'Queue the resolution and carry on here'),
      cmdOption('s', 'stop', 'Stop here; re-enter after that session lands it'),
    ],
    { question: 'How do you want to continue?' },
  ));
}

// ---------------------------------------------------------------------------
// resurface-gate — spec construction's Context Resurfacing gate: a diff over
// already-approved specification content plus its approval menu. Always
// gated — it changes blessed content, so construction auto never applies.
// `--view full` re-presents the full updated section (from the payload's
// `full` lines) with the menu minus the view option.
// ---------------------------------------------------------------------------

/**
 * @param {string} cwd
 * @param {{dotpath: string, file?: string, view?: string}} args
 * @returns {string}
 */
function resurfaceGate(cwd, args) {
  const { dotpath, file, view } = args;
  if (view !== undefined && view !== 'full') throw new Error('render resurface-gate: --view only accepts "full"');
  if (!file) throw new Error('render resurface-gate: --file <payload.json> is required');
  const { phase: rsPhase, topic: rsTopic, manifest: rsManifest } = resolveAddress(cwd, dotpath, 'resurface-gate');
  const p = readJsonPayload(cwd, file, 'resurface-gate');
  if (!isFilled(p.section)) throw new Error('render resurface-gate: "section" must be a non-empty string');

  const parts = [];
  const rsOverAuto = laneHoldsAuto(itemOf(rsManifest, rsPhase, rsTopic) || {}, 'construction');
  const menuOptions = [cmdOption('y', 'yes', 'Apply changes to specification')];

  if (view === 'full') {
    const lines = stringLines(p.full, 'resurface-gate', 'full');
    if (lines.length === 0) throw new Error('render resurface-gate: "full" must be non-empty for --view full');
    parts.push(section('DISPLAY: resurfacing full', 'emit verbatim as markdown',
      [`**Resurfacing: ${p.section}** — full updated section`, '', ...lines].join('\n')));
  } else {
    if (!p.diff || typeof p.diff !== 'object') throw new Error('render resurface-gate: "diff" is required');
    const body = [
      ...stringLines(p.diff.context_above || [], 'resurface-gate', 'diff.context_above').map((l) => ` ${l}`),
      ...stringLines(p.diff.current || [], 'resurface-gate', 'diff.current').map((l) => `-${l}`),
      ...stringLines(p.diff.proposed || [], 'resurface-gate', 'diff.proposed').map((l) => `+${l}`),
      ...stringLines(p.diff.context_below || [], 'resurface-gate', 'diff.context_below').map((l) => ` ${l}`),
    ];
    if ((p.diff.current || []).length + (p.diff.proposed || []).length === 0) {
      throw new Error('render resurface-gate: "diff" must carry at least one current/proposed line');
    }
    parts.push(section('DISPLAY: resurfacing', 'emit verbatim as markdown', `**Resurfacing: ${p.section}**`));
    parts.push(section('DISPLAY: resurfacing diff', 'emit verbatim as a diff code block (```diff fence)', body.join('\n')));
    if (stringLines(p.full || [], 'resurface-gate', 'full').length > 0) {
      menuOptions.push(cmdOption('v', 'view full', 'Show the full updated section, then decide'));
    }
  }
  menuOptions.push(promptOption('Tell me what to change', 'Revise before recording'));
  parts.push(section('MENU: resurface gate', INCOHERENCE_STOP,
    menu(rsOverAuto ? AUTO_OVERRIDE_LINE : '', menuOptions, { question: 'Record this to the specification verbatim?' })));
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// construction-gate — spec construction's per-topic approval. The draft
// presentation stays with the flow (artifact content, presented verbatim);
// this surface owns the state-branching moment after it: the gate mode is
// read from the manifest's construction_gate_mode at the dotpath, answering
// with the approval menu when gated and the auto announcement when auto.
// ---------------------------------------------------------------------------

/**
 * @param {string} cwd
 * @param {{dotpath: string}} args
 * @returns {string}
 */
function constructionGate(cwd, { dotpath }) {
  const { phase, topic, manifest } = resolveAddress(cwd, dotpath, 'construction-gate');
  const item = (((manifest.phases || {})[phase] || {}).items || {})[topic] || {};
  if (item.construction_gate_mode === 'auto') {
    return section(
      'DISPLAY: construction auto-approved',
      `after logging the content: ${AUTO_GATE_INSTRUCTION}`,
      `${titlecase(topic)} — auto-approved. Recording to the specification.`,
    );
  }
  return section('MENU: construction gate', INCOHERENCE_STOP, menu('', [
    cmdOption('y', 'yes', 'Add exactly as shown, no modifications'),
    cmdOption('a', 'auto', 'Approve this and all remaining topics automatically'),
    promptOption('Tell me what to change', 'Revise before recording'),
  ], { question: 'Record this to the specification verbatim?' }));
}

/**
 * @param {string} cwd
 * @param {{dotpath: string, file?: string}} args
 * @returns {string}
 */
function tasksOverview(cwd, { dotpath, file }) {
  if (!file) throw new Error('render tasks-overview: --file <payload.json> is required');
  resolveAddress(cwd, dotpath, 'tasks-overview');
  const p = readJsonPayload(cwd, file, 'tasks-overview');
  if (!isFilled(p.label)) throw new Error('render tasks-overview: "label" must be a non-empty string');
  if (!Array.isArray(p.tasks) || p.tasks.length === 0) {
    throw new Error('render tasks-overview: "tasks" must be a non-empty array of {title, severity, status?}');
  }
  p.tasks.forEach((t, i) => {
    if (!isFilled(t.title) || !isFilled(t.severity)) {
      throw new Error(`render tasks-overview: task ${i + 1} needs "title" and "severity"`);
    }
    if (t.status !== undefined && !WORKLIST_STATUSES.includes(t.status)) {
      throw new Error(`render tasks-overview: task ${i + 1} carries unknown status "${t.status}" (expected ${WORKLIST_STATUSES.join('/')})`);
    }
  });
  // Statuses come from the cycle's staging subtree — on a mid-approval
  // resume the decided rows render struck, so the re-render shows where the
  // walk stands rather than presenting the whole set as fresh.
  const body = worklist({
    heading: { label: p.label, noun: 'proposed task' },
    items: p.tasks.map((t) => ({ title: t.title, tag: t.severity, state: t.status })),
    walked: true,
    walkLine: true,
  });
  return section('DISPLAY: tasks overview', CONTINUE_MARKDOWN_INSTRUCTION, body);
}

// ---------------------------------------------------------------------------
// author-task-gate — the planning task-authoring per-task menu. The task
// detail itself is a verbatim file emission the flow owns; only the gate
// renders here. Scalars ride as flags.
// ---------------------------------------------------------------------------

/**
 * @param {string} cwd
 * @param {{dotpath: string, m?: string, total?: string, title?: string}} args
 * @returns {string}
 */
function authorTaskGate(cwd, { dotpath, m, total, title }) {
  resolveAddress(cwd, dotpath, 'author-task-gate');
  const mN = parseInt(m || '', 10);
  const totalN = parseInt(total || '', 10);
  if (!Number.isInteger(mN) || mN < 1) throw new Error('render author-task-gate: --m must be a positive integer');
  if (!Number.isInteger(totalN) || totalN < mN) throw new Error('render author-task-gate: --total must be an integer ≥ --m');
  if (!isFilled(title)) throw new Error('render author-task-gate: --title is required');
  return section(
    'MENU: author task gate',
    'emit verbatim as markdown, then STOP for the user\'s response',
    menu(`**Task ${mN} of ${totalN}: ${title}**`, [
      cmdOption('y', 'yes', 'Write it to the plan'),
      cmdOption('a', 'auto', 'Approve this and all remaining tasks automatically'),
      promptOption('Tell me what to change', 'what to revise in this task'),
      promptOption('Navigate', 'Tell me where to go: a different phase or task, or the leading edge'),
    ], { question: 'Write it to the plan?' }),
  );
}

// ---------------------------------------------------------------------------
// phase-tree — the multi-phase structure display (D5): numbered phase nodes
// with wrapped tree children, one visual grammar with the task list beneath.
// `--approve` appends the phase-structure approval menu.
// ---------------------------------------------------------------------------

/**
 * @param {string} cwd
 * @param {{dotpath: string, file?: string, approve?: string}} args
 * @returns {string}
 */
function phaseTree(cwd, args) {
  const { dotpath, file } = args;
  if (!file) throw new Error('render phase-tree: --file <payload.json> is required');
  resolveAddress(cwd, dotpath, 'phase-tree');
  const p = readJsonPayload(cwd, file, 'phase-tree');
  if (!Array.isArray(p.phases) || p.phases.length === 0) {
    throw new Error('render phase-tree: "phases" must be a non-empty array of {name, detail?}');
  }
  const count = p.phases.length;
  const lines = [`Phase structure — ${count} phase${count === 1 ? '' : 's'}.`, ''];
  p.phases.forEach((ph, i) => {
    if (!isFilled(ph.name)) throw new Error(`render phase-tree: phase ${i + 1} needs "name"`);
    lines.push(`${i + 1}. ${ph.name}`);
    if (ph.detail !== undefined) {
      if (!Array.isArray(ph.detail) || ph.detail.length === 0
        || ph.detail.some((d) => !Array.isArray(d) || d.length !== 2 || !isFilled(d[0]) || !(typeof d[1] === 'number' || isFilled(d[1])))) {
        throw new Error(`render phase-tree: phase ${i + 1} "detail" must be a non-empty array of [label, value] pairs`);
      }
      lines.push(treeList(ph.detail.map(([label, value]) => `${label}: ${value}`), { indent: '   ' }));
    }
    if (i < count - 1) lines.push('');
  });
  const parts = [section('DISPLAY: phase tree', 'emit verbatim as a code block', lines.join('\n'))];
  if ('approve' in args) {
    parts.push(section(
      'MENU: phase structure gate',
      'emit verbatim as markdown, then STOP for the user\'s response',
      menu('Approve this phase structure?', [
        cmdOption('y', 'yes', 'Proceed to task breakdown'),
        cmdOption('v', 'view full', 'Show the full phase structure — goals, ordering rationale, acceptance criteria'),
        promptOption('Tell me what to change', 'which phases to reorder, split, merge, add, edit, or remove'),
        promptOption('Navigate', 'Tell me where to go: a different phase or task, or the leading edge'),
      ]),
    ));
  }
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// findings-summary / finding — the review-findings loop shared by the
// planning and specification review flows. Findings live in markdown tracking
// files, which the model reads (the engine never parses markdown) and hands
// over as a JSON payload; the gate mode is manifest state at the address.
// A finding is report-class content: it leads with what is wrong in the
// terms the user cares about, and the artifact text is the payload of the
// fix rather than its explanation. A short diff renders in place as one
// ```diff-fenced section — colouring keys on the column-0 markers, and
// space-prefixed context lines place the change — while a whole proposed
// section waits behind `v/view`, which renders it as markdown. Source read
// aloud is what buries the report. No drawn borders anywhere.
// ---------------------------------------------------------------------------

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

/** @param {unknown} v @param {string} surface @param {string} field @returns {string[]} */
function stringLines(v, surface, field) {
  if (!Array.isArray(v) || v.some((l) => typeof l !== 'string')) {
    throw new Error(`render ${surface}: "${field}" must be an array of strings`);
  }
  return v;
}

/**
 * The recommended-first menu rows shared by proposed-task's decision, the
 * incoherence conflict, and the choice finding: at most one entry marked
 * (the caller owns the error text), the marked one first, "(recommended)"
 * as its suffix. A side is one menu row, so a newline in any summary is
 * refused here — the single home where model-authored sides become rows.
 * @param {{summary: string, recommended?: boolean}[]} sides @param {string} atMostOne
 * @returns {string[]}
 */
function recommendedMenuRows(sides, atMostOne) {
  const multiline = sides.findIndex((s) => /\n/.test(s.summary));
  if (multiline >= 0) throw new Error(`a side is one menu row — sides[${multiline}].summary must be a single line`);
  if (sides.filter((s) => s.recommended === true).length > 1) throw new Error(atMostOne);
  const ordered = [...sides].sort((a, b) => Number(b.recommended === true) - Number(a.recommended === true));
  return ordered.map((s, i) => cmdOption(String(i + 1), null, `${s.summary}${s.recommended === true ? ' (recommended)' : ''}`));
}

/**
 * @param {string} cwd
 * @param {{dotpath: string, file?: string}} args
 * @returns {string}
 */
function findingsSummary(cwd, { dotpath, file }) {
  if (!file) throw new Error('render findings-summary: --file <payload.json> is required');
  resolveAddress(cwd, dotpath, 'findings-summary');
  const p = readJsonPayload(cwd, file, 'findings-summary');
  if (!isFilled(p.review_label)) throw new Error('render findings-summary: "review_label" must be a non-empty string');
  if (!Array.isArray(p.items) || p.items.length === 0) {
    throw new Error('render findings-summary: "items" must be a non-empty array of {title, tag, summary}');
  }
  p.items.forEach((it, i) => {
    for (const field of ['title', 'tag', 'summary']) {
      if (!isFilled(it[field])) throw new Error(`render findings-summary: item ${i + 1} is missing "${field}"`);
    }
    if (it.status !== undefined && !WORKLIST_STATUSES.includes(it.status)) {
      throw new Error(`render findings-summary: item ${i + 1} carries unknown status "${it.status}" (expected ${WORKLIST_STATUSES.join('/')})`);
    }
  });
  // Statuses come from the tracking file's resolutions — a re-entry over a
  // partially-processed review shows which findings are already settled.
  const body = worklist({
    heading: { label: p.review_label, noun: 'finding' },
    items: p.items.map((it) => ({ title: it.title, tag: it.tag, note: it.summary, state: it.status })),
    walked: true,
    walkLine: true,
  });
  return section('DISPLAY: findings summary', CONTINUE_MARKDOWN_INSTRUCTION, body);
}

// review-presentation — the review's outcome, after the do-now work has
// been applied. What is listed is only what the user acts on: the findings
// that failed the review and must be planned, and — as a count, named in
// the report — the criteria the review could not measure. Corrections are
// a count — they are already made, gated by the suite and verified, so a
// list would put pages nobody reads in front of the one decision that
// matters. The judgment (which items, worded how) rides as the payload;
// the shape is this surface's rule, so it cannot drift per verdict or per
// author.

/**
 * @param {string} cwd
 * @param {{dotpath: string, file?: string}} args
 * @returns {string}
 */
function reviewPresentation(cwd, { dotpath, file }) {
  if (!file) throw new Error('render review-presentation: --file <payload.json> is required');
  const { phase } = resolveAddress(cwd, dotpath, 'review-presentation');
  if (phase !== 'review') {
    throw new Error(`render review-presentation: address must be <work_unit>.review.<topic>, got phase "${phase}"`);
  }
  const p = readJsonPayload(cwd, file, 'review-presentation');
  if (!isFilled(p.topic)) throw new Error('render review-presentation: "topic" must be a non-empty string');
  if (p.verdict !== 'pass' && p.verdict !== 'fail') {
    throw new Error('render review-presentation: "verdict" must be "pass" or "fail"');
  }
  const replan = p.replan === undefined ? [] : p.replan;
  if (!Array.isArray(replan)) throw new Error('render review-presentation: "replan" must be an array');
  replan.forEach((r, i) => {
    if (!isFilled(r.summary) || !isFilled(r.fails)) {
      throw new Error(`render review-presentation: replan[${i}] needs "summary" and "fails"`);
    }
  });
  // The verdict and the list must agree — a fail with nothing to plan, or a
  // pass carrying planned work, is a caller bug, never something to render.
  if (p.verdict === 'fail' && replan.length === 0) {
    throw new Error('render review-presentation: a fail must carry at least one "replan" finding');
  }
  if (p.verdict === 'pass' && replan.length > 0) {
    throw new Error('render review-presentation: a pass cannot carry "replan" findings');
  }

  const title = titlecase(p.topic);
  const sections = [
    titleSection(`Review — ${title}`),
  ];
  if (p.verdict === 'fail') {
    const n = replan.length;
    sections.push(section(
      'DISPLAY: review verdict',
      'emit verbatim as a properties code block — ```properties fence',
      `⚑ Failed — ${n} finding${n === 1 ? '' : 's'} must be planned and built before this work is delivered`,
    ));
  } else {
    sections.push(section(
      'DISPLAY: review verdict',
      CONTINUE_MARKDOWN_INSTRUCTION,
      '**Passed** — nothing needs planning.',
    ));
  }

  const body = [];
  if (p.verdict === 'fail') {
    body.push(worklist({
      heading: { label: 'Needs planning', noun: 'finding' },
      items: replan.map((r) => ({
        title: r.summary,
        note: isFilled(r.ref) ? `${r.ref} — ${r.fails}` : r.fails,
      })),
    }));
  }
  const tail = [];
  if (p.corrected !== undefined) {
    const c = p.corrected;
    if (!Number.isInteger(c.applied) || c.applied < 0 || (c.suite !== 'green' && c.suite !== 'red')) {
      throw new Error('render review-presentation: "corrected" needs integer "applied" and "suite" green|red');
    }
    let line = `Corrected in this session: ${c.applied} applied · suite ${c.suite}`;
    if (Number(c.reverted) > 0) line += ` · ${c.reverted} reverted, still owed`;
    tail.push(line + '.');
  }
  if (Number(p.out_of_scope) > 0) {
    const n = Number(p.out_of_scope);
    const outside = `Outside this spec: ${n} finding${n === 1 ? '' : 's'}`;
    tail.push(p.verdict === 'pass' ? `${outside} — each decided below.` : `${outside} — held until the review closes.`);
  }
  if (Number(p.discarded) > 0) {
    tail.push(`Discarded: ${p.discarded} — reasons in the report.`);
  }
  if (p.not_measured !== undefined) {
    const n = p.not_measured;
    if (!Number.isInteger(n) || n < 0) {
      throw new Error('render review-presentation: "not_measured" must be a non-negative integer');
    }
    if (n > 0) tail.push(`Not measured: ${n} criteri${n === 1 ? 'on' : 'a'} — named in the report.`);
  }
  if (tail.length) body.push(tail.join('\n'));
  if (body.length) {
    sections.push(section('DISPLAY: review findings', CONTINUE_MARKDOWN_INSTRUCTION, body.join('\n\n')));
  }
  return sections.join('\n');
}

// review-gate — the review's closing menu. Membership follows the verdict:
// a fail routes to planning and nothing else; a pass completes, its label
// naming where completing lands. Review is every pipeline's last phase, so
// only an epic has anything to return to — every other type finishes there.

/** Where completing the review lands, by work type. */
const REVIEW_LANDINGS = {
  epic: 'return to the epic',
  feature: 'finish the feature',
  bugfix: 'finish the bugfix',
  'quick-fix': 'finish the quick-fix',
};

/**
 * @param {string} cwd
 * @param {{dotpath: string, verdict?: string, replan?: string}} args
 * @returns {string}
 */
function reviewGate(cwd, args) {
  const { phase, manifest } = resolveAddress(cwd, args.dotpath, 'review-gate');
  if (phase !== 'review') {
    throw new Error(`render review-gate: address must be <work_unit>.review.<topic>, got phase "${phase}"`);
  }
  const verdict = args.verdict;
  if (verdict !== 'pass' && verdict !== 'fail') {
    throw new Error('render review-gate: --verdict must be "pass" or "fail"');
  }
  const options = [];
  if (verdict === 'fail') {
    const n = Number(args.replan);
    if (!Number.isInteger(n) || n < 1) throw new Error('render review-gate: a fail needs --replan <count>');
    options.push(cmdOption('p', 'plan', `Plan the ${n} failure${n === 1 ? '' : 's'} and reopen implementation`));
  } else {
    const landing = REVIEW_LANDINGS[manifest.work_type] || 'finish the work';
    options.push(cmdOption('c', 'complete', `Complete the review and ${landing}`));
  }
  options.push(promptOption('Ask', 'Ask me about any finding'));
  return section(
    'MENU: review gate',
    "emit verbatim as markdown, then STOP for the user's response",
    menu('', options, { question: 'What next?' }),
  );
}

// reroute-offer — the off-topic reroute's consent gate. The concern and,
// when one home is clear, the resolved target with its judged landing
// phase are judgment content; the chrome and the options are fixed. Two
// flags shape what the offer says about the destination: `new_target` — the
// home is a name the map does not hold yet, so rerouting creates it — and
// `grown`, the same creation reached from the other end, where the thread
// itself outgrew this topic. Grown implies new: a thread that grew into its
// own topic has nowhere existing to go.

/**
 * @param {string} cwd
 * @param {{dotpath: string, file?: string}} args
 * @returns {string}
 */
function rerouteOffer(cwd, { dotpath, file }) {
  if (!file) throw new Error('render reroute-offer: --file <payload.json> is required');
  resolveAddress(cwd, dotpath, 'reroute-offer');
  const p = readJsonPayload(cwd, file, 'reroute-offer');
  if (!isFilled(p.concern)) throw new Error('render reroute-offer: "concern" must be a non-empty string');
  for (const flag of ['new_target', 'grown']) {
    if (p[flag] !== undefined && typeof p[flag] !== 'boolean') {
      throw new Error(`render reroute-offer: "${flag}" must be true or false`);
    }
  }
  const hasTarget = isFilled(p.target);
  const hasPhase = isFilled(p.landing_phase);
  if (hasTarget !== hasPhase) {
    throw new Error('render reroute-offer: "target" and "landing_phase" come together — both for a clear home, neither otherwise');
  }
  if (hasPhase && !['research', 'discussion'].includes(p.landing_phase)) {
    throw new Error(`render reroute-offer: "landing_phase" must be "research" or "discussion", got "${p.landing_phase}"`);
  }
  const grown = p.grown === true;
  if (grown && !hasTarget) {
    throw new Error('render reroute-offer: "grown" needs "target" and "landing_phase" — a thread that grew into its own topic carries the name it grew into');
  }
  if (p.new_target === true && !hasTarget) {
    throw new Error('render reroute-offer: "new_target" needs "target" — there is no new topic without a name');
  }
  let label;
  if (grown) {
    label = `**${p.concern}** has grown into its own topic here.\n`
      + `Rerouting creates **${p.target}** on the map, landing ${p.landing_phase}-side — the material stays in this file and feeds the new topic through the queue entry and the provenance read at its discussion. Append a phase to override (e.g. \`r discussion\`).`;
  } else if (hasTarget) {
    label = `**${p.concern}** belongs to a different topic, not this one.\n`
      + `It reads as **${p.target}**'s ground, landing ${p.landing_phase}-side — append a phase to override (e.g. \`r discussion\`).`;
    if (p.new_target === true) label += `\n**${p.target}** isn't on the map yet — rerouting creates it.`;
  } else {
    label = `**${p.concern}** belongs to a different topic, not this one.`;
  }
  return section(
    'MENU: reroute offer',
    "emit verbatim as markdown, then STOP for the user's response",
    menu(label, [
      cmdOption('r', 'reroute', 'Send it to the topic it belongs to; it picks it up later'),
      cmdOption('k', 'keep', 'Keep it here as part of this topic'),
    ], { question: 'Where should it live?' }),
  );
}

// research-threads — the thread register: what the topic set out to learn,
// rendered at the session's transitions and as the conclusion's hand-off.
// The register is a lens — nothing gates on a thread's state, so the
// display is the whole response and carries the continue instruction; an
// empty register answers empty, so no caller renders a header over nothing.

/** The register block wrapped as its DISPLAY section. @param {string} topic @param {object} manifest @param {string} instruction */
function researchThreadsSection(topic, manifest, instruction) {
  return section('DISPLAY: research threads', instruction, researchThreads(topic, manifest));
}

/**
 * @param {string} cwd
 * @param {{dotpath: string}} args
 * @returns {string}
 */
function researchThreadsSurface(cwd, { dotpath }) {
  const { topic, manifest } = resolveResearch(cwd, dotpath, 'research-threads');
  if (registerState(manifest, topic).total === 0) return '';
  return researchThreadsSection(topic, manifest, CONTINUE_INSTRUCTION);
}

// research-conclude-gate — the topic-completion consent gate, the register
// above it whenever the topic holds a thread (open is a fine way to
// conclude — the register is the hand-off, never a block). The dead-end row
// renders only when the session's own conclusion is that the topic gives
// the product nothing to carry forward under its own name — the judgment
// travels as the --dead-end flag, never derived here.

/**
 * @param {string} cwd
 * @param {{dotpath: string, 'dead-end'?: string}} args
 * @returns {string}
 */
function researchConcludeGate(cwd, args) {
  const { topic, manifest } = resolveResearch(cwd, args.dotpath, 'research-conclude-gate');
  const options = [
    cmdOption('y', 'yes', 'Mark this topic as complete, ready for discussion'),
  ];
  if (args['dead-end']) {
    options.push(cmdOption('d', 'dead-end', 'Close it as a dead end — completed and kept as record, no discussion owed; reversible from the map'));
  }
  options.push(cmdOption('k', 'keep', "Keep digging, there's more to understand"));
  const gate = section(
    'MENU: research conclude gate',
    "emit verbatim as markdown, then STOP for the user's response",
    menu('This topic looks ready to conclude.', options, { question: 'Conclude it?' }),
  );
  const register = registerState(manifest, topic).total > 0
    ? researchThreadsSection(topic, manifest, 'emit verbatim as a code block')
    : '';
  return register + gate;
}

/**
 * Pin a research address, refusing any other phase by name.
 * @param {string} cwd @param {string} dotpath @param {string} surface
 * @returns {{workUnit: string, phase: string, topic: string, manifest: object}}
 */
function resolveResearch(cwd, dotpath, surface) {
  const resolved = resolveAddress(cwd, dotpath, surface);
  if (resolved.phase !== 'research') {
    throw new Error(`render ${surface}: address must be <work_unit>.research.<topic>, got phase "${resolved.phase}"`);
  }
  return resolved;
}

// deep-dive-offer — the orchestrator's dispatch offer over a thread it judged
// worth investigating independently. The thread's question is the judgment
// content; the two-line opening and the y/n pair are fixed. The two lines
// split by role: the statement names what was noticed and stays context, the
// question beneath it is the ask and takes the decision glyph.

/**
 * @param {string} cwd
 * @param {{dotpath: string, file?: string}} args
 * @returns {string}
 */
function deepDiveOffer(cwd, { dotpath, file }) {
  if (!file) throw new Error('render deep-dive-offer: --file <payload.json> is required');
  resolveResearch(cwd, dotpath, 'deep-dive-offer');
  const p = readJsonPayload(cwd, file, 'deep-dive-offer');
  if (!isFilled(p.thread)) {
    throw new Error('render deep-dive-offer: "thread" must be a non-empty string — the thread\'s question as it opens the offer');
  }
  return section('MENU: deep dive offer', STOP_FOR_RESPONSE, menu(
    `A thread worth digging: ${p.thread}`,
    [
      cmdOption('y', 'yes', 'Dispatch a deep-dive agent'),
      cmdOption('n', 'no', "Skip, we'll cover it in conversation"),
    ],
    { question: 'Send a deep dive after it while we keep going?' },
  ));
}

// perspective-offer — the discussion orchestrator's offer to argue a decision
// from two opposing lenses. The tension description is the judgment content;
// the statement names the tension and stays context, the question beneath it
// is the ask and takes the decision glyph.

/**
 * @param {string} cwd
 * @param {{dotpath: string, file?: string}} args
 * @returns {string}
 */
function perspectiveOffer(cwd, { dotpath, file }) {
  if (!file) throw new Error('render perspective-offer: --file <payload.json> is required');
  const { phase } = resolveAddress(cwd, dotpath, 'perspective-offer');
  if (phase !== 'discussion') {
    throw new Error(`render perspective-offer: address must be <work_unit>.discussion.<topic>, got phase "${phase}"`);
  }
  const p = readJsonPayload(cwd, file, 'perspective-offer');
  if (!isFilled(p.tension)) {
    throw new Error('render perspective-offer: "tension" must be a non-empty string — the tension description as it opens the offer');
  }
  return section('MENU: perspective offer', STOP_FOR_RESPONSE, menu(
    `This decision sits on a ${p.tension} tension.`,
    [
      cmdOption('y', 'yes', 'Spin up perspective agents arguing each lens'),
      cmdOption('n', 'no', 'Continue without perspectives'),
    ],
    { question: 'Want to explore both lenses?' },
  ));
}

// in-flight-agents-gate — the wait-or-conclude gate a session takes when
// background agents are still running at conclusion. Research and discussion
// both dispatch and both conclude, so the gate serves the pair. Served to the
// epic and feature sessions alike: the shape is one gate, and the count is
// the session's own (this session's dispatches, an earlier session's dead
// rows already closed), so it rides as a scalar flag rather than being
// re-derived. The opening line reports what is still running; the ask
// beneath it is fixed.

/**
 * @param {string} cwd
 * @param {{dotpath: string, count?: string}} args
 * @returns {string}
 */
function inFlightAgentsGate(cwd, { dotpath, count }) {
  const { phase } = resolveAddress(cwd, dotpath, 'in-flight-agents-gate');
  if (phase !== 'research' && phase !== 'discussion') {
    throw new Error(`render in-flight-agents-gate: address must be <work_unit>.research|discussion.<topic>, got phase "${phase}"`);
  }
  const n = Number(count);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`render in-flight-agents-gate: --count must be a positive integer, got "${count}"`);
  }
  return section('MENU: in-flight agents gate', STOP_FOR_RESPONSE, menu(
    n === 1 ? 'There is still 1 background agent working.' : `There are still ${n} background agents working.`,
    [
      cmdOption('w', 'wait', 'Wait for results before concluding'),
      cmdOption('p', 'proceed', 'Conclude now (results will persist in cache for reference)'),
    ],
    { question: 'Wait, or conclude now?' },
  ));
}

// review-findings-gate — the discussion conclusion's drain offer over a
// review report whose findings are still to be walked. The count is the
// row's own (`remaining` on the acknowledged review row), so the surface
// reads the agent store and refuses any state the calling prose never
// renders it from. The report may be a background pass or the closing pass
// — the wording claims neither.

/**
 * @param {string} cwd
 * @param {{dotpath: string}} args
 * @returns {string}
 */
function reviewFindingsGate(cwd, { dotpath }) {
  const { workUnit, phase, topic } = resolveAddress(cwd, dotpath, 'review-findings-gate');
  if (phase !== 'discussion') {
    throw new Error(`render review-findings-gate: address must be <wu>.discussion.<topic> — the discussion close is the flow that runs this gate; got phase "${phase}"`);
  }
  const row = latestReview(cwd, workUnit, topic);
  if (!row) {
    throw new Error('render review-findings-gate: no review has been dispatched on this topic — the gate follows an acknowledged report');
  }
  if (row.status !== 'acknowledged') {
    throw new Error(`render review-findings-gate: the latest review row "${row.id}" is ${row.status} — the gate follows an acknowledged report with findings still to walk`);
  }
  const n = row.remaining.length;
  return section('MENU: review findings gate', STOP_FOR_RESPONSE, menu(
    `The review left ${n} finding${n === 1 ? '' : 's'} still to walk.`,
    [
      cmdOption('y', 'yes', 'Work through them now'),
      cmdOption('s', 'skip', 'Acknowledge and conclude the topic'),
    ],
    { question: 'Walk them now?' },
  ));
}

// off-topic-offer — the single-topic counterpart of reroute-offer: with no
// sibling topic to route the concern to, it is logged, pivoted into an epic,
// or noted in place. The pivot row exists only for a feature — the one type
// that can become an epic — and is derived from the manifest, never asked
// for and never carried in the payload.

/**
 * @param {string} cwd
 * @param {{dotpath: string, file?: string, variant?: string}} args
 * @returns {string}
 */
function offTopicOffer(cwd, { dotpath, file, variant }) {
  if (!file) throw new Error('render off-topic-offer: --file <payload.json> is required');
  if (variant !== undefined && variant !== 'discussion') {
    throw new Error('render off-topic-offer: --variant takes "discussion" (omit it for the research shape)');
  }
  const { manifest } = resolveAddress(cwd, dotpath, 'off-topic-offer');
  const p = readJsonPayload(cwd, file, 'off-topic-offer');
  if (!isFilled(p.concern)) throw new Error('render off-topic-offer: "concern" must be a non-empty string');
  const discussion = variant === 'discussion';
  const options = [cmdOption('l', 'log', 'Capture it as an idea in the inbox for later')];
  // The roadmap park is discussion's valve — research has no roadmap route.
  if (discussion) {
    options.push(cmdOption('r', 'roadmap', 'Put it on the product roadmap for a later release'));
  }
  if (manifest.work_type === 'feature') {
    options.push(cmdOption('p', 'pivot', 'Convert this work to an epic so it can hold the concern as its own topic'));
  }
  options.push(cmdOption('i', 'ignore', discussion ? 'Note it in the Summary and move on' : 'Note it in the research file and move on'));
  return section(
    'MENU: off-topic offer',
    "emit verbatim as markdown, then STOP for the user's response",
    menu(`**${p.concern}** is beyond this topic's scope.`, options, { question: 'Where should it go?' }),
  );
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
  if (!isFilled(p.idea)) throw new Error('render backlog-gate: "idea" must be a non-empty string');
  return section('MENU: backlog gate', STOP_FOR_RESPONSE, menu(
    `Setting **${p.idea}** aside.`,
    [
      cmdOption('r', 'roadmap', 'The product roadmap — next, or soon after this work'),
      cmdOption('i', 'inbox', 'The inbox — someday, picked up when it is picked up'),
    ],
    { question: 'Which backlog?' },
  ));
}

// reroute-candidates — the ambiguous reroute's selection gate. The plausible
// homes and the judged landing phase are judgment content; the numbering,
// the new-topic option, and the override grammar are fixed. A candidate's
// state reaches the user in the map's own words: the raw lifecycle token is
// manifest vocabulary, so it goes through the same label every map render
// uses rather than being echoed at a reader.

/**
 * @param {string} cwd
 * @param {{dotpath: string, file?: string}} args
 * @returns {string}
 */
function rerouteCandidates(cwd, { dotpath, file }) {
  if (!file) throw new Error('render reroute-candidates: --file <payload.json> is required');
  resolveAddress(cwd, dotpath, 'reroute-candidates');
  const p = readJsonPayload(cwd, file, 'reroute-candidates');
  if (!isFilled(p.concern)) throw new Error('render reroute-candidates: "concern" must be a non-empty string');
  if (!['research', 'discussion'].includes(p.landing_phase)) {
    throw new Error(`render reroute-candidates: "landing_phase" must be "research" or "discussion", got "${p.landing_phase}"`);
  }
  if (!Array.isArray(p.candidates) || p.candidates.length === 0) {
    throw new Error('render reroute-candidates: "candidates" must be a non-empty array of {name, lifecycle}');
  }
  const options = p.candidates.map((c, i) => {
    for (const field of ['name', 'lifecycle']) {
      if (!isFilled(c[field])) throw new Error(`render reroute-candidates: candidate ${i + 1} is missing "${field}"`);
    }
    if (!Object.hasOwn(DISCOVERY_GLYPH, c.lifecycle)) {
      throw new Error(`render reroute-candidates: candidate ${i + 1} carries unknown lifecycle "${c.lifecycle}" (expected ${Object.keys(DISCOVERY_GLYPH).join('/')})`);
    }
    return cmdOption(String(i + 1), null, `${c.name} [${discoveryLifecycleLabel(c.lifecycle, c.routing, c.research_state)}]`);
  });
  options.push(cmdOption('n', 'new', 'Create a new topic for it'));
  const prompt = p.landing_phase === 'research'
    ? 'It reads as an open question — I\'d land it research-side. Reply with an option, appending a phase to override (e.g. `1 discussion`).'
    : 'It reads as a decision to make — I\'d land it discussion-side. Reply with an option, appending a phase to override (e.g. `1 research`).';
  return section(
    'MENU: reroute candidates',
    "emit verbatim as markdown, then STOP for the user's response",
    menu(`**${p.concern}** belongs to a different topic, not this one.`, options, { question: 'Where should it land?', prompt }),
  );
}

// ---------------------------------------------------------------------------
// The discovery-map gates. A map edit, a staged candidate, a name collision
// and a closed reroute target each stop the same way: the proposal above,
// the confirm beneath. Judgment supplies the names and values; the bodies,
// the questions and the option sets are fixed here, so a gate reads the same
// whichever flow raised it and at any width.
// ---------------------------------------------------------------------------

// A bare yes/no pair — no labels, because the question above them already
// says what yes means (CONVENTIONS.md: Yes/no prompt).
const YES_NO = [bareOption('y', 'yes'), bareOption('n', 'no')];

// The map-operation family: op → the confirm question its gate asks. The
// batch ops (a run of summary or description edits confirmed together) ask
// once for the whole batch; every other op is its own group of one.
const MAP_OP_QUESTIONS = {
  'edit-summary': 'Apply?',
  'edit-description': 'Apply?',
  remove: 'Confirm removal?',
  rename: 'Confirm rename?',
  reroute: 'Confirm routing change?',
  close: 'Confirm close as dead end?',
  reopen: 'Confirm reopen?',
};

/** @param {object} p @param {string} field @returns {string} */
function mapOpName(p, field) {
  if (!isFilled(p[field])) throw new Error(`render map-op-gate: "${field}" must be a non-empty string`);
  return p[field];
}

/**
 * The batch rows of an edit op: `[{name, <field>}]`, at least one.
 * @param {object} p @param {string} field @returns {{name: string, value: string}[]}
 */
function mapOpRows(p, field) {
  if (!Array.isArray(p.items) || p.items.length === 0) {
    throw new Error(`render map-op-gate: "items" must be a non-empty array of {name, ${field}}`);
  }
  return p.items.map((row, i) => {
    for (const key of ['name', field]) {
      if (!row || !isFilled(row[key])) {
        throw new Error(`render map-op-gate: item ${i + 1} is missing "${key}" (each item needs name and ${field})`);
      }
    }
    return { name: row.name, value: row[field] };
  });
}

/** @param {string} value @param {string} field @returns {string} */
function mapOpRouting(value, field) {
  if (!['research', 'discussion'].includes(value)) {
    throw new Error(`render map-op-gate: "${field}" must be "research" or "discussion", got "${value}"`);
  }
  return value;
}

/**
 * The proposal body for one map operation.
 * @param {string} op @param {object} p @returns {string[]}
 */
function mapOpBody(op, p) {
  if (op === 'edit-summary' || op === 'edit-description') {
    const field = op === 'edit-summary' ? 'summary' : 'description';
    const noun = op === 'edit-summary' ? 'summary(ies)' : 'description(s)';
    const rows = mapOpRows(p, field);
    return [
      `Updating ${rows.length} ${noun}:`,
      '',
      ...rows.flatMap((r) => bulletRow(`${r.name}: "${r.value}"`)),
    ];
  }
  if (op === 'remove') {
    return [
      `Remove "${mapOpName(p, 'name')}" from the map.`,
      '',
      ...indentedBody([
        'Lifecycle: fresh — no work has started on this topic.',
        "The name will be added to the dismissed list so the analysis won't auto-re-propose it.",
      ]),
    ];
  }
  if (op === 'rename') {
    return [
      `Rename "${mapOpName(p, 'name')}" → "${mapOpName(p, 'new_name')}".`,
      '',
      ...indentedBody([
        'Lifecycle: fresh — no work has started, no files exist under this name. Manifest mutation only.',
      ]),
    ];
  }
  if (op === 'reroute') {
    const name = mapOpName(p, 'name');
    const from = mapOpRouting(p.from, 'from');
    const to = mapOpRouting(p.to, 'to');
    if (from === to) throw new Error('render map-op-gate: "from" and "to" name the same routing — nothing to confirm');
    return [
      `Change routing of "${name}": ${from} → ${to}.`,
      '',
      ...indentedBody(['Lifecycle: fresh — no work has started, so the routing hint is mutable.']),
    ];
  }
  if (op === 'close') {
    const name = mapOpName(p, 'name');
    return [
      `Close "${name}" as a dead end.`,
      '',
      ...indentedBody([
        'It stays on the map and in the knowledge base as record and seed material, but stops '
        + 'prompting for a next action and no longer counts against convergence — nothing to carry '
        + `forward under its own name. Reversible with "reopen ${name}".`,
      ]),
    ];
  }
  return [
    `Reopen "${mapOpName(p, 'name')}".`,
    '',
    ...indentedBody([
      'Clears the dead-end marker. The topic returns to its name-matched lifecycle and counts against convergence again.',
    ]),
  ];
}

// The names one op touches: a run of rows for the batch edits, the single
// subject otherwise. The op's own payload validation has already run, so
// every name here is a filled string.
/** @param {string} op @param {object} p @returns {string[]} */
function mapOpTargets(op, p) {
  if (op === 'edit-summary') return mapOpRows(p, 'summary').map((r) => r.name);
  if (op === 'edit-description') return mapOpRows(p, 'description').map((r) => r.name);
  return [mapOpName(p, 'name')];
}

// The lifecycle each op is legal from, mirroring map-operations.md's
// validation table — the prose pre-checks and the engine's write path both
// enforce it, and the gate refuses in between rather than confirming an
// operation that cannot land. The lifecycle join is the one every map
// consumer uses, so the three cannot drift apart.
/** @param {object} manifest @param {string} op @param {string} name */
function assertMapOp(manifest, op, name) {
  const items = (((manifest.phases || {}).discovery || {}).items) || {};
  if (!items[name]) throw new Error(`render map-op-gate: no discovery item "${name}" on the map`);
  if (op === 'edit-summary' || op === 'edit-description') return;
  const { lifecycle } = computeTopicLifecycle(manifest, name);
  if (op === 'close') {
    if (lifecycle === 'handled') {
      throw new Error(`render map-op-gate: "${name}" can't be closed as a dead end — it's already closed`);
    }
    if (lifecycle === 'cancelled') {
      throw new Error(`render map-op-gate: "${name}" can't be closed as a dead end — it's cancelled; reactivate it from the epic menu first`);
    }
    if (lifecycle === 'postponed') {
      throw new Error(`render map-op-gate: "${name}" can't be closed as a dead end — it's postponed; pull it forward from the roadmap first`);
    }
    return;
  }
  if (op === 'reopen') {
    if (lifecycle !== 'handled') {
      throw new Error(`render map-op-gate: "${name}" can't be reopened — it's "${lifecycle}", not closed as a dead end`);
    }
    return;
  }
  if (lifecycle !== 'fresh') {
    const verb = { remove: 'removed', rename: 'renamed', reroute: 're-routed' }[op];
    const recovery = lifecycle === 'cancelled' ? ' — reactivate it from the epic menu first'
      : lifecycle === 'postponed' ? ' — pull it forward from the roadmap first' : '';
    throw new Error(`render map-op-gate: "${name}" can't be ${verb} — it's "${lifecycle}", not fresh${recovery}`);
  }
}

/**
 * @param {string} cwd
 * @param {{dotpath: string, op?: string, file?: string}} args
 * @returns {string}
 */
function mapOpGate(cwd, { dotpath, op, file }) {
  if (!isFilled(op) || !Object.hasOwn(MAP_OP_QUESTIONS, op)) {
    throw new Error(`render map-op-gate: --op must be one of ${Object.keys(MAP_OP_QUESTIONS).join(', ')}, got "${op}"`);
  }
  if (!file) throw new Error('render map-op-gate: --file <payload.json> is required');
  const { manifest } = resolveWorkUnit(cwd, dotpath, 'map-op-gate');
  const p = readJsonPayload(cwd, file, 'map-op-gate');
  const body = mapOpBody(op, p);
  for (const name of mapOpTargets(op, p)) assertMapOp(manifest, op, name);
  return [
    section('DISPLAY: map operation', 'emit verbatim as a code block, directly above the menu', body.join('\n')),
    section('MENU: map operation gate', STOP_FOR_RESPONSE, menu('', YES_NO, { question: MAP_OP_QUESTIONS[op] })),
  ].join('\n');
}

// candidate-gate — the analysis approval gate's per-candidate stop. The
// candidate's own fields are judgment content staged by the analysis; the
// gate mode is manifest state at the staging subtree, so the branch renders
// inside the surface: the caller never chooses between gated and auto
// output. A candidate the manifest does not mark `pending` never renders —
// a stale payload refuses rather than gating something already decided.

/**
 * @param {string} cwd
 * @param {{dotpath: string, file?: string}} args
 * @returns {string}
 */
function candidateGate(cwd, { dotpath, file }) {
  if (!file) throw new Error('render candidate-gate: --file <payload.json> is required');
  const { workUnit, manifest } = resolveWorkUnit(cwd, dotpath, 'candidate-gate');
  const staging = ((((manifest.phases || {}).discovery || {}).analysis_staging) || {})['discovery-gap-analysis'];
  if (!staging || typeof staging !== 'object') {
    throw new Error(`render candidate-gate: no staged gap-analysis candidates for "${workUnit}"`);
  }
  const p = readJsonPayload(cwd, file, 'candidate-gate');
  if (!isFilled(p.name)) throw new Error('render candidate-gate: "name" must be a non-empty string');
  if (!['research', 'discussion'].includes(p.routing)) {
    throw new Error(`render candidate-gate: "routing" must be "research" or "discussion", got "${p.routing}"`);
  }
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
  const display = section('DISPLAY: candidate', 'emit verbatim as a code block', [
    `${name} [${p.routing}]`,
    ...indentedBody([p.summary, 'surfaced by gap analysis']),
  ].join('\n'));
  if (mode === 'auto') {
    return [display, section(
      'DISPLAY: candidate approved',
      `after recording the approval: ${AUTO_GATE_INSTRUCTION}`,
      `${name} — approved [auto].`,
    )].join('\n');
  }
  return [display, section('MENU: candidate gate', STOP_FOR_RESPONSE, menu('', [
    cmdOption('y', 'yes', 'Approve — the topic joins the map and its phase can start from the epic menu'),
    cmdOption('a', 'auto', 'Approve this and all remaining candidates automatically'),
    cmdOption('s', 'skip', 'Skip and dismiss — the analysis never re-proposes this name'),
    cmdOption('p', 'postpone', 'Postpone — the topic joins the map with its brief and waits on the roadmap under a horizon you name'),
    promptOption('Comment', 'Tell me what to change (routing, summary, or description)'),
  ], { question: 'Add this topic to the map?' }))].join('\n');
}

// dismissed-topics — the names removed from the map, and the re-add offer
// the session loop opens over them. The list is the display and the menu is
// the ask: a re-add names topics and their routing, never one row. With
// nothing dismissed there is nothing to re-add, so the display stands alone.

/**
 * @param {string} cwd
 * @param {{dotpath: string}} args
 * @returns {string}
 */
function dismissedTopics(cwd, { dotpath }) {
  const { manifest } = resolveWorkUnit(cwd, dotpath, 'dismissed-topics');
  const dismissed = ((manifest.phases || {}).discovery || {}).dismissed;
  const names = Array.isArray(dismissed) ? dismissed : [];
  const heading = ['Dismissed Topics', ''];
  if (names.length === 0) {
    return section('DISPLAY: dismissed topics', CONTINUE_INSTRUCTION, [...heading, ...indentedBody(['(none)'])].join('\n'));
  }
  return [
    section('DISPLAY: dismissed topics', 'emit verbatim as a code block, directly above the menu', [
      ...heading,
      ...names.flatMap((name) => bulletRow(name)),
    ].join('\n')),
    section('MENU: dismissed topics', STOP_FOR_RESPONSE, menu('', [
      cmdOption('b', 'back', 'Return to the session'),
      promptOption('Name them', 'Tell me which to re-add (and routing if known)'),
    ], { question: 'Re-add any of these to the map?' })),
  ].join('\n');
}

// triage-closed-target — the reroute's stop over a target no future session
// will surface. The address names the target and the surface derives its
// lifecycle with the same join every other map consumer uses, so the two
// closed states cannot drift apart in the wording. The statement names the
// closed target; the ask beneath it is fixed.

/**
 * @param {string} cwd
 * @param {{dotpath: string}} args
 * @returns {string}
 */
function triageClosedTarget(cwd, { dotpath }) {
  const { phase, topic, manifest } = resolveAddress(cwd, dotpath, 'triage-closed-target');
  if (phase !== 'discovery') {
    throw new Error(`render triage-closed-target: address must be <work_unit>.discovery.<target>, got phase "${phase}"`);
  }
  const items = (((manifest.phases || {}).discovery || {}).items) || {};
  if (!items[topic]) {
    throw new Error(`render triage-closed-target: no discovery item "${topic}" on the map`);
  }
  const { lifecycle } = computeTopicLifecycle(manifest, topic);
  if (lifecycle !== 'handled' && lifecycle !== 'cancelled') {
    throw new Error(`render triage-closed-target: "${topic}" is "${lifecycle}", not closed — the gate serves handled and cancelled targets`);
  }
  const closed = lifecycle === 'handled' ? 'closed as a dead end' : 'cancelled';
  // The reopen row states its consequence: choosing it does not only land the
  // concern, it puts the topic back in front of every convergence read.
  const reopen = lifecycle === 'handled'
    ? 'Reopen it and land the concern there — it returns to its name-matched lifecycle and counts as open again'
    : 'Reactivate it and land the concern there — the topic returns to its previous state and counts as open again';
  return section('MENU: closed target gate', STOP_FOR_RESPONSE, menu(`"${topic}" is ${closed}, so it won't pick up rerouted concerns.`, [
    cmdOption('o', 'open', reopen),
    cmdOption('e', 'elsewhere', 'Pick a different target'),
    cmdOption('d', 'drop', 'Drop the reroute; the concern stays with the current topic'),
  ], { question: 'Where should the concern land?' }));
}

// ---------------------------------------------------------------------------
// The phase gates. Each of these stops a flow the same way a shipped surface
// does — the option set in code, the prose carrying the fetch and the
// emission. Wording is the flow's own; the frame, the alignment and the
// register are this catalogue's.
// ---------------------------------------------------------------------------

// conclude-gate — the closing consent of the four phases whose conclusion is
// a user's call. One surface, keyed by the address's own phase segment: the
// shape is identical (a question, a yes, one arm beside it — keep going
// where the phase can take more, ask where it has hit its end and the
// only way is forward), and only each phase's own wording differs, so it
// lives in one table rather than four copies of the same frame. Research's
// conclude gate is its own surface — it carries a conditional dead-end row
// no other phase has.
const CONCLUDE_GATES = {
  discussion: {
    question: 'Conclude this discussion and mark as completed?',
    options: () => [
      cmdOption('y', 'yes', 'Conclude discussion'),
      cmdOption('n', 'no', 'Continue discussing'),
    ],
  },
  investigation: {
    question: 'Investigation complete. Ready to conclude?',
    options: () => [
      cmdOption('y', 'yes', 'Conclude investigation'),
      promptOption('Keep going', 'Tell me what else to explore'),
    ],
  },
  implementation: {
    question: 'Ready to mark implementation as completed?',
    options: () => [
      cmdOption('y', 'yes', 'Mark as completed'),
      promptOption('Ask', "Ask questions about the implementation (doesn't mark it complete)"),
    ],
  },
  planning: {
    question: 'Ready to conclude?',
    options: () => [
      cmdOption('y', 'yes', 'Conclude plan and mark as completed'),
      promptOption('Ask', "Ask questions about the plan (doesn't mark it complete)"),
    ],
  },
};

/**
 * @param {string} cwd
 * @param {{dotpath: string}} args
 * @returns {string}
 */
function concludeGate(cwd, { dotpath }) {
  const { phase, topic, manifest } = resolveAddress(cwd, dotpath, 'conclude-gate');
  const gate = CONCLUDE_GATES[phase];
  if (!gate) {
    throw new Error(`render conclude-gate: phase must be one of ${Object.keys(CONCLUDE_GATES).join(', ')}, got "${phase}"`);
  }
  if (!itemOf(manifest, phase, topic)) {
    throw new Error(`render conclude-gate: no ${phase} item "${topic}" — nothing to conclude`);
  }
  return section('MENU: conclude gate', STOP_FOR_RESPONSE, menu('', gate.options(), { question: gate.question }));
}

// closing-gate — the discussion close's own consents, on the road between
// the close opening (the user's word, or the map settling) and the conclude
// gate: the optional re-review offer,
// the three faces of the mandatory review gate (findings already back,
// a review still running, no review ever run — each names what yes
// does, so "another review" is never the reading), and the wrap-up
// consent that opens the reconciliation. One surface, variant-keyed;
// distinct from conclude-gate, which is the final completion consent the
// same close reaches later — the two stops coexist in one conclusion.
const CLOSING_GATES = {
  're-review': () => ({
    name: 'MENU: re-review gate',
    label: 'The discussion has moved since the last review read it. One more pass can catch what that movement opened — or conclude without one.',
    question: 'Run one more review?',
    options: [
      cmdOption('y', 'yes', 'Run one more review before concluding'),
      cmdOption('n', 'no', 'Conclude without it — the movement stays unreviewed'),
      promptOption('Keep going', 'Tell me what else to explore'),
    ],
  }),
  'findings-owed': () => ({
    name: 'MENU: findings-owed gate',
    label: 'Background findings have come back and are still to be walked — they must be heard before concluding.',
    question: 'Walk them now?',
    options: [
      cmdOption('y', 'yes', 'Walk what came back'),
      promptOption('Keep going', 'Tell me what else to explore'),
    ],
  }),
  'review-running': () => ({
    name: 'MENU: review-running gate',
    label: 'A review is still running over this discussion — what it finds must be heard before concluding. Nothing new is dispatched.',
    question: 'Wait for it?',
    options: [
      cmdOption('y', 'yes', 'Wait for it and walk what it finds'),
      promptOption('Keep going', 'Tell me what else to explore'),
    ],
  }),
  'final-review': () => ({
    name: 'MENU: final-review gate',
    label: 'Next: a final gap review before concluding — no review has run yet.',
    question: 'Proceed?',
    options: [
      cmdOption('y', 'yes', 'Run the final review'),
      promptOption('Keep going', 'Tell me what else to explore'),
    ],
  }),
  'wrap-up': () => ({
    name: 'MENU: wrap-up gate',
    label: "I'll reconcile the document against our conversation, then confirm before marking complete.",
    question: 'Do you wish to conclude?',
    options: [
      cmdOption('y', 'yes', 'Conclude — begin wrap-up'),
      cmdOption('n', 'no', 'Continue the conversation'),
    ],
  }),
};

/**
 * @param {string} cwd
 * @param {{dotpath: string, variant?: string, reason?: string}} args
 * @returns {string}
 */
function closingGate(cwd, { dotpath, variant, reason }) {
  const { phase } = resolveAddress(cwd, dotpath, 'closing-gate');
  if (phase !== 'discussion') {
    throw new Error(`render closing-gate: address must be <wu>.discussion.<topic> — the discussion close is the flow that runs these gates; got phase "${phase}"`);
  }
  const gate = variant !== undefined ? CLOSING_GATES[variant] : undefined;
  if (!gate) {
    throw new Error(`render closing-gate: --variant must be one of ${Object.keys(CLOSING_GATES).join(', ')}, got "${variant ?? ''}"`);
  }
  if (reason !== undefined) {
    throw new Error('render closing-gate: takes no --reason — every variant carries its own wording');
  }
  const g = gate();
  return section(g.name, STOP_FOR_RESPONSE, menu(g.label, g.options, { question: g.question }));
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
 * @returns {{workUnit: string, topic: string, rows: import('./projections/experiment.cjs').SeriesRow[]}}
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
  return { workUnit, topic, rows };
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
  const { topic, rows } = resolveExperiment(cwd, dotpath, 'experiment-register');
  return experimentRegister(topic, rows);
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
 * @returns {{phase: string, topic: string, manifest: object}}
 */
function resolvePhaseItem(cwd, dotpath, surface, phases, noun) {
  const { phase, topic, manifest } = resolveAddress(cwd, dotpath, surface);
  if (!phases.includes(phase)) {
    throw new Error(`render ${surface}: address must be <work_unit>.<${phases.join('|')}>.<topic> — ${noun}; got phase "${phase}"`);
  }
  return { phase, topic, manifest };
}

/**
 * Resolve a conversation address — a research or discussion item, the two
 * phases that spawn experiments.
 * @param {string} cwd @param {string} dotpath @param {string} surface
 * @returns {{phase: string, topic: string, manifest: object}}
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
  const { phase, topic, manifest } = resolveConversation(cwd, dotpath, 'experiment-spawn-gate');
  if (!isFilled(id)) throw new Error('render experiment-spawn-gate: --id is required (E1, E2, …)');
  if (!awaitedExperiments(manifest, phase, topic).includes(/** @type {string} */ (id))) {
    throw new Error(`render experiment-spawn-gate: ${phase} "${topic}" holds no evidence wait on ${id} — the gate follows the recorded spawn (experiment create)`);
  }
  return experimentSpawnGate(phase, /** @type {string} */ (id), manifest.work_type === 'epic');
}

/**
 * The blocked-conclusion gate over every wait the item holds — the research
 * a discussion stands on, the specification a plan stands on, the
 * experiments a conversation spawned. Empty when nothing is owed: the
 * calling flow branches on the response, so one fetch stands in for the
 * read-then-render pair.
 * @param {string} cwd
 * @param {{dotpath: string}} args
 * @returns {string} the gate's sections, or '' when nothing blocks conclusion
 */
function waitGateSurface(cwd, { dotpath }) {
  const { phase, topic, manifest } = resolvePhaseItem(cwd, dotpath, 'wait-gate', WAITING_PHASES, 'the waiting item itself');
  if (!itemOf(manifest, phase, topic)) {
    throw new Error(`render wait-gate: no ${phase} item "${topic}" — nothing to hold shut`);
  }
  const blocking = waits(manifest, phase, topic);
  return blocking.length === 0 ? '' : waitGate(phase, topic, blocking, manifest.work_type === 'epic');
}

// summary-backfill-gate — the epic's provenance recovery, both stops. The
// batch variant is static (the proposed lines are displayed above it); the
// unsourced variant names the topics no source file could be drafted from,
// so its list rides as a payload.

/**
 * @param {string} cwd
 * @param {{dotpath: string, variant?: string, file?: string}} args
 * @returns {string}
 */
function summaryBackfillGate(cwd, { dotpath, variant, file }) {
  if (variant !== 'batch' && variant !== 'unsourced') {
    throw new Error(`render summary-backfill-gate: --variant must be "batch" or "unsourced", got "${variant}"`);
  }
  resolveWorkUnit(cwd, dotpath, 'summary-backfill-gate');
  if (variant === 'batch') {
    return section('MENU: summary batch gate', STOP_FOR_RESPONSE, menu('', [
      cmdOption('y', 'yes', 'Accept all summaries as drafted (description is auto-drafted silently)'),
      cmdOption('e', 'edit', 'Edit one or more summary lines before accepting'),
      cmdOption('s', 'skip', 'Skip the whole batch (leave fields blank)'),
    ], { question: 'Accept these summaries?' }));
  }
  if (!file) throw new Error('render summary-backfill-gate: --file <payload.json> is required for --variant unsourced');
  const p = readJsonPayload(cwd, file, 'summary-backfill-gate');
  if (!Array.isArray(p.names) || p.names.length === 0 || p.names.some((n) => !isFilled(n))) {
    throw new Error('render summary-backfill-gate: "names" must be a non-empty array of topic names');
  }
  const unsourced = [`${p.names.length} topic(s) have no source file to draft from:`, '', ...p.names.map((n) => `- ${titlecase(n)}`)];
  return section('MENU: unsourced topics gate', STOP_FOR_RESPONSE, menu(unsourced.join('\n'), [
    cmdOption('p', 'provide', "Tell me the summary for each and I'll write it"),
    cmdOption('d', 'dismiss', 'Write a minimal name-derived summary noting the missing source, so this stops re-prompting'),
    cmdOption('l', 'leave', 'Leave them unset; this flow re-offers next time'),
  ], { question: 'How do you want to handle them?' }));
}

/**
 * Pin a planning address, refusing any other phase by name.
 * @param {string} cwd @param {string} dotpath @param {string} surface
 * @returns {{workUnit: string, phase: string, topic: string, manifest: object}}
 */
function resolvePlanning(cwd, dotpath, surface) {
  const resolved = resolveAddress(cwd, dotpath, surface);
  if (resolved.phase !== 'planning') {
    throw new Error(`render ${surface}: address must be <work_unit>.planning.<topic>, got phase "${resolved.phase}"`);
  }
  return resolved;
}

// external-dependency-gate — implementation entry's two stops over a plan's
// external dependencies: what to do about the blocking set, and which of them
// the user has satisfied outside the pipeline. Which dependencies block is
// judgment — it comes from reading each one's plan through its output format
// — so the pick variant is told the set by name; each row's description is
// manifest state and is read here, so the menu can never name a dependency
// the plan does not declare.

/**
 * @param {string} cwd
 * @param {{dotpath: string, variant?: string, blocking?: string}} args
 * @returns {string}
 */
function externalDependencyGate(cwd, { dotpath, variant, blocking }) {
  if (variant !== 'blocking' && variant !== 'pick') {
    throw new Error(`render external-dependency-gate: --variant must be "blocking" or "pick", got "${variant}"`);
  }
  const { manifest, topic } = resolvePlanning(cwd, dotpath, 'external-dependency-gate');
  if (variant === 'blocking') {
    return section('MENU: blocking dependencies gate', STOP_FOR_RESPONSE, menu('', [
      cmdOption('s', 'satisfied', 'Mark a dependency as satisfied externally'),
      cmdOption('i', 'implement', 'Exit to implement blocking dependencies first'),
    ], { question: 'How would you like to proceed?' }));
  }
  const names = String(blocking || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (names.length === 0) {
    throw new Error('render external-dependency-gate: --blocking <topic,topic,…> is required for --variant pick — the blocking set, in offer order');
  }
  const declared = ((((manifest.phases || {}).planning || {}).items || {})[topic] || {}).external_dependencies || {};
  const rows = names.map((name, i) => {
    const dep = declared[name];
    if (!dep || typeof dep !== 'object') {
      throw new Error(`render external-dependency-gate: "${name}" is not an external dependency of "${topic}"`);
    }
    if (!isFilled(dep.description)) {
      throw new Error(`render external-dependency-gate: "${name}" carries no description — the row has nothing to say`);
    }
    return cmdOption(String(i + 1), null, `${titlecase(name)} — ${dep.description}`);
  });
  return section('MENU: dependency pick', STOP_FOR_RESPONSE, menu('', rows, { question: 'Which dependency has been satisfied?' }));
}

// checkpoint-files-gate — the analysis loop's pre-analysis checkpoint. The
// unexpected files are listed above by the flow; the gate only asks what the
// commit should carry.

/**
 * @param {string} cwd
 * @param {{dotpath: string}} args
 * @returns {string}
 */
function checkpointFilesGate(cwd, { dotpath }) {
  const { phase } = resolveAddress(cwd, dotpath, 'checkpoint-files-gate');
  if (phase !== 'implementation') {
    throw new Error(`render checkpoint-files-gate: address must be <work_unit>.implementation.<topic>, got phase "${phase}"`);
  }
  return section('MENU: checkpoint files gate', STOP_FOR_RESPONSE, menu('', [
    cmdOption('y', 'yes', 'Include all'),
    cmdOption('s', 'skip', 'Exclude unexpected files, commit only implementation files'),
    promptOption('Comment', 'Specify which to include'),
  ], { question: 'Include unexpected files in the checkpoint commit?' }));
}

// executor-block-gate — the task loop's stop after an executor returns
// blocked or failed. Neither offers a way out of the task — during the build
// a task is finished or being fixed. A failure offers the retry, with Comment
// to steer it. A block is the product fork the executor met: its sides ride
// in a payload, numbered with the recommended side first, and Comment is the
// exchange; the override line heads the menu when the task gate is auto or
// bounded, since the stop is one auto never takes for the user.
const FAILED_ROWS = [
  cmdOption('r', 'retry', 'Run the executor again with the guidance above and anything you add'),
  promptOption('Comment', 'Ask about the failure, or steer the next attempt'),
];

/**
 * @param {string} cwd
 * @param {{dotpath: string, result?: string, file?: string}} args
 * @returns {string}
 */
function executorBlockGate(cwd, { dotpath, result, file }) {
  if (result !== 'blocked' && result !== 'failed') {
    throw new Error(`render executor-block-gate: --result must be one of blocked, failed, got "${result}"`);
  }
  const { phase, topic, manifest } = resolveAddress(cwd, dotpath, 'executor-block-gate');
  if (phase !== 'implementation') {
    throw new Error(`render executor-block-gate: address must be <work_unit>.implementation.<topic>, got phase "${phase}"`);
  }
  if (result === 'failed') {
    if (file !== undefined) throw new Error('render executor-block-gate: --file belongs to --result blocked — a failure carries no sides');
    return section('MENU: executor block gate', STOP_FOR_RESPONSE, menu('', FAILED_ROWS, { question: 'How would you like to proceed?' }));
  }
  if (!file) throw new Error('render executor-block-gate: --file <sides.json> is required with --result blocked');
  const item = itemOf(manifest, 'implementation', topic);
  if (!item) throw new Error(`render executor-block-gate: no implementation item "${topic}"`);
  const p = readJsonPayload(cwd, file, 'executor-block-gate');
  if (!Array.isArray(p.options) || p.options.length < 2 || p.options.length > 4) {
    throw new Error('render executor-block-gate: "options" must be an array of 2–4 sides');
  }
  const sides = p.options.map((/** @type {unknown} */ o, /** @type {number} */ i) => {
    const side = /** @type {{summary?: unknown, recommended?: unknown}} */ (
      typeof o === 'string' ? { summary: o } : (o && typeof o === 'object' && !Array.isArray(o) ? o : {}));
    if (!isFilled(side.summary)) {
      throw new Error(`render executor-block-gate: options[${i}] must be a non-empty string or an object carrying "summary"`);
    }
    return { summary: side.summary, recommended: side.recommended === true };
  });
  const rows = recommendedMenuRows(sides, 'render executor-block-gate: at most one option may be recommended');
  const mode = gateOf(item, 'task_gate_mode');
  const label = mode === 'auto' || mode === 'bounded' ? AUTO_OVERRIDE_LINE : '';
  return section('MENU: executor block gate', STOP_FOR_RESPONSE, menu(label, [
    ...rows,
    promptOption('Comment', "Ask about the options, or tell me what I've missed"),
  ], { question: 'Which way?' }));
}

// dependency-approval-gate — planning's three approvals over dependency
// work: the graph as first analysed, the graph after it was applied, and the
// external-dependency resolutions. One shape — approve, or say what to
// change — with each variant's own wording.
const DEPENDENCY_APPROVALS = {
  graph: { question: 'Approve the dependency graph?', change: 'which priorities or dependencies to adjust' },
  'updated-graph': { question: 'Approve the updated graph?', change: 'which priorities or dependencies to adjust' },
  resolution: { question: 'Approve the dependency resolution?', change: 'which resolutions to adjust or links to add' },
};

/**
 * @param {string} cwd
 * @param {{dotpath: string, variant?: string}} args
 * @returns {string}
 */
function dependencyApprovalGate(cwd, { dotpath, variant }) {
  const spec = variant === undefined ? undefined : DEPENDENCY_APPROVALS[variant];
  if (!spec) {
    throw new Error(`render dependency-approval-gate: --variant must be one of ${Object.keys(DEPENDENCY_APPROVALS).join(', ')}, got "${variant}"`);
  }
  resolvePlanning(cwd, dotpath, 'dependency-approval-gate');
  return section('MENU: dependency approval gate', STOP_FOR_RESPONSE, menu('', [
    cmdOption('y', 'yes', 'Proceed'),
    promptOption('Tell me what to change', spec.change),
  ], { question: spec.question }));
}

// task-count-gate — the authoring loop's stop when the detail file and the
// task table still disagree after two attempts.

/**
 * @param {string} cwd
 * @param {{dotpath: string}} args
 * @returns {string}
 */
function taskCountGate(cwd, { dotpath }) {
  resolvePlanning(cwd, dotpath, 'task-count-gate');
  return section('MENU: task count gate', STOP_FOR_RESPONSE, menu('', [
    cmdOption('r', 'retry', 'Re-invoke the author agent once more'),
    promptOption('Adjust', "Tell me what to correct (the task table or the detail file), and I'll apply it and re-validate"),
  ], { question: 'How would you like to proceed?' }));
}

// plan-context-gate — planning entry's one offer before a fresh plan is
// built: carry the specification as it stands, or say what has changed since
// it was completed. The offer is the fresh start's alone — a plan already
// under way reconciles its moved input instead — so the surface refuses an
// address whose planning item already carries a status.

/**
 * @param {string} cwd
 * @param {{dotpath: string}} args
 * @returns {string}
 */
function planContextGate(cwd, { dotpath }) {
  const { manifest, topic } = resolvePlanning(cwd, dotpath, 'plan-context-gate');
  const status = (itemOf(manifest, 'planning', topic) || {}).status;
  if (isFilled(status)) {
    throw new Error(`render plan-context-gate: planning item "${topic}" is ${status} — the context offer opens a fresh plan`);
  }
  return section('MENU: plan context gate', STOP_FOR_RESPONSE, menu('Any new context since the specification was completed?', [
    cmdOption('c', 'continue', 'Continue with the specification as-is'),
    promptOption('Add context', 'Tell me the priorities, constraints, or new considerations'),
  ]));
}

// cross-cutting-gate — planning entry's stop over cross-cutting
// specifications still being written. Which of them bear on the plan being
// built is the session's read, so the names arrive as a payload; whether a
// name is a cross-cutting unit whose specification is still open is state,
// so the surface checks it rather than being told — a warning about a spec
// that finished is worse than no warning at all.

/**
 * The cross-cutting work units whose specification reads `status`.
 * @param {string} cwd
 * @param {string} status
 * @returns {string[]}
 */
function crossCuttingSpecs(cwd, status) {
  return loadAllManifests(cwd)
    .filter((m) => m.work_type === 'cross-cutting'
      && phaseItems(m, 'specification').some((item) => item.status === status))
    .map((m) => String(m.name));
}

/**
 * @param {string} cwd
 * @param {{dotpath: string, file?: string}} args
 * @returns {string}
 */
function crossCuttingGate(cwd, { file }) {
  if (!file) throw new Error('render cross-cutting-gate: --file <payload.json> is required');
  const units = stringLines(readJsonPayload(cwd, file, 'cross-cutting-gate').units, 'cross-cutting-gate', 'units');
  if (units.length === 0) {
    throw new Error('render cross-cutting-gate: "units" is empty — the gate renders over the specs this plan must know about');
  }
  const open = crossCuttingSpecs(cwd, 'in-progress');
  for (const unit of units) {
    if (!open.includes(unit)) {
      throw new Error(`render cross-cutting-gate: "${unit}" is not a cross-cutting work unit with a specification in progress`);
    }
  }
  return [
    section('DISPLAY: cross-cutting in progress', 'emit verbatim as a code block, directly above the menu', [
      'Cross-cutting specifications still in progress:',
      ...indentedBody(['These may contain architectural decisions relevant to this plan.']),
      '',
      ...units.flatMap((unit) => bulletRow(unit)),
    ].join('\n')),
    section('MENU: cross-cutting gate', STOP_FOR_RESPONSE, menu('Proceed without these, or complete them first?', [
      cmdOption('c', 'continue', 'Plan without them'),
      cmdOption('s', 'stop', 'Complete them first'),
    ])),
  ].join('\n');
}

// cross-cutting-references — the completed cross-cutting specifications the
// plan will reference. Which of them bear on the plan, and what each decides
// that matters here, is the session's read, so the rows arrive as a payload;
// whether a name is a cross-cutting unit whose specification completed is
// state, so the surface checks it — a reference to an unfinished spec would
// hand the plan decisions nobody has settled.

/**
 * @param {string} cwd
 * @param {{dotpath: string, file?: string}} args
 * @returns {string}
 */
function crossCuttingReferences(cwd, { file }) {
  if (!file) throw new Error('render cross-cutting-references: --file <payload.json> is required');
  const { units } = readJsonPayload(cwd, file, 'cross-cutting-references');
  if (!Array.isArray(units) || units.length === 0) {
    throw new Error('render cross-cutting-references: "units" must be a non-empty array of {name, summary}');
  }
  const completed = crossCuttingSpecs(cwd, 'completed');
  for (const unit of units) {
    if (!unit || !isFilled(unit.name) || !isFilled(unit.summary)) {
      throw new Error('render cross-cutting-references: every unit needs a non-empty "name" and "summary"');
    }
    if (!completed.includes(unit.name)) {
      throw new Error(`render cross-cutting-references: "${unit.name}" is not a cross-cutting work unit with a completed specification`);
    }
  }
  return section('DISPLAY: cross-cutting references', 'emit verbatim as a code block', [
    'Cross-cutting specifications to reference:',
    ...units.flatMap((unit) => bulletRow(`${unit.name}: ${unit.summary}`)),
  ].join('\n'));
}

// plan-format-gate — the plan's format offer in its two moments. Bare, it is
// the accept of the project default: the format is project-manifest state, so
// the surface reads it rather than being told, and an offer naming a format
// nobody set would be a gate over nothing. `--variant select` is the
// catalogue reached when there is no default or the user declined it — which
// formats a project ships is the planning skill's to name, so the rows arrive
// as a payload and the surface numbers them in payload order. Neither takes
// an address: the planning item does not exist yet when this gate renders.

/**
 * @param {string} cwd
 * @param {string|undefined} file
 * @returns {string}
 */
function planFormatSelect(cwd, file) {
  if (!file) throw new Error('render plan-format-gate: --variant select requires --file <payload.json>');
  const { formats } = readJsonPayload(cwd, file, 'plan-format-gate');
  if (!Array.isArray(formats) || formats.length === 0) {
    throw new Error('render plan-format-gate: "formats" must be a non-empty array of {name, label}');
  }
  for (const f of formats) {
    if (!f || !isFilled(f.name) || !isFilled(f.label)) {
      throw new Error('render plan-format-gate: every format needs a non-empty "name" and "label"');
    }
  }
  return section('MENU: plan format select', STOP_FOR_RESPONSE, menu('Which output format?',
    formats.map((f, i) => cmdOption(String(i + 1), null, f.label))));
}

/**
 * @param {string} cwd
 * @param {{dotpath: string, variant?: string, file?: string}} args
 * @returns {string}
 */
function planFormatGate(cwd, { variant, file }) {
  if (variant === 'select') return planFormatSelect(cwd, file);
  if (variant !== undefined) {
    throw new Error(`render plan-format-gate: --variant must be select, got "${variant}"`);
  }
  const project = loadProjectManifest(cwd);
  const format = ((project || {}).defaults || {}).plan_format;
  if (!isFilled(format)) {
    throw new Error('render plan-format-gate: no project default plan_format — the offer only renders over an existing default');
  }
  return section('MENU: plan format gate', STOP_FOR_RESPONSE, menu(
    `Project default format is **${format}**.`,
    [
      cmdOption('y', 'yes', `Use ${format}`),
      cmdOption('n', 'no', 'See all available formats'),
    ],
    { question: 'Use the same format?' },
  ));
}

// plan-review-gate — the plan review loop's two gates, the sibling of
// spec-review-gate: continue = the cycle-count escape hatch, reloop = another
// full round of both reviews.

/**
 * @param {string} cwd
 * @param {{dotpath: string, variant?: string}} args
 * @returns {string}
 */
function planReviewGate(cwd, { dotpath, variant }) {
  if (variant !== 'continue' && variant !== 'reloop') {
    throw new Error('render plan-review-gate: --variant must be "continue" or "reloop"');
  }
  resolvePlanning(cwd, dotpath, 'plan-review-gate');
  if (variant === 'continue') {
    return section('MENU: plan review continue gate', STOP_FOR_RESPONSE, menu('', [
      cmdOption('y', 'yes', 'Continue review'),
      cmdOption('s', 'skip', 'Skip review, proceed to completion'),
    ], { question: 'Continue with review?' }));
  }
  return section('MENU: plan review reloop gate', STOP_FOR_RESPONSE, menu('', [
    cmdOption('y', 'yes', 'Run another round (traceability + integrity)'),
    cmdOption('p', 'proceed', 'Proceed to conclusion'),
  ], { question: 'Run another review round?' }));
}

// complexity-gate / first-phase-gate — the two stops of scoping's complexity
// check. Which criteria the change fails is the session's read, so the
// concerns ride a payload, while the type is state: an offer to promote a
// unit that is not a quick-fix, or one already promoted, is a gate over
// nothing. The second is the onward route a promotion opens — research or
// discussion, offered only to the types that have the choice, the read that
// leans one way the session's own and a statement above the fixed ask.

/**
 * @param {string} cwd
 * @param {{dotpath: string, file?: string}} args
 * @returns {string}
 */
function complexityGate(cwd, { dotpath, file }) {
  if (!file) throw new Error('render complexity-gate: --file <payload.json> is required');
  const { manifest } = resolveWorkUnit(cwd, dotpath, 'complexity-gate');
  if (manifest.work_type !== 'quick-fix') {
    throw new Error(`render complexity-gate: "${dotpath}" is a ${manifest.work_type} — the complexity check is the quick-fix's own`);
  }
  const concerns = stringLines(readJsonPayload(cwd, file, 'complexity-gate').concerns, 'complexity-gate', 'concerns');
  if (concerns.length === 0 || concerns.some((c) => !isFilled(c))) {
    throw new Error('render complexity-gate: "concerns" must be a non-empty array of non-empty strings — the warning names what failed');
  }
  return [
    section('DISPLAY: complexity check', 'emit verbatim as a code block, directly above the menu', [
      'Complexity Check',
      '',
      ...indentedBody(['This change may be more involved than a quick-fix:'], { indent: '' }),
      '',
      ...concerns.flatMap((c) => bulletRow(c)),
    ].join('\n')),
    section('MENU: complexity gate', STOP_FOR_RESPONSE, menu('How would you like to proceed?', [
      cmdOption('c', 'continue', 'Continue as quick-fix anyway'),
      cmdOption('f', 'feature', 'Promote to feature (full pipeline)'),
      cmdOption('b', 'bugfix', 'Promote to bugfix (investigation pipeline)'),
    ])),
  ].join('\n');
}

const FIRST_PHASE_TYPES = ['feature', 'cross-cutting'];

/**
 * @param {string} cwd
 * @param {{dotpath: string, file?: string}} args
 * @returns {string}
 */
function firstPhaseGate(cwd, { dotpath, file }) {
  if (!file) throw new Error('render first-phase-gate: --file <payload.json> is required');
  const { manifest } = resolveWorkUnit(cwd, dotpath, 'first-phase-gate');
  if (!FIRST_PHASE_TYPES.includes(String(manifest.work_type))) {
    throw new Error(`render first-phase-gate: a ${manifest.work_type} has a fixed first phase — the choice belongs to ${FIRST_PHASE_TYPES.join(' and ')} work`);
  }
  const { read } = readJsonPayload(cwd, file, 'first-phase-gate');
  if (!isFilled(read)) {
    throw new Error('render first-phase-gate: "read" must be a non-empty string — the choice opens on which phase leans, and why');
  }
  if (/\n/.test(read)) {
    throw new Error('render first-phase-gate: "read" must be a single line — it becomes the menu\'s statement label');
  }
  return section('MENU: first phase gate', STOP_FOR_RESPONSE, menu(read, [
    cmdOption('r', 'research', 'Explore feasibility and options first, no decisions yet'),
    cmdOption('d', 'discussion', 'Ready to discuss and make decisions'),
  ], { question: 'Which phase first?' }));
}

// correction-gate — the consent stop before editing another work unit's
// completed specification. The path is the address's own, derived here so the
// gate can never name a file the correction protocol would not touch; the
// owning unit must be completed, which is the one state the protocol edits.

/**
 * @param {string} cwd
 * @param {{dotpath: string}} args
 * @returns {string}
 */
function correctionGate(cwd, { dotpath }) {
  const { workUnit, phase, topic, manifest } = resolveAddress(cwd, dotpath, 'correction-gate');
  if (phase !== 'specification') {
    throw new Error(`render correction-gate: address must be <work_unit>.specification.<topic>, got phase "${phase}"`);
  }
  if (manifest.status !== 'completed') {
    throw new Error(`render correction-gate: "${workUnit}" is "${manifest.status}" — the corrigendum protocol serves completed work units`);
  }
  const specPath = `.workflows/${workUnit}/specification/${topic}/specification.md`;
  return section('MENU: correction gate', STOP_FOR_RESPONSE, menu(
    `Correcting ${specPath}.`,
    [
      cmdOption('y', 'yes', 'Edit in place + corrigendum + knowledge re-index'),
      cmdOption('v', 'view', 'Show the full correction list'),
      cmdOption('n', 'no', 'Leave the specification as-is'),
    ],
    { question: 'Apply the correction protocol?' },
  ));
}

// analysis-proceed-gate — specification entry's consent before the grouping
// analysis runs. The cache-aware message above it differs by cache state; the
// ask does not.

/**
 * @param {string} cwd
 * @param {{dotpath: string}} args
 * @returns {string}
 */
function analysisProceedGate(cwd, { dotpath }) {
  resolveWorkUnit(cwd, dotpath, 'analysis-proceed-gate');
  return section('MENU: analysis proceed gate', STOP_FOR_RESPONSE, menu('', YES_NO, { question: 'Proceed with analysis?' }));
}

// spec-confirm-gate — specification entry's consent before the handoff, the
// one gate every route reaches, with what the handoff is about to do drawn
// above it. The variant is the route the entry took; the surface refuses one
// the item's state does not bear, reading the verb through the entry menu's
// own derivation. With no item yet, the create is the single-discussion path
// and confirms the lone completed discussion. Consult references are
// markdown-held — the analysis doc's slice hints — so they arrive as a
// payload; a started specification's must be exactly the ones it declares.

const SPEC_CONFIRM_VERBS = { create: 'Creating', continue: 'Continuing', refine: 'Refining', unify: 'Creating' };
const SPEC_CONFIRMABLE = ['proposed', 'in-progress', 'completed'];
const REFINE_NOTE = 'A refinement is for factual corrections and sharpening. A change of decision belongs in the source discussion — reopen that discussion instead; the moment it reopens, this specification is flagged to reconcile against the re-decision.';

/**
 * The single-discussion path's grouping: the lone completed discussion under
 * the name the handoff creates.
 * @param {object} manifest @param {string} workUnit @param {string} topic
 * @returns {import('./specification.cjs').DiscoverySpec}
 */
function loneDiscussionGrouping(manifest, workUnit, topic) {
  const completed = phaseItems(manifest, 'discussion').filter((d) => d.status === 'completed');
  if (completed.length !== 1) {
    throw new Error(`render spec-confirm-gate: no specification "${topic}" — a create with no proposed grouping confirms the lone completed discussion, and "${workUnit}" has ${completed.length}`);
  }
  return {
    name: topic,
    status: 'proposed',
    sources: [{ name: completed[0].name, status: 'pending', discussion_status: 'completed' }],
    has_pending_sources: true,
  };
}

/**
 * The consult rows as the payload gives them. `declared` is a started
 * specification's own references — the payload must name exactly those —
 * and null before its first session, when the analysis doc is their only
 * record.
 * @param {string} cwd @param {string|undefined} file @param {string[]|null} declared
 * @returns {{name: string, hint: string}[]}
 */
function specConfirmConsult(cwd, file, declared) {
  /** @type {{name: string, hint: string}[]} */
  let rows = [];
  if (file) {
    const p = readJsonPayload(cwd, file, 'spec-confirm-gate');
    if (!Array.isArray(p.consult) || p.consult.length === 0) {
      throw new Error('render spec-confirm-gate: "consult" must be a non-empty array of {name, hint} — leave --file off when none are owed');
    }
    rows = p.consult.map((r, i) => {
      if (!r || !isFilled(r.name)) throw new Error(`render spec-confirm-gate: consult[${i}] needs a non-empty "name"`);
      if (r.hint !== undefined && typeof r.hint !== 'string') throw new Error(`render spec-confirm-gate: consult[${i}] "hint" must be a string`);
      return { name: r.name, hint: r.hint || '' };
    });
  }
  if (declared) {
    const given = rows.map((r) => r.name);
    if (given.length !== declared.length || !declared.every((n) => given.includes(n))) {
      const has = declared.length > 0 ? `declares consult references [${declared.join(', ')}]` : 'declares no consult references';
      throw new Error(`render spec-confirm-gate: the specification ${has}${file
        ? ` and the payload names [${given.join(', ')}] — pass exactly the declared ones`
        : ' — pass them via --file'}`);
    }
  }
  return rows;
}

/**
 * @param {string} cwd
 * @param {{dotpath: string, variant?: string, file?: string}} args
 * @returns {string}
 */
function specConfirmGate(cwd, { dotpath, variant, file }) {
  if (!isFilled(variant) || !Object.hasOwn(SPEC_CONFIRM_VERBS, variant)) {
    throw new Error(`render spec-confirm-gate: --variant must be one of ${Object.keys(SPEC_CONFIRM_VERBS).join(', ')}, got "${variant}"`);
  }
  const { workUnit, phase, topic, manifest } = resolveAddress(cwd, dotpath, 'spec-confirm-gate');
  if (phase !== 'specification') {
    throw new Error(`render spec-confirm-gate: address must be <work_unit>.specification.<topic>, got phase "${phase}"`);
  }
  const item = itemOf(manifest, 'specification', topic);
  if (variant === 'unify' && (topic !== 'unified' || !item)) {
    throw new Error(`render spec-confirm-gate: the unify confirm reads the "unified" item its reconcile wrote — "${topic}" ${item ? 'is not it' : 'has no item'}`);
  }
  const spec = item ? discoverySpec(manifest, topic, item) : loneDiscussionGrouping(manifest, workUnit, topic);
  const { status } = spec;
  if (!SPEC_CONFIRMABLE.includes(status)) {
    throw new Error(`render spec-confirm-gate: "${topic}" is ${status} — there is nothing to confirm`);
  }
  const { verb, sources, supersedes } = specConfirmation(manifest, spec);
  if (verb !== SPEC_CONFIRM_VERBS[variant]) {
    throw new Error(`render spec-confirm-gate: "${topic}" reads ${verb} — the ${variant} confirm does not serve it`);
  }
  const consult = specConfirmConsult(cwd, file, status === 'proposed' ? null : (spec.consult_references || []).map((r) => r.name));

  return [
    section('DISPLAY: spec confirmation', 'emit verbatim as a code block, directly above the menu', specificationConfirmation({
      variant: /** @type {'create'|'continue'|'refine'|'unify'} */ (variant),
      verb, work_unit: workUnit, name: topic, status, sources, supersedes, consult,
    })),
    section('MENU: spec confirm gate', STOP_FOR_RESPONSE, menu(variant === 'refine' ? REFINE_NOTE : '', YES_NO, { question: 'Proceed?' })),
  ].join('\n');
}

// finding-announce — the surfacing protocol's opt-in gate: a background
// agent's return announced as a count and a lane shape, never a preview.
// The chrome is fixed; the payload carries only judgment content (the
// agent type and the lane-split clause).

/**
 * @param {string} cwd
 * @param {{dotpath: string, file?: string}} args
 * @returns {string}
 */
function findingAnnounce(cwd, { dotpath, file }) {
  if (!file) throw new Error('render finding-announce: --file <payload.json> is required');
  resolveAddress(cwd, dotpath, 'finding-announce');
  const p = readJsonPayload(cwd, file, 'finding-announce');
  if (!isFilled(p.agent_type)) throw new Error('render finding-announce: "agent_type" must be a non-empty string');
  if (!Number.isInteger(p.count) || p.count < 1) throw new Error('render finding-announce: "count" must be a positive integer');
  if (!isFilled(p.shape)) throw new Error('render finding-announce: "shape" must be a non-empty string — the lane split in one clause');
  return section(
    'MENU: finding announce',
    'emit verbatim as markdown',
    menu(`Background ${p.agent_type} returned — ${p.count} finding(s): ${p.shape}.`, [
      cmdOption('y', 'yes', 'Start on them'),
      cmdOption('l', 'later', "Keep pulling on the current thread, I'll raise them at the next pause"),
    ], { question: 'Work through them now?' }),
  );
}

// finding-batch — a surfacing lane whose findings need at most a scan from
// the user: the `apply` batch (corrections determined by decisions already
// made), the call batch (`settled` at the specification, `decide` at every
// other door — calls the session made, presented for a scan before they
// land), and the `route` batch (concerns owned by a sibling topic). The lane
// fixes the chrome; the payload carries only judgment content, so the screen
// is one call and the prose holds no template. A screen holds at most
// BATCH_MAX items — a larger lane renders over successive screens, each
// approved on its own.
//
// The settled lane at the specification is the one screen a gate mode
// reaches: it carries the row that sets the mode, and under auto it renders
// as a display of what is landing, with no menu — a scan the user opted out
// of is a screen with nothing on it to do. Every other lane is a scan for a
// user who is present, and renders its gated screen whatever the mode says.

const BATCH_MAX = 5;

/** A confirm's remainder tail — how many of the lane wait beyond this screen. @param {number} more */
const moreTail = (more) => (more > 0 ? ` (${more} more after this)` : '');

// The call screen — one presentation under the name each door uses. The
// `auto` member rides the specification's name alone: its walk is the one
// with a gate mode this screen can flip, so its lane is the only one with an
// unstopped form.
/** @type {{intro: (n: number) => string, question: (n: number) => string, confirm: (n: number, more: number) => string, discuss: string, ask: string, fields: string[]}} */
const CALL_LANE = {
  intro: (n) => (n === 1
    ? "This one is a call I've made, with what it rests on named beside it."
    : "Each of these is a call I've made, with what it rests on named beside it."),
  question: (n) => (n === 1 ? 'Document it?' : 'Document them?'),
  confirm: (n, more) => `${n === 1 ? 'Document it' : `Document all ${n}`} and move on${moreTail(more)}`,
  discuss: "Say discuss and a number — I'll raise it after the rest land",
  ask: 'Tell me a number to expand',
  fields: ['title', 'detail'],
};

/** @type {Record<string, {intro: (n: number) => string, question: (n: number) => string, confirm: (n: number, more: number) => string, discuss?: string, ask: string, auto?: {row: string, line: (n: number) => string}, fields: string[]}>} */
const BATCH_LANES = {
  apply: {
    intro: () => "The fix follows from what's already decided. Nothing here is a choice.",
    question: (n) => (n === 1 ? 'Apply it?' : 'Apply them?'),
    confirm: (n, more) => `${n === 1 ? 'Apply it' : `Apply all ${n}`}, then move on${moreTail(more)}`,
    ask: "Tell me a number to expand, or one you don't think is settled",
    fields: ['title', 'detail'],
  },
  settled: {
    ...CALL_LANE,
    // The opt-in and its unstopped form: the row that sets the gate mode,
    // and the line the screen closes on once it is set. The landings follow
    // the line, so it speaks in the present.
    auto: {
      row: 'Document this screen and every remaining settled finding automatically',
      line: (n) => (n === 1 ? 'Documenting it' : `Documenting all ${n}`),
    },
  },
  decide: CALL_LANE,
  route: {
    intro: (n) => (n === 1
      ? "Not this topic's to answer. It goes to its owner's triage queue as a concern, carrying the context built here."
      : "Not this topic's to answer. Each goes to its owner's triage queue as a concern, carrying the context built here."),
    question: (n) => (n === 1 ? 'Send it?' : 'Send them?'),
    confirm: (n, more) => `${n === 1 ? 'Send it' : `Send all ${n}`}${moreTail(more)}`,
    ask: 'Tell me a number to expand, or one that should stay here',
    fields: ['title', 'target', 'detail'],
  },
};

// The call screen's two names, and the fact that picks between them: the
// specification batches the calls its review has made, every other caller
// walks them. Both surfaces read it — it names the batch lane here, and at
// `render finding` it says whether a settled finding carries its own gate.
const CALL_LANE_NAMES = ['settled', 'decide'];
const SETTLED_BATCH_PHASE = 'specification';

/** The call lane the address serves — the other name is refused there. @param {string} phase */
const callLaneOf = (phase) => (phase === SETTLED_BATCH_PHASE ? 'settled' : 'decide');

/**
 * @param {string} cwd
 * @param {{dotpath: string, file?: string}} args
 * @returns {string}
 */
function findingBatch(cwd, { dotpath, file }) {
  if (!file) throw new Error('render finding-batch: --file <payload.json> is required');
  const { manifest, phase, topic } = resolveAddress(cwd, dotpath, 'finding-batch');
  const p = readJsonPayload(cwd, file, 'finding-batch');
  if (!Object.hasOwn(BATCH_LANES, p.lane)) {
    throw new Error(`render finding-batch: "lane" must be one of ${Object.keys(BATCH_LANES).join(', ')}`);
  }
  const lane = BATCH_LANES[p.lane];
  if (CALL_LANE_NAMES.includes(p.lane) && p.lane !== callLaneOf(phase)) {
    throw new Error(`render finding-batch: lane "${p.lane}" is not served at the ${phase} phase — its call lane is "${callLaneOf(phase)}"`);
  }
  if (!Array.isArray(p.items) || p.items.length === 0) {
    throw new Error(`render finding-batch: "items" must be a non-empty array of {${lane.fields.join(', ')}}`);
  }
  if (p.items.length > BATCH_MAX) {
    throw new Error(`render finding-batch: a screen holds at most ${BATCH_MAX} items (${p.items.length} given) — render the lane over successive screens`);
  }
  const more = p.remaining === undefined ? 0 : p.remaining;
  if (!Number.isInteger(more) || more < 0) {
    throw new Error('render finding-batch: "remaining" must be a non-negative integer — the count of this lane\'s findings beyond the screen');
  }
  p.items.forEach((it, i) => {
    for (const field of lane.fields) {
      if (!isFilled(it[field])) throw new Error(`render finding-batch: item ${i + 1} is missing "${field}"`);
    }
  });
  const count = p.items.length;
  // Batch rows carry no walk-state — the lane is all-or-nothing, so no
  // glyph column. A route row's destination rides the tag slot.
  const body = worklist({
    intro: lane.intro(count),
    items: p.items.map((it) => ({ title: it.title, tag: it.target ? `→ ${it.target}` : undefined, note: it.detail })),
  });
  if (lane.auto && laneHoldsAuto(itemOf(manifest, phase, topic) || {}, 'review')) {
    return section('DISPLAY: finding batch auto-approved', AUTO_GATE_MARKDOWN_INSTRUCTION,
      `${body}\n\n${lane.auto.line(count)} [auto].`);
  }
  return [
    section('DISPLAY: finding batch', 'emit verbatim as markdown', body),
    section(
      'MENU: finding batch',
      "emit verbatim as markdown, then STOP for the user's response",
      menu('', [
        cmdOption('y', 'yes', lane.confirm(count, more)),
        ...(lane.auto ? [cmdOption('a', 'auto', lane.auto.row)] : []),
        ...(lane.discuss ? [promptOption('Discuss', lane.discuss)] : []),
        promptOption('Ask', lane.ask),
      ], { question: lane.question(count) }),
    ),
  ].join('\n');
}

// The finding payload's category vocabulary — metadata carried into the
// presentation, never the thing that picks its shape. The two source-lane
// categories (Source defect, Unsourced decision) route via
// resolve-source-incoherence before any render, so their arrival at this
// surface is a caller bug and refuses by name.
const FINDING_CATEGORIES = ['enhancement', 'new-topic', 'gap', 'duplication', 'contradiction'];
const ROUTED_CATEGORIES = ['source-defect', 'unsourced-decision'];

// The move owed — what the user has to do about the finding, which is the
// only question that determines its shape. `settled`: the call is made and
// what it rests on is named, so nothing here needs the user — it applies
// without a stop wherever the gate is off, and at the specification, where
// the batch screen is its gate, it renders as a report and nothing else.
// `choice`: real options exist and picking is the user's, so the finding
// proposes nothing and the stop overrides `auto` — the stays-gated rule is
// that a choice exists, never a category. `route` belongs to
// resolve-source-incoherence and refuses here by name.
const FINDING_MOVES = ['settled', 'choice'];

/**
 * @param {string} cwd
 * @param {{dotpath: string, file?: string, view?: string}} args
 * @returns {string}
 */
function finding(cwd, { dotpath, file, view }) {
  if (view !== undefined && view !== 'full') throw new Error('render finding: --view only accepts "full"');
  if (!file) throw new Error('render finding: --file <payload.json> is required');
  const { phase, topic, manifest } = resolveAddress(cwd, dotpath, 'finding');
  const p = readJsonPayload(cwd, file, 'finding');

  if (!Number.isInteger(p.n) || p.n < 1) throw new Error('render finding: "n" must be a positive integer');
  if (!Number.isInteger(p.total) || p.total < p.n) throw new Error('render finding: "total" must be an integer ≥ "n"');
  if (!isFilled(p.title)) throw new Error('render finding: "title" must be a non-empty string');
  if (!Array.isArray(p.meta) || p.meta.some((m) => !Array.isArray(m) || m.length !== 2 || !isFilled(m[0]) || !(typeof m[1] === 'number' || isFilled(m[1])))) {
    throw new Error('render finding: "meta" must be an array of [label, value] pairs');
  }
  if (!isFilled(p.problem)) {
    throw new Error('render finding: "problem" must be a non-empty string — what is wrong, in the terms the user cares about');
  }
  if (p.move === 'route') {
    throw new Error('render finding: a "route" finding goes to resolve-source-incoherence and never renders at the gate');
  }
  if (!FINDING_MOVES.includes(p.move)) {
    throw new Error(`render finding: "move" must be one of ${FINDING_MOVES.join('/')} — the move owed picks the shape, not the category`);
  }
  if (p.category !== undefined && !FINDING_CATEGORIES.includes(p.category)) {
    if (ROUTED_CATEGORIES.includes(p.category)) {
      throw new Error(`render finding: "${p.category}" findings route via resolve-source-incoherence and never render at the gate`);
    }
    throw new Error(`render finding: unknown category "${p.category}" (expected ${FINDING_CATEGORIES.join('/')})`);
  }

  const head = [`**Finding ${p.n} of ${p.total}: ${p.title}**`, ''];
  for (const [label, value] of p.meta) head.push(`- **${label}**: ${value}`);
  head.push('', p.problem);

  if (p.move === 'choice') {
    if (view) throw new Error('render finding: --view serves a settled finding\'s wording; a choice proposes none');
    return findingChoice(p, head, itemOf(manifest, phase, topic) || {});
  }
  return findingSettled(p, head, itemOf(manifest, phase, topic) || {}, {
    view: view === 'full',
    batched: phase === SETTLED_BATCH_PHASE,
  });
}

/**
 * A choice: the report leads, the options are the numbered menu rows. No
 * proposal, nothing to apply, and no `a/auto` row at any gate mode — `auto`
 * means "don't pause me for what you can decide", never "decide what you
 * can't".
 * @param {any} p @param {string[]} head @param {any} item @returns {string}
 */
function findingChoice(p, head, item) {
  for (const field of ['proposal', 'diff', 'content']) {
    if (p[field] !== undefined) {
      throw new Error(`render finding: a "choice" finding carries no "${field}" — it presents options, never a call already made`);
    }
  }
  if (!Array.isArray(p.options) || p.options.length < 2) {
    throw new Error('render finding: a "choice" finding must carry at least 2 "options"');
  }
  p.options.forEach((/** @type {{summary?: string, recommended?: boolean}} */ o, /** @type {number} */ i) => {
    if (!o || typeof o !== 'object' || !isFilled(o.summary)) {
      throw new Error(`render finding: options[${i}].summary must be a non-empty string`);
    }
  });
  const rows = recommendedMenuRows(p.options, 'render finding: at most one option may be recommended');
  rows.push(promptOption('Comment', "Tell me what you're thinking; we'll work it through"));

  return [
    section('DISPLAY: finding', 'emit verbatim as markdown', head.join('\n')),
    section('MENU: finding choice', STOP_FOR_RESPONSE,
      menu(item.finding_gate_mode === 'auto' ? AUTO_OVERRIDE_LINE : '', rows, { question: 'Which way?' })),
  ].join('\n');
}

/**
 * A settled call: the body carries what determined it, a short diff renders
 * in place, and whole proposed content is held behind `v/view` rather than
 * dumped — the finding is a report, and the artifact text is the payload of
 * the fix, not its explanation. Where the phase batches its calls the gate
 * is the batch screen and this render is its `ask N` expansion: no menu, and
 * the wording rides the report, the expansion being the ask `v/view` would
 * otherwise answer.
 * @param {any} p @param {string[]} head @param {any} item
 * @param {{view: boolean, batched: boolean}} mode @returns {string}
 */
function findingSettled(p, head, item, { view, batched }) {
  if (!isFilled(p.proposal)) {
    throw new Error('render finding: a "settled" finding must carry a "proposal" — the call and what determined it');
  }
  if (p.options !== undefined) {
    throw new Error('render finding: a "settled" finding carries no "options" — a call with options is a choice');
  }
  if (p.diff && p.content) throw new Error('render finding: pass "diff" or "content", not both');
  if (p.content) {
    if (!isFilled(p.content.label)) throw new Error('render finding: "content.label" must be a non-empty string');
    if (stringLines(p.content.lines, 'finding', 'content.lines').length === 0) {
      throw new Error('render finding: "content.lines" must be non-empty');
    }
  }

  const applyLabel = isFilled(p.apply_label) ? p.apply_label : 'Apply verbatim';
  const appliedLabel = isFilled(p.applied_label) ? p.applied_label : 'approved. Applied.';
  const feedbackHint = isFilled(p.feedback_hint) ? p.feedback_hint : "Challenge it, adjust it, or decline it — tell me what you're thinking";

  // One gate menu, minus the view row once the wording is on screen. Decline
  // is an outcome of the Discuss exchange, never a row of its own — a
  // one-keystroke decline records no reason, and an unreasoned decline is a
  // skip whatever the key is named.
  const gateMenu = (withView) => {
    const options = [cmdOption('y', 'yes', applyLabel)];
    if (withView) options.push(cmdOption('v', 'view', 'Show the exact wording'));
    if (item.finding_gate_mode !== 'auto') {
      options.push(cmdOption('a', 'auto', 'Approve this and all remaining settled findings automatically'));
    }
    options.push(promptOption('Discuss', feedbackHint));
    return section('MENU: finding gate', STOP_FOR_RESPONSE, menu('', options, { question: 'Apply this?' }));
  };

  /** The proposed content as markdown — its label, then the lines verbatim. */
  const wording = () => section('DISPLAY: finding wording', 'emit verbatim as markdown',
    [`**${p.content.label}**`, '', ...p.content.lines].join('\n'));

  // `--view` answers the gate's own v/view row: the wording the user asked
  // for, and the gate again minus that row. The report is not repeated —
  // re-rendering it whole is how one finding comes to fill a screen twice.
  if (view) {
    if (!p.content) throw new Error('render finding: --view needs "content" — a diff finding shows its change in place');
    return batched ? wording() : [wording(), gateMenu(false)].join('\n');
  }

  head.push('', p.proposal);
  const parts = [section('DISPLAY: finding', 'emit verbatim as markdown', head.join('\n'))];

  if (p.diff) {
    const body = [
      ...stringLines(p.diff.context_above || [], 'finding', 'diff.context_above').map((l) => ` ${l}`),
      ...stringLines(p.diff.current || [], 'finding', 'diff.current').map((l) => `-${l}`),
      ...stringLines(p.diff.proposed || [], 'finding', 'diff.proposed').map((l) => `+${l}`),
      ...stringLines(p.diff.context_below || [], 'finding', 'diff.context_below').map((l) => ` ${l}`),
    ];
    if ((p.diff.current || []).length + (p.diff.proposed || []).length === 0) {
      throw new Error('render finding: "diff" must carry at least one current/proposed line');
    }
    parts.push(section('DISPLAY: diff', 'emit verbatim as a diff code block (```diff fence)', body.join('\n')));
  }
  // At a walked gate whole-section content waits for `v/view` — source read
  // aloud is what buried the report. A batched address has no such row: the
  // expansion is the user asking to see the finding, so the wording comes
  // with it, as markdown rather than as a wall of syntax.
  if (batched) {
    if (p.content) parts.push(wording());
    return parts.join('\n');
  }

  if (item.finding_gate_mode === 'auto') {
    parts.push(section(
      'DISPLAY: finding auto-approved',
      `after applying the fix: ${AUTO_GATE_INSTRUCTION}`,
      `Finding ${p.n} of ${p.total}: ${p.title} — ${appliedLabel}`,
    ));
    return parts.join('\n');
  }

  parts.push(gateMenu(Boolean(p.content)));
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Triage surfaces — the queue sidecar is engine-owned layout, so these
// surfaces list it directly; entry content never populates a render from a
// parse — per-entry agenda values arrive as a judgment payload.
// ---------------------------------------------------------------------------

/**
 * List a topic's triage queue: sorted engine-numbered basenames.
 * @param {string} cwd @param {string} workUnit @param {string} phase @param {string} topic
 * @returns {{dir: string, files: string[]}}
 */
function triageQueue(cwd, workUnit, phase, topic) {
  const dir = path.join(cwd, '.workflows', workUnit, phase, '.triage', topic);
  return {
    dir,
    files: fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort() : [],
  };
}

// triage-offer — the offer gate over a non-empty queue: the agenda (count
// and order from the live queue, per-entry lines from the caller's payload,
// keyed by queue file so payload and queue stay in exact correspondence)
// plus the yes/later menu.

/**
 * @param {string} cwd
 * @param {{dotpath: string, file?: string}} args
 * @returns {string}
 */
function triageOffer(cwd, { dotpath, file }) {
  const { workUnit, phase, topic } = resolveAddress(cwd, dotpath, 'triage-offer');
  if (!file) throw new Error('render triage-offer: --file <payload.json> is required');
  const p = readJsonPayload(cwd, file, 'triage-offer');
  const { files } = triageQueue(cwd, workUnit, phase, topic);
  if (!files.length) throw new Error(`render triage-offer: the ${topic} ${phase} triage queue is empty — nothing to offer`);
  if (!Array.isArray(p.items) || p.items.length === 0) throw new Error('render triage-offer: "items" must be a non-empty array');
  /** @type {Map<string, {file: string, title: string, origin: string, from_phase: string, from_date: string}>} */
  const byFile = new Map();
  p.items.forEach((it, i) => {
    for (const field of ['file', 'title', 'origin', 'from_phase', 'from_date']) {
      if (!isFilled(it[field])) throw new Error(`render triage-offer: item ${i + 1} is missing "${field}"`);
    }
    if (byFile.has(it.file)) throw new Error(`render triage-offer: duplicate item for "${it.file}"`);
    byFile.set(it.file, it);
  });
  if (byFile.size !== files.length || files.some((f) => !byFile.has(f))) {
    throw new Error(`render triage-offer: payload items must cover the queue exactly (queue: ${files.join(', ')})`);
  }
  // The queue is a flat set of concerns from any number of topics, so
  // provenance belongs per row — the `↳` note — rather than folded into the
  // header. Every row is pending by definition: a handled concern's file
  // leaves the queue.
  const agenda = worklist({
    heading: { label: 'Triage queue', noun: 'concern' },
    items: files.map((f) => {
      const it = /** @type {NonNullable<ReturnType<typeof byFile.get>>} */ (byFile.get(f));
      return { title: it.title, note: `From ${it.origin} · ${it.from_phase} · ${it.from_date}` };
    }),
    walked: true,
  });
  return [
    section('DISPLAY: triage agenda', 'emit verbatim as markdown', agenda),
    section(
      'MENU: triage offer',
      "emit verbatim as markdown, then STOP for the user's response",
      menu('Work through them now?', [
        cmdOption('y', 'yes', 'Surface and discuss them one at a time'),
        cmdOption('l', 'later', "Carry on with the session; I'll offer again at the next pause. The queue must be empty before this topic can conclude"),
      ]),
    ),
  ].join('\n');
}

// triage-announce — the fresh-sitting notice over a non-empty queue: one
// count-only line, no agenda — the session opens on its own material and
// the queue is offered at its first genuine break.

/**
 * @param {string} cwd
 * @param {{dotpath: string}} args
 * @returns {string}
 */
function triageAnnounce(cwd, { dotpath }) {
  const { workUnit, phase, topic } = resolveAddress(cwd, dotpath, 'triage-announce');
  const { files } = triageQueue(cwd, workUnit, phase, topic);
  if (!files.length) throw new Error(`render triage-announce: the ${topic} ${phase} triage queue is empty — nothing to announce`);
  const line = files.length === 1
    ? "1 rerouted concern from another topic waits in this topic's triage queue — I'll raise it once the session finds its footing."
    : `${files.length} rerouted concerns from other topics wait in this topic's triage queue — I'll raise them once the session finds its footing.`;
  return section('DISPLAY: triage announce', CONTINUE_INSTRUCTION, callout(line));
}

// triage-block — the conclusion blocker over a non-empty queue. Count comes
// from the live queue; the awaiting-word follows the phase.

/**
 * @param {string} cwd
 * @param {{dotpath: string}} args
 * @returns {string}
 */
function triageBlock(cwd, { dotpath }) {
  const { workUnit, phase, topic } = resolveAddress(cwd, dotpath, 'triage-block');
  const { files } = triageQueue(cwd, workUnit, phase, topic);
  if (!files.length) throw new Error(`render triage-block: the ${topic} ${phase} triage queue is empty — nothing blocks conclusion`);
  const doing = phase === 'research' ? 'exploration' : phase === 'investigation' ? 'investigation' : 'discussion';
  // A true blocker — the red register (see blocker()), guidance as markdown.
  return [
    section(
      'DISPLAY: triage block',
      'emit verbatim as a properties code block — ```properties fence',
      `⚑ Triage queue not empty — ${files.length} rerouted concern${files.length === 1 ? '' : 's'} awaiting ${doing}`,
    ),
    section(
      'DISPLAY: triage block guidance',
      'emit verbatim as markdown',
      '> Returning to the session to surface them before concluding.',
    ),
  ].join('\n');
}

// requeue-offer — the wrong-side gate over one queued concern: the raise
// found the entry owed the topic's other phase-side, and the move is the
// user's call. The reason line is judgment content and arrives in the
// payload; the destination is the pair's other phase, computed, never asked
// for.

/**
 * @param {string} cwd
 * @param {{dotpath: string, file?: string}} args
 * @returns {string}
 */
function requeueOffer(cwd, { dotpath, file }) {
  const { workUnit, phase, topic } = resolveAddress(cwd, dotpath, 'requeue-offer');
  if (phase !== 'research' && phase !== 'discussion') {
    throw new Error(`render requeue-offer: a concern moves within the research/discussion pair only — got "${phase}"`);
  }
  if (!file) throw new Error('render requeue-offer: --file <payload.json> is required');
  const p = readJsonPayload(cwd, file, 'requeue-offer');
  for (const field of ['file', 'title', 'reason']) {
    if (!isFilled(p[field])) throw new Error(`render requeue-offer: "${field}" must be a non-empty string`);
  }
  const { files } = triageQueue(cwd, workUnit, phase, topic);
  if (!files.includes(p.file)) {
    throw new Error(`render requeue-offer: "${p.file}" is not in the ${topic} ${phase} triage queue`);
  }
  const other = phase === 'research' ? 'discussion' : 'research';
  return section(
    'MENU: requeue offer',
    "emit verbatim as markdown, then STOP for the user's response",
    menu(`**${p.title}** — ${p.reason}`, [
      cmdOption('y', 'yes', `Move it to this topic's ${other} queue — raised when ${other} runs`),
      cmdOption('d', 'discuss', 'Work it here now'),
    ], { question: `Move it to ${other}?` }),
  );
}

// ---------------------------------------------------------------------------
// Bridge continuation surfaces — work-unit-level: pipeline completion
// displays and the continuation gates the bridge presents between phases.
// Address-backed (work_type from the manifest); phases ride as flags.
// ---------------------------------------------------------------------------

/** @type {Record<string, string>} */
const TYPE_LABELS = {
  feature: 'Feature',
  bugfix: 'Bugfix',
  'quick-fix': 'Quick-Fix',
  'cross-cutting': 'Cross-Cutting',
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
 * @param {{dotpath: string, phase?: string, paths?: string}} args
 * @returns {string}
 */
function phaseCompleted(cwd, { dotpath, phase, paths }) {
  const { workUnit } = resolveWorkUnit(cwd, dotpath, 'phase-completed');
  if (!isFilled(phase)) throw new Error('render phase-completed: --phase is required');
  const artefacts = paths
    ? `\n\n  Spec: .workflows/${workUnit}/specification/${workUnit}/specification.md\n  Plan: .workflows/${workUnit}/planning/${workUnit}/`
    : '';
  // A derived phase has no completion ceremony — the record closed, the
  // session ends, and sibling records may still live — so its line says what
  // is true: the session is complete, never the phase.
  const line = DERIVED_PHASES.includes(phase)
    ? `${titlecase(phase)} session complete for "${titlecase(workUnit)}".`
    : `${titlecase(phase)} completed for "${titlecase(workUnit)}".${artefacts}`;
  return section('DISPLAY: phase completed', CONTINUE_INSTRUCTION, line);
}

/**
 * The bridge's paused banner — `phase-completed`'s sibling for a phase
 * leaving on a wait. Derived, never told: the phase's in-progress items
 * holding waits, each named with what it awaits. A peer can land the wait
 * between the gate and the bridge, so no holder left renders the bare line
 * rather than refusing.
 * @param {string} cwd
 * @param {{dotpath: string, phase?: string}} args
 * @returns {string}
 */
function phasePausedSurface(cwd, { dotpath, phase }) {
  const { workUnit, manifest } = resolveWorkUnit(cwd, dotpath, 'phase-paused');
  if (!isFilled(phase)) throw new Error('render phase-paused: --phase is required');
  if (!WAITING_PHASES.includes(phase)) {
    throw new Error(`render phase-paused: --phase must be <${WAITING_PHASES.join('|')}> — the phases that pause on a wait; got "${phase}"`);
  }
  const holders = phaseItems(manifest, phase)
    .filter((item) => item.status === 'in-progress')
    .map((item) => ({ topic: item.name, waits: waits(manifest, phase, item.name) }))
    .filter((holder) => holder.waits.length > 0);
  return phasePaused(phase, workUnit, holders);
}

/**
 * The one stop between a completed phase and the next: every way forward
 * offered together — continue; complete without review, on the review hop
 * alone; revisit an earlier phase, where one is completed.
 * @param {string} cwd
 * @param {{dotpath: string, prev?: string, next?: string}} args
 * @returns {string} one MENU section, or '' when continuing is the only way forward
 */
function nextPhaseGate(cwd, { dotpath, prev, next }) {
  const { workUnit, manifest } = resolveWorkUnit(cwd, dotpath, 'next-phase-gate');
  if (!isFilled(prev)) throw new Error('render next-phase-gate: --prev is required');
  if (!isFilled(next)) throw new Error('render next-phase-gate: --next is required');
  const type = manifest.work_type;
  if (!WORK_UNIT_TYPES[type]) {
    throw new Error(`render next-phase-gate: "${workUnit}" is ${type ? `typed "${type}"` : 'untyped'} — the gate serves the linear work types`);
  }
  const cfg = workUnitTypeConfig(type);
  for (const [flag, phase] of [['--prev', prev], ['--next', next]]) {
    if (!cfg.pipeline.includes(phase)) {
      throw new Error(`render next-phase-gate: unknown ${flag} "${phase}" for a ${type} (pipeline: ${cfg.pipeline.join(', ')})`);
    }
  }
  const skipReview = next === 'review';
  const revisitable = revisitablePhases(type, { next_phase: next, completed_phases: completedPhases(cfg, manifest) });
  if (!skipReview && revisitable.length === 0) return '';

  // A derived phase's line matches phase-completed's: the session is
  // complete, never the phase — sibling records may still live.
  let statement = DERIVED_PHASES.includes(prev)
    ? `${titlecase(prev)} session complete for "${titlecase(workUnit)}".`
    : `${titlecase(prev)} completed for "${titlecase(workUnit)}".`;
  if (skipReview) {
    // A live reconcile flag makes the skip-review exit an informed choice:
    // the gate names what completing now would carry unresolved.
    const flagged = [];
    for (const [phase, data] of Object.entries(manifest.phases || {})) {
      for (const [name, item] of Object.entries((data && data.items) || {})) {
        if (item && typeof item === 'object' && item.status === 'completed' && item.reconcile_needed !== undefined) {
          flagged.push(`${phase}/${name} (${item.reconcile_needed})`);
        }
      }
    }
    if (flagged.length > 0) {
      statement += ` ⚑ Input moved beneath ${flagged.join(', ')} — completing without review carries the pending reconcile unresolved.`;
    }
  }

  const options = [cmdOption('y', 'yes', `Proceed to ${next}`)];
  if (skipReview) options.push(cmdOption('d', 'done', 'Complete without review'));
  if (revisitable.length > 0) options.push(cmdOption('r', 'revisit', 'Revisit an earlier phase'));
  return section(
    'MENU: next phase gate',
    "emit verbatim as markdown, then STOP for the user's response",
    menu(statement, options, { question: `Proceed to ${next}?` }),
  );
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
 * items by phase, the open experiment records that end abandoned, and any
 * proposed grouping discarded.
 * @param {object} manifest @param {string} topic
 */
function discoveryCancelStatement(manifest, topic) {
  if (!discoveryUnitExists(manifest, topic)) {
    throw new Error(`render cancel-gate: no topic "${topic}" — nothing on the map and no research or discussion item of that name`);
  }
  const { lifecycle } = computeTopicLifecycle(manifest, topic);
  if (lifecycle === 'cancelled') {
    throw new Error(`render cancel-gate: "${topic}" is already cancelled — the menu never offers it`);
  }
  if (lifecycle === 'postponed') {
    throw new Error(`render cancel-gate: "${topic}" is postponed — the roadmap owns it; remove its item there to cancel it, or pull it forward first`);
  }
  const locking = lockingSpecs(manifest, topic);
  if (locking.length > 0) {
    throw new Error(`render cancel-gate: "${topic}" is locked by the specification sourcing its discussion (${locking.join(', ')}) — the menu never offers it`);
  }
  const name = titlecase(topic);
  const plan = cancelPlan(manifest, 'discovery', topic);
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
  const discarded = discardedGroupingsClause(plan.discards);
  if (discarded) parts.push(discarded);
  return parts.join(' ');
}

/**
 * The proposed groupings a unit gate names as discarded, or '' when it
 * discards none — the sentence the cancel and the postpone share.
 * @param {string[]} discards
 * @returns {string}
 */
function discardedGroupingsClause(discards) {
  if (discards.length === 0) return '';
  const named = discards.map((n) => `**${titlecase(n)}**`);
  const one = named.length === 1;
  return `The proposed grouping${one ? '' : 's'} ${listJoin(named)} ${one ? 'is' : 'are'} discarded — the next grouping analysis rebuilds from the new world.`;
}

/**
 * The cancel gate's statement over a Definition unit — the specification
 * and its plan, and the source discussions the cancel frees.
 * @param {object} manifest @param {string} spec
 */
function specificationCancelStatement(manifest, spec) {
  const item = itemOf(manifest, 'specification', spec);
  if (!item) throw new Error(`render cancel-gate: no specification item "${spec}"`);
  if (item.status === 'proposed') {
    throw new Error(`render cancel-gate: "${spec}" is a proposed grouping — not started, so the menu never offers it`);
  }
  if (item.status === 'cancelled') {
    throw new Error(`render cancel-gate: "${spec}" is already cancelled — the menu never offers it`);
  }
  if (TERMINAL_STATUSES.includes(item.status)) {
    throw new Error(`render cancel-gate: "${spec}" is ${item.status} — the menu never offers it`);
  }
  if (deliveryStarted(manifest, spec)) {
    throw new Error(`render cancel-gate: "${spec}" is locked — implementation has started, so the menu never offers it`);
  }
  const plan = cancelPlan(manifest, 'specification', spec);
  if (plan.items.length === 0) {
    throw new Error(`render cancel-gate: "${spec}" has nothing to cancel — it carries no status, so the menu never offers it`);
  }
  const withPlan = plan.items.some(({ phase }) => phase === 'planning');
  const sources = sourceRows(item.sources).map(([n]) => titlecase(n));
  const frees = sources.length > 0
    ? ` and frees its source discussion${sources.length === 1 ? '' : 's'} (${sources.join(', ')}) to be regrouped or cancelled`
    : '';
  return `Cancelling **${titlecase(spec)}** marks the specification${withPlan ? ' and its plan' : ''} cancelled${frees}; it can be reactivated later.`;
}

/**
 * The cancel confirm over one unit — `<wu>.discovery.<topic>` or
 * `<wu>.specification.<spec>` — fetched by the epic menu and by a session
 * cancelling its own topic. The statement names exactly what the cancel
 * takes and stays context; the short question takes the glyph. A locked or
 * already-cancelled unit refuses: the menu never offers it.
 * @param {string} cwd
 * @param {{dotpath: string}} args
 * @returns {string}
 */
function cancelGate(cwd, { dotpath }) {
  const { phase, topic, manifest } = resolveAddress(cwd, dotpath, 'cancel-gate');
  if (!(phase in UNIT_PHASES)) {
    throw new Error(`render cancel-gate: address must be <work_unit>.discovery.<topic> or <work_unit>.specification.<spec>, got phase "${phase}"`);
  }
  const statement = phase === 'discovery'
    ? discoveryCancelStatement(manifest, topic)
    : specificationCancelStatement(manifest, topic);
  return section(
    'MENU: cancel gate',
    "emit verbatim as markdown, then STOP for the user's response",
    menu(statement, [
      cmdOption('y', 'yes', 'Confirm cancellation'),
      cmdOption('n', 'no', 'Keep it'),
    ], { question: 'Cancel it?' }),
  );
}

/**
 * The postpone gate's statement in two halves: what goes — the map row alone
 * for a never-started topic, otherwise the items by phase, with any proposed
 * grouping discarded — and where it lands, in the park gate's shape.
 * @param {string} workUnit @param {string} topic
 * @param {import('./derivations.cjs').PostponePlan} plan @param {string} horizon
 * @param {Record<string, any>|null} project  the project manifest, the gate's one read
 * @returns {string}
 */
function postponeStatement(workUnit, topic, plan, horizon, project) {
  const name = titlecase(topic);
  const goes = plan.items.length === 0
    ? `Postponing **${name}** sets it aside — nothing has started, so only the map row is marked.`
    : `Postponing **${name}** marks its ${listJoin(plan.items.map(({ phase, item }) => `${phase} [${item.status}]`))} postponed — its record stays on disk and comes back with the pull.`;
  const roadmap = project && hasRoadmapNode(project) ? project.roadmap : null;
  const horizons = roadmap && Array.isArray(roadmap.horizons) ? roadmap.horizons : [];
  const target = postponeTarget(project, workUnit, topic);
  const flag = roadmap && !horizons.includes(horizon) ? ' (new)' : '';
  const lands = target.joined
    ? `Its own item **${titlecase(target.name)}** re-waits under "${horizon}"${flag}.`
    : `It waits on the roadmap under "${horizon}"${flag}, until it is pulled into work.`;
  return [goes, discardedGroupingsClause(plan.discards), lands, ...(roadmap ? [] : ['The roadmap is created with it.'])]
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
    "emit verbatim as markdown, then STOP for the user's response",
    menu(postponeStatement(workUnit, topic, plan, /** @type {string} */ (horizon), project), [
      cmdOption('y', 'yes', 'Postpone it'),
      cmdOption('n', 'no', 'Keep it here'),
      promptOption('Comment', 'Tell me what to change (the horizon)'),
    ], { question: 'Postpone it?' }),
  );
}

/**
 * @param {string} cwd
 * @param {{dotpath: string}} args
 * @returns {string}
 */
function epicAllDoneGate(cwd, { dotpath }) {
  const { workUnit } = resolveWorkUnit(cwd, dotpath, 'epic-all-done-gate');
  return section(
    'MENU: epic all-done gate',
    "emit verbatim as markdown, then STOP for the user's response",
    menu(`All topics have completed review for "${titlecase(workUnit)}".`, [
      cmdOption('y', 'yes', 'Mark this epic as completed'),
      cmdOption('n', 'no', 'Return to the epic menu'),
    ], { question: 'Mark it completed?' }),
  );
}

// ---------------------------------------------------------------------------
// epic-soft-gate — the epic menu's advisory phase gates, one surface for the
// whole table. Empty when the selection raises no concern. The specification
// row counts the discussions the grouping analysis will read; the planning
// and implementation rows read the build order and name the topics sitting
// ahead of the selection. Discussion entries carry no gate: research
// outstanding on a topic is a wait on its discussion's conclusion, held by
// the wait gate, never a warning at entry. Advisory always: the menu offers
// proceed-anyway, never a refusal.
// ---------------------------------------------------------------------------

const { SOFT_GATE_ACTIONS } = require('./projections/epic.cjs');

/**
 * Topics ahead of the selection in the build order that lack a completed
 * item in the named phase. Empty when the selection carries no order.
 * @param {object} manifest @param {string} topic @param {string} donePhase
 * @returns {{name: string, order: number}[]}
 */
function buildOrderAhead(manifest, topic, donePhase) {
  const specs = phaseItems(manifest, 'specification').filter(buildOrderLive);
  const selected = specs.find((i) => i.name === topic);
  // A topic outside the live ordered set passes silently: a legacy epic's
  // unordered items, and a plan legitimately outliving its spec (the spec
  // cancelled, superseded, or promoted while its plan runs). The gate is
  // advisory — only a typo'd --action refuses.
  if (!selected || !Number.isInteger(selected.order)) return [];
  const done = new Set(phaseItems(manifest, donePhase)
    .filter((i) => i.status === 'completed')
    .map((i) => i.name));
  return specs
    .filter((i) => Number.isInteger(i.order) && i.order < selected.order && i.name !== topic && !done.has(i.name))
    .sort((a, b) => a.order - b.order)
    .map((i) => ({ name: i.name, order: /** @type {number} */ (i.order) }));
}

/** @param {{name: string, order: number}[]} ahead @returns {string} */
function aheadPhrase(ahead) {
  const names = ahead.map((a) => `"${titlecase(a.name)}"`);
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * @param {string} cwd
 * @param {{dotpath: string, action?: string, topic?: string}} args
 * @returns {string} one MENU section, or '' when the selection passes
 */
function epicSoftGate(cwd, { dotpath, action, topic }) {
  const { manifest } = resolveWorkUnit(cwd, dotpath, 'epic-soft-gate');
  if (!isFilled(action)) throw new Error('render epic-soft-gate: --action is required');
  if (!SOFT_GATE_ACTIONS.includes(/** @type {string} */ (action))) {
    throw new Error(`render epic-soft-gate: unknown --action "${action}" (menu actions: ${SOFT_GATE_ACTIONS.join(', ')})`);
  }

  let message = null;
  let advisory = 'The system will re-analyse if you revisit later — proceeding now is safe, but may require rework.';

  if (action === 'start_specification') {
    // The discussions the grouping analysis reads: in-progress and completed.
    // A parked stub or a terminal item never reaches it, so never counts.
    const read = phaseItems(manifest, 'discussion').filter((i) => i.status === 'in-progress' || i.status === 'completed');
    const inProgress = read.filter((i) => i.status === 'in-progress').length;
    if (read.length > 0 && inProgress > 0) {
      message = `${inProgress} of ${read.length} discussions still in-progress. Later conclusions may reshape this grouping.`;
    }
  } else if (action === 'start_planning' || action === 'continue_planning') {
    if (!isFilled(topic)) throw new Error(`render epic-soft-gate: --topic is required for ${action}`);
    const ahead = buildOrderAhead(manifest, topic, 'planning');
    if (ahead.length > 0) {
      message = `You're about to plan "${titlecase(topic)}" — ${aheadPhrase(ahead)} ${ahead.length === 1 ? 'is' : 'are'} ahead of it in the build order and unplanned.`;
      advisory = 'The build order is advisory — proceeding now is safe; the gate only names what sits ahead.';
    }
  } else if (action === 'start_implementation' || action === 'continue_implementation') {
    if (!isFilled(topic)) throw new Error(`render epic-soft-gate: --topic is required for ${action}`);
    const ahead = buildOrderAhead(manifest, topic, 'implementation');
    if (ahead.length > 0) {
      message = `You're about to implement "${titlecase(topic)}" — ${aheadPhrase(ahead)} ${ahead.length === 1 ? 'is' : 'are'} ahead of it in the build order and unbuilt.`;
      advisory = 'The build order is advisory — proceeding now is safe; the gate only names what sits ahead.';
    }
  }

  if (!message) return '';
  return section(
    'MENU: epic soft gate',
    "emit verbatim as markdown, then STOP for the user's response",
    menuFrame([
      message,
      '',
      advisory,
      '',
      `**\`${MENU_GLYPH} Proceed anyway?\`**`,
      '',
      cmdOption('y', 'yes', 'Proceed anyway'),
      cmdOption('b', 'back', 'Return to menu'),
    ]),
  );
}

// ---------------------------------------------------------------------------
// phase-note — the entry skills' one-line status notes (Resuming / Starting /
// Reopening …). Address-backed; the verb is the caller's word, the noun
// defaults to the phase segment (planning overrides with "plan"). Only ever
// rendered by an entry skill for its own phase, so it beats the addressed
// topic — the code-gate precedent: claiming the slot is the same act as
// announcing the entry.
// ---------------------------------------------------------------------------

/**
 * @param {string} cwd
 * @param {{dotpath: string, verb?: string, noun?: string}} args
 * @returns {string}
 */
function phaseNote(cwd, { dotpath, verb, noun }) {
  const { workUnit, phase, topic } = resolveAddress(cwd, dotpath, 'phase-note');
  if (!isFilled(verb)) throw new Error('render phase-note: --verb is required (e.g. Resuming, Reopening, Starting)');
  beatQuietly(cwd, workUnit, phase, topic);
  return section(
    'DISPLAY: phase note',
    CONTINUE_INSTRUCTION,
    `${verb} ${isFilled(noun) ? noun : phase}: ${titlecase(topic)}`,
  );
}

// ---------------------------------------------------------------------------
// entry-gate — the entry skills' prerequisite check. The engine derives the
// verdict from manifest state (the reads and the branch leave the prose):
// an empty response means clear — proceed; a blocked response carries the
// terminal blocker display.
// ---------------------------------------------------------------------------

// Blocked states render red: a `properties` fence colours the first token
// (the ⚑) turquoise and everything after it red, and is the one highlighter
// that never tokenises English — so the message stays uniform whatever words
// it contains. One logical line only; a hard-wrapped continuation would
// restart the per-line colouring mid-sentence, while soft-wrap keeps it
// intact. Red means "you cannot proceed" — guidance travels in its own
// markdown section as a signpost, so it reflows and stays calm.
/** @param {string} fact @param {string} guidance */
function blocker(fact, guidance) {
  return [
    section(
      'DISPLAY: entry blocker',
      'emit verbatim as a properties code block — ```properties fence',
      `⚑ ${fact}`,
    ),
    section(
      'DISPLAY: blocker guidance',
      'emit verbatim as markdown, then STOP — terminal condition',
      `> ${guidance}`,
    ),
  ].join('\n');
}

// ---------------------------------------------------------------------------
// direct-entry-gate — the epic menu's d/r doors take a free-typed topic name.
// A name already on the map is not a new topic: the menu row is the way in,
// so the door refuses, naming where the topic stands — outstanding research
// first, at either door, since its row is the topic's own; a closed topic
// names its closure, which is what explains its empty menu. Empty when the
// name is new, or the work unit carries no map.
// ---------------------------------------------------------------------------

/**
 * @param {string} cwd
 * @param {{dotpath: string}} args
 * @returns {string} blocker sections, or '' when the name is free to start
 */
function directEntryGate(cwd, { dotpath }) {
  const { phase, topic, manifest } = resolveAddress(cwd, dotpath, 'direct-entry-gate');
  if (phase !== 'research' && phase !== 'discussion') {
    throw new Error(`render direct-entry-gate: phase must be research or discussion, got "${phase}"`);
  }
  if (manifest.work_type !== 'epic') return '';
  const item = phaseItems(manifest, 'discovery').find((i) => i.name === topic);
  if (!item) return '';
  const { lifecycle, research_state } = computeTopicLifecycle(manifest, topic);
  const research = CLOSED_LIFECYCLES.includes(lifecycle) ? null : outstandingResearch(manifest, topic);
  const stands = research ? outstandingResearchPhrase(research) : lifecyclePhrase(lifecycle, research_state, item.routing);
  const guidance = lifecycle === 'cancelled'
    ? 'Reactivate it from the epic menu (e/reactivate) — a cancelled topic carries no menu row.'
    : lifecycle === 'postponed'
      ? 'Pull it forward from the epic menu (f/forward) — a postponed topic carries no menu row.'
      : `Return to the epic menu — ${research ? 'its research row is the way in' : 'its row for the topic names the next step'}.`;
  return blocker(`"${titlecase(topic)}" is already on the map — ${stands}`, guidance);
}

/**
 * @param {string} cwd
 * @param {{dotpath: string, own?: string}} args
 * @returns {string} blocker sections, or '' when the entry is clear
 */
function entryGate(cwd, { dotpath, own }) {
  const { phase, topic, manifest } = resolveAddress(cwd, dotpath, 'entry-gate');
  const t = titlecase(topic);

  if (own) {
    // --own checks the topic's OWN terminal statuses at phase entry, not its
    // prerequisites — the entry flow's routing handles the live statuses.
    if (phase !== 'specification') {
      throw new Error(`render entry-gate: --own is only supported for specification, got "${phase}"`);
    }
    const spec = itemOf(manifest, 'specification', topic) || {};
    if (spec.status === 'superseded') {
      return blocker(
        `The specification for "${t}" was consolidated into "${titlecase(String(spec.superseded_by || ''))}"`,
        'Work on that specification instead.',
      );
    }
    if (spec.status === 'promoted') {
      return blocker(
        `"${t}" was promoted to the cross-cutting work unit "${String(spec.promoted_to || '')}"`,
        'Continue it from that work unit.',
      );
    }
    return '';
  }

  if (phase === 'discussion') {
    // Research feeds discussion: outstanding research holds the discussion
    // shut at entry, every work type — the birth guard's read, rendered.
    const research = outstandingResearch(manifest, topic);
    if (!research) return '';
    return blocker(
      `Entry blocked — this discussion awaits research on "${t}" (${researchWaitState(research)})`,
      manifest.work_type === 'epic'
        ? 'Return to the epic menu — its research row is the way in.'
        : 'Continue the work unit — the research is its next step.',
    );
  }

  if (phase === 'planning') {
    const spec = itemOf(manifest, 'specification', topic);
    const status = spec && spec.status;
    if (!status) {
      return blocker(
        `No specification found for "${t}"`,
        'The specification must be completed before planning can begin.',
      );
    }
    if (status === 'in-progress') {
      return blocker(
        `The specification for "${t}" is not yet completed`,
        'The specification must be completed before planning can begin.',
      );
    }
    if (status === 'proposed') {
      return blocker(
        `"${t}" is a proposed grouping — the specification hasn't been started yet`,
        'Start the specification first, then return to planning once it completes.',
      );
    }
    if (status === 'superseded') {
      return blocker(
        `The specification for "${t}" was consolidated into "${titlecase(String(spec.superseded_by || ''))}"`,
        'Plan the superseding specification instead.',
      );
    }
    if (status === 'promoted') {
      return blocker(
        `"${t}" was promoted to the cross-cutting work unit "${String(spec.promoted_to || '')}"`,
        'Cross-cutting specifications inform other plans — they are not planned directly.',
      );
    }
    // A specification reading `completed` can still be a record in motion —
    // its input moved, or a source row is not yet extracted or has moved
    // beneath the extraction — and a plan built from one is built from a
    // document about to change.
    const unsettled = specUnsettled(manifest, topic);
    if (unsettled) {
      return blocker(
        `Entry blocked — the specification for "${t}" is unsettled (${specUnsettledPhrase(unsettled)})`,
        manifest.work_type === 'epic'
          ? 'Return to the epic menu — the specification is the way in: its row, or c/completed while it still reads completed.'
          : 'Continue the work unit — the specification is its next step.',
      );
    }
    return '';
  }

  if (phase === 'implementation') {
    const plan = itemOf(manifest, 'planning', topic);
    if (!plan || !plan.status) {
      return blocker(
        `No plan found for "${t}"`,
        'A completed plan is required for implementation.',
      );
    }
    if (plan.status !== 'completed') {
      return blocker(
        `The plan for "${t}" is not yet completed`,
        'A completed plan is required for implementation.',
      );
    }
    return '';
  }

  if (phase === 'review') {
    if (!itemOf(manifest, 'planning', topic)) {
      return blocker(
        `No plan found for "${t}"`,
        'A completed plan and completed implementation are required for review.',
      );
    }
    const impl = itemOf(manifest, 'implementation', topic);
    if (!impl) {
      return blocker(
        `No implementation found for "${t}"`,
        'A completed implementation is required for review.',
      );
    }
    if (impl.status !== 'completed') {
      return blocker(
        `The implementation for "${t}" is not yet completed`,
        'A completed implementation is required for review.',
      );
    }
    return '';
  }

  if (phase === 'specification') {
    const wu = titlecase(manifest.name || topic);
    const workType = manifest.work_type;
    if (workType === 'bugfix') {
      const inv = itemOf(manifest, 'investigation', topic);
      if (!inv) {
        return blocker(
          `No investigation found for "${wu}"`,
          'A completed investigation is required before specification can begin.',
        );
      }
      if (inv.status !== 'completed') {
        return blocker(
          `The investigation for "${wu}" is not yet completed`,
          'The investigation must be completed before specification can begin.',
        );
      }
      return '';
    }
    if (workType === 'epic') {
      const items = ((manifest.phases || {}).discussion || {}).items || {};
      const names = Object.keys(items);
      if (names.length === 0) {
        return blocker(
          `No discussions found for "${wu}"`,
          'At least one completed discussion is required before specification can begin.',
        );
      }
      if (!names.some((n) => items[n] && items[n].status === 'completed')) {
        return blocker(
          `No completed discussions found for "${wu}"`,
          'At least one completed discussion is required before specification can begin. Run /workflow-start to continue an in-progress discussion.',
        );
      }
      // The topic's own sources must be settled: a source discussion back
      // in-progress (a gap routed into it), or one the gap exit opened as a
      // new topic and parked, blocks this spec until it concludes.
      // sourceRows decodes the map and legacy array forms.
      const spec = itemOf(manifest, 'specification', topic);
      const open = sourceRows(spec && spec.sources)
        .map(([n]) => n)
        .filter((n) => n && items[n] && OPEN_SOURCE_STATUSES.includes(items[n].status));
      if (open.length > 0) {
        return blocker(
          `Sources for "${t}" are not concluded: ${open.join(', ')}`,
          'A specification cannot be built from a record still open — conclude the discussion(s), then re-enter this specification.',
        );
      }
      return '';
    }
    // feature / cross-cutting: the topic's own discussion.
    const disc = itemOf(manifest, 'discussion', topic);
    if (!disc) {
      return blocker(
        `No discussion found for "${wu}"`,
        'A completed discussion is required before specification can begin.',
      );
    }
    if (disc.status !== 'completed') {
      return blocker(
        `The discussion for "${wu}" is not yet completed`,
        'The discussion must be completed before specification can begin.',
      );
    }
    return '';
  }

  throw new Error(`render entry-gate: no prerequisite rules for phase "${phase}" (discussion|planning|implementation|review|specification)`);
}

// ---------------------------------------------------------------------------
// code-gate — the one-code-session rule at the entry chokepoint. Everything
// else in the system partitions by topic; the tree and the index do not, so
// a second implementation or review session anywhere in the checkout writes
// the same files as the first. The gate states who holds the slot and lets
// the user through anyway — the machine can verify that a process still
// runs, never that its session still matters. An empty response means the
// slot is free, and taking it is the same act as reading it: the empty path
// beats the addressed topic, so the slot is held from entry rather than from
// the session's first code commit.
// ---------------------------------------------------------------------------

/** @param {string} phase */
function codeVerb(phase) {
  return phase === 'review' ? 'reviewing' : 'implementing';
}

/**
 * @param {string} cwd
 * @param {{dotpath: string}} args
 * @returns {string} the gate's sections, or '' when no other session holds code
 */
function codeGate(cwd, { dotpath }) {
  const { workUnit, phase, topic } = resolveAddress(cwd, dotpath, 'code-gate');
  if (!CODE_PHASES.includes(phase)) {
    throw new Error(`render code-gate: the code rule covers ${CODE_PHASES.join('|')} only, got "${phase}"`);
  }
  // The empty path beats this address, and a beat is silent on a name it
  // cannot write — so a malformed topic would claim nothing while rendering a
  // free slot. The item itself may not exist yet (a fresh entry gates before
  // it initialises anything); the name must still be a name.
  if (/[\\/]/.test(topic) || topic.includes('..')) {
    throw new Error(`render code-gate: invalid topic name "${topic}" — no separators or ".."`);
  }
  const holders = heldCodeSessions(cwd);
  if (holders.length === 0) {
    // The slot is free, and this session is taking it. This check is the
    // chokepoint every route into a code phase passes through, so it is the
    // session's first structurally self-referential act on its own topic —
    // and the beat here is what closes the window between entering the phase
    // and the first code commit, during which a second session would read
    // the slot as free. A session's own rows never gate it, so a re-render
    // stays empty and simply refreshes the hold.
    beatQuietly(cwd, workUnit, phase, topic);
    return '';
  }

  const facts = holders.map((h) =>
    `⚑ Another session is ${codeVerb(h.phase)} "${titlecase(h.topic)}" (${h.work_unit}) — last active ${fmtAge(h.age_seconds)} ago.`);
  const first = holders[0];
  return [
    section(
      'DISPLAY: code gate',
      'emit verbatim as a properties code block — ```properties fence',
      facts.join('\n'),
    ),
    section(
      'MENU: code gate',
      "emit verbatim as markdown, then STOP for the user's response",
      menuFrame([
        'Code phases run one at a time — concurrent sessions write the same files, and even worktrees end in merge conflicts. Only proceed if you know that session is no longer working; if it is wedged but alive, release its hold with '
          + `\`node .claude/skills/workflow-engine/scripts/engine.cjs presence clear ${first.work_unit} ${first.phase} ${first.topic}\`.`,
        '',
        '**`◆ Proceed anyway?`**',
        '',
        cmdOption('b', 'back', 'Leave that session to it (recommended)'),
        cmdOption('y', 'yes', 'Enter anyway — two sessions on one code base'),
      ]),
    ),
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Task-loop surfaces — the brief, the result header, and the gates, fetched
// by the implementation loop at the exact stage that displays them, so the
// section always sits in the tool result directly above its emission.
// State-backed: the in-flight task, gate modes, and fix attempts come from
// the implementation item; gate-mode branching renders inside the gate
// surfaces. `blocked-tasks` and `cycle-gate` are static menus and take no
// address.
// ---------------------------------------------------------------------------

/**
 * The implementation item at a `<wu>.implementation.<topic>` address, plus
 * its in-flight task id. Loud when the address names another phase or no
 * task is in flight — these surfaces serve the task loop, which always has
 * a current task at its presentation moments and gates.
 * @param {string} cwd @param {string} dotpath @param {string} surface
 * @returns {{item: Record<string, any>, taskId: string}}
 */
function implItemAt(cwd, dotpath, surface) {
  const { phase, topic, manifest } = resolveAddress(cwd, dotpath, surface);
  if (phase !== 'implementation') {
    throw new Error(`render ${surface}: address must be <work_unit>.implementation.<topic>, got phase "${phase}"`);
  }
  const item = itemOf(manifest, 'implementation', topic);
  if (!item) throw new Error(`render ${surface}: no implementation item "${topic}"`);
  const taskId = item.current_task;
  if (typeof taskId !== 'string' || taskId === '') {
    throw new Error(`render ${surface}: no current task on "${topic}" — run \`task start\` first`);
  }
  return { item, taskId };
}

/**
 * Validate the shared task-header payload and build its two parts — the
 * sub-step marker naming the task, and the meta rows beneath it. One
 * definition shared by task-brief and task-result, so the two headers
 * cannot drift; they differ only in what sits between the parts. The
 * required `id` must name the in-flight task: both payload files are
 * per-topic and reused task after task, and a stale one must refuse rather
 * than render under the wrong task. Then `title` — the task's name is the
 * plan format's, never manifest state — with its optional `current`/`total`
 * ordinal, which the format's listing may not yield; then `phase`, optional
 * `position`, optional `external {label, id}`.
 * @param {any} p @param {string} taskId @param {string} surface
 * @returns {{marker: string, rows: string[]}}
 */
function taskHeader(p, taskId, surface) {
  if (!isFilled(p.id)) throw new Error(`render ${surface}: "id" must be a non-empty string`);
  if (p.id !== taskId) {
    throw new Error(`render ${surface}: payload "id" is "${p.id}" but the in-flight task is "${taskId}" — a stale ${surface}.json; rewrite the payload for the current task`);
  }
  if (!isFilled(p.title)) throw new Error(`render ${surface}: "title" must be a non-empty string`);
  const counted = p.current !== undefined || p.total !== undefined;
  if (counted) {
    if (!Number.isInteger(p.current) || p.current < 1) {
      throw new Error(`render ${surface}: "current" must be a positive integer — omit it and "total" together when the format's listing cannot yield them`);
    }
    if (!Number.isInteger(p.total) || p.total < p.current) {
      throw new Error(`render ${surface}: "total" must be an integer ≥ "current"`);
    }
  }
  if (!isFilled(p.phase)) throw new Error(`render ${surface}: "phase" must be a non-empty string`);
  if (p.position !== undefined && !isFilled(p.position)) {
    throw new Error(`render ${surface}: "position" must be a non-empty string when present`);
  }
  if (p.external !== undefined && (!p.external || typeof p.external !== 'object' || Array.isArray(p.external)
    || !isFilled(p.external.label) || !isFilled(p.external.id))) {
    throw new Error(`render ${surface}: "external" must be {label, id} when present`);
  }
  const marker = `**\`▪ ${p.title.trim()}${counted ? ` (${p.current} of ${p.total})` : ''}\`**`;
  const idRow = p.external ? `\`${taskId}\` · ${p.external.label} \`${p.external.id}\`` : `\`${taskId}\``;
  const rows = [`- **Id**: ${idRow}`, `- **Phase**: ${p.phase}`];
  if (p.position !== undefined) rows.push(`- **Position**: ${p.position}`);
  return { marker, rows };
}

// ---------------------------------------------------------------------------
// task-brief — the loop's pre-dispatch announcement, rendered as the loop
// takes up a task: between `task start` and the executor dispatch. The
// payload's required `id` must name the in-flight task — the payload file
// is per-topic, and a stale one would describe the previous task under the
// current id. The marker and meta rows come from the shared task-header
// builder; the summary and watch lines are judgment content the manifest
// never holds — what the task is about to change, and what deserves eyes
// when it lands. No verdict line: nothing has happened yet, and its absence
// is what tells the brief apart from the result.
// ---------------------------------------------------------------------------

/**
 * @param {string} cwd
 * @param {{dotpath: string, file?: string}} args
 * @returns {string}
 */
function taskBrief(cwd, args) {
  const { dotpath, file } = args;
  if (!file) throw new Error('render task-brief: --file <payload.json> is required');
  const { taskId } = implItemAt(cwd, dotpath, 'task-brief');
  const p = readJsonPayload(cwd, file, 'task-brief');
  const { marker, rows } = taskHeader(p, taskId, 'task-brief');
  if (!isFilled(p.summary)) throw new Error('render task-brief: "summary" must be a non-empty string');
  const watch = p.watch === undefined ? null : stringLines(p.watch, 'task-brief', 'watch');
  if (watch !== null && (watch.length === 0 || watch.some((l) => l.trim() === ''))) {
    throw new Error('render task-brief: "watch" must be a non-empty array of non-empty strings when present');
  }

  const body = [marker, '', ...rows, '', p.summary.trim()];
  if (watch !== null) body.push('', '**Watch**:', ...watch.map((l) => `- ${l.trim()}`));
  return section('DISPLAY: task brief', CONTINUE_MARKDOWN_INSTRUCTION, body.join('\n'));
}

// ---------------------------------------------------------------------------
// task-result — the task loop's result header: one shape for every
// presentation moment. The verdict vocabulary and its lines are one table,
// so membership and rendering cannot drift apart — an unknown result
// refuses rather than borrowing another verdict's line. Verdict detail is
// state-derived (`fix_attempts` against the threshold); the plan phase
// label, in-phase position, and the format's display identifier ride in
// the payload, whose required `id` must name the in-flight task — the
// same per-topic staleness guard as the brief's. The result itself is a
// flag — blocked/failed is executor knowledge the manifest never holds.
// The header names the task; the gate surfaces below it never repeat the
// id.
// ---------------------------------------------------------------------------

/** @type {Record<string, (attempts: number) => string>} */
const TASK_RESULT_VERDICTS = {
  approved: (attempts) => attempts > 0
    ? `**✓ Approved** — *after ${attempts} needs-changes round${attempts === 1 ? '' : 's'}*`
    : '**✓ Approved**',
  'needs-changes': (attempts) => attempts >= FIX_THRESHOLD
    ? `**◐ Needs changes** — *attempt ${attempts}, escalation threshold reached*`
    : `**◐ Needs changes** — *attempt ${attempts}, escalates at ${FIX_THRESHOLD}*`,
  blocked: () => '**⚑ Blocked** — *the executor stopped before completing this task*',
  failed: () => '**⚑ Failed** — *the executor could not complete this task*',
};

/**
 * @param {string} cwd
 * @param {{dotpath: string, file?: string, result?: string}} args
 * @returns {string}
 */
function taskResult(cwd, args) {
  const { dotpath, file, result } = args;
  if (!file) throw new Error('render task-result: --file <payload.json> is required');
  const verdictOf = result === undefined ? undefined : TASK_RESULT_VERDICTS[result];
  if (!verdictOf) {
    throw new Error(`render task-result: --result must be approved, needs-changes, blocked, or failed, got "${result}"`);
  }
  const { item, taskId } = implItemAt(cwd, dotpath, 'task-result');
  const p = readJsonPayload(cwd, file, 'task-result');
  const { marker, rows } = taskHeader(p, taskId, 'task-result');

  const attempts = counterOf(item, 'fix_attempts');
  if (result === 'needs-changes' && attempts < 1) {
    throw new Error('render task-result: fix_attempts is 0 — run `task fix-attempt` before a needs-changes result');
  }

  return section('DISPLAY: task result', CONTINUE_MARKDOWN_INSTRUCTION, [marker, '', verdictOf(attempts), '', ...rows].join('\n'));
}

/** @param {string} cwd @param {{dotpath: string}} args @returns {string} */
function taskGate(cwd, args) {
  const { item } = implItemAt(cwd, args.dotpath, 'task-gate');
  return taskGateSection(gateOf(item, 'task_gate_mode'));
}

/** @param {string} cwd @param {{dotpath: string}} args @returns {string} */
function fixGate(cwd, args) {
  const { item } = implItemAt(cwd, args.dotpath, 'fix-gate');
  const attempts = typeof item.fix_attempts === 'number' ? item.fix_attempts : 0;
  return fixGateSection(gateOf(item, 'fix_gate_mode'), attempts >= FIX_THRESHOLD);
}

/** @param {string} cwd @param {{dotpath: string}} args @returns {string} */
function cycleLimit(cwd, args) {
  const { phase, topic, manifest } = resolveAddress(cwd, args.dotpath, 'cycle-limit');
  if (phase !== 'implementation') {
    throw new Error(`render cycle-limit: address must be <work_unit>.implementation.<topic>, got phase "${phase}"`);
  }
  const item = itemOf(manifest, 'implementation', topic);
  if (!item) throw new Error(`render cycle-limit: no implementation item "${topic}"`);
  const total = counterOf(item, 'analysis_cycle_total');
  if (total <= CYCLE_LIMIT) {
    throw new Error(`render cycle-limit: analysis_cycle_total is ${total}, within the cycle limit of ${CYCLE_LIMIT}`);
  }
  return cycleLimitDisplay(total, CYCLE_LIMIT);
}

/**
 * The spec-correction confirmation. Address-free: the count is the session's
 * own (the corrigenda it just landed), never manifest state.
 * @param {string} _cwd @param {Record<string, string|undefined>} args @returns {string}
 */
function specCorrections(_cwd, args) {
  const count = Number(args.count);
  if (args.count === undefined || !Number.isInteger(count) || count < 1) {
    throw new Error(`render spec-corrections: --count must be a whole number of at least 1, got ${JSON.stringify(args.count)}`);
  }
  return specCorrectionsDisplay(count);
}

/** @returns {string} */
function blockedTasks() {
  return blockedTasksMenu();
}

/** @returns {string} */
function cycleGate() {
  return cycleGateMenu();
}

// ---------------------------------------------------------------------------
// Transaction receipts — fetched by the calling flow right after its
// lifecycle verb, so the verb's stdout stays one JSON line. Each surface
// validates that the state it renders from matches the verb it receipts:
// a receipt fetched out of place refuses loudly. `--warn` prepends the
// knowledge advisory — the caller sets it when the transaction's JSON
// carried `warnings`.
// ---------------------------------------------------------------------------

const WORKUNIT_RECEIPT_STATUS = { complete: 'completed', cancel: 'cancelled', reactivate: 'in-progress' };

/** @param {string} cwd @param {{dotpath: string, verb?: string, pipeline?: string, 'skipped-review'?: string, warn?: string}} args @returns {string} */
function workunitReceiptSurface(cwd, args) {
  const { manifest, workUnit } = resolveWorkUnit(cwd, args.dotpath, 'workunit-receipt');
  const verb = args.verb;
  if (verb !== 'complete' && verb !== 'cancel' && verb !== 'reactivate' && verb !== 'pivot') {
    throw new Error(`render workunit-receipt: --verb must be complete, cancel, reactivate, or pivot, got "${verb}"`);
  }
  if (verb === 'pivot') {
    if (manifest.work_type !== 'epic') {
      throw new Error(`render workunit-receipt: "${workUnit}" is not an epic — nothing to receipt for a pivot`);
    }
  } else if (manifest.status !== WORKUNIT_RECEIPT_STATUS[verb]) {
    throw new Error(`render workunit-receipt: "${workUnit}" is "${manifest.status}", not "${WORKUNIT_RECEIPT_STATUS[verb]}" — the ${verb} has not run`);
  }
  return workunitReceipt(verb, workUnit, manifest.work_type, {
    pipeline: args.pipeline === '1',
    skippedReview: args['skipped-review'] === '1',
    warn: args.warn === '1',
  });
}

/**
 * Whether a cancel unit reads cancelled: the map lifecycle for a Discovery
 * unit, the specification's own status for a Definition unit. Loud when the
 * unit does not exist.
 * @param {object} manifest @param {'discovery'|'specification'} stage @param {string} name
 */
function unitCancelled(manifest, stage, name) {
  if (stage === 'discovery') {
    if (!discoveryUnitExists(manifest, name)) {
      throw new Error(`render topic-receipt: no topic "${name}" — nothing on the map and no research or discussion item of that name`);
    }
    return computeTopicLifecycle(manifest, name).lifecycle === 'cancelled';
  }
  const item = itemOf(manifest, 'specification', name);
  if (!item) throw new Error(`render topic-receipt: no specification item "${name}"`);
  return item.status === 'cancelled';
}

/**
 * The statuses a unit's live items stand at — what a reactivate or a pull
 * forward returned them to.
 * @param {object} manifest @param {'discovery'|'specification'} stage @param {string} name
 */
function unitStatuses(manifest, stage, name) {
  return liveUnitItems(manifest, stage, name).map(({ phase, item }) => ({ phase, status: item.status }));
}

/**
 * The Discovery unit a postpone-side receipt addresses, refused when the
 * dotpath names another stage or no unit of the name.
 * @param {object} manifest @param {string} phase @param {string} topic @param {string} verb
 */
function assertDiscoveryUnitAddress(manifest, phase, topic, verb) {
  if (phase !== 'discovery') {
    throw new Error(`render topic-receipt: --verb ${verb} addresses the Discovery unit — <work_unit>.discovery.<topic>, got phase "${phase}"`);
  }
  if (!discoveryUnitExists(manifest, topic)) {
    throw new Error(`render topic-receipt: no topic "${topic}" — nothing on the map and no research or discussion item of that name`);
  }
}

/**
 * The topic receipts. `complete` addresses the phase item; `cancel`,
 * `reactivate`, `postpone` and `restore` address the unit —
 * `<wu>.discovery.<topic>` or `<wu>.specification.<spec>` — and read its
 * state after the verb ran.
 * @param {string} cwd @param {{dotpath: string, verb?: string, warn?: string}} args @returns {string}
 */
function topicReceiptSurface(cwd, args) {
  const { workUnit, phase, topic, manifest } = resolveAddress(cwd, args.dotpath, 'topic-receipt');
  const verb = args.verb;
  const warn = args.warn === '1';
  if (verb === 'complete') {
    const item = itemOf(manifest, phase, topic);
    if (!item) throw new Error(`render topic-receipt: no ${phase} item "${topic}"`);
    if (item.status !== 'completed') {
      throw new Error(`render topic-receipt: "${topic}" is "${item.status}", not "completed" — the complete has not run`);
    }
    return topicReceipt(verb, topic, { warn });
  }
  if (verb === 'postpone') {
    assertDiscoveryUnitAddress(manifest, phase, topic, verb);
    if (computeTopicLifecycle(manifest, topic).lifecycle !== 'postponed') {
      throw new Error(`render topic-receipt: "${topic}" is not postponed — the postpone has not run`);
    }
    const waiting = postponedItem(loadProjectManifest(cwd), workUnit, topic);
    return topicReceipt(verb, topic, { warn, horizon: waiting ? waiting.horizon : null });
  }
  if (verb === 'restore') {
    assertDiscoveryUnitAddress(manifest, phase, topic, verb);
    if (computeTopicLifecycle(manifest, topic).lifecycle === 'postponed') {
      throw new Error(`render topic-receipt: "${topic}" is still postponed — the pull forward has not run`);
    }
    return topicReceipt(verb, topic, { warn, restored: unitStatuses(manifest, 'discovery', topic) });
  }
  if (verb !== 'cancel' && verb !== 'reactivate') {
    throw new Error(`render topic-receipt: --verb must be complete, cancel, reactivate, postpone, or restore, got "${verb}"`);
  }
  if (!(phase in UNIT_PHASES)) {
    throw new Error(`render topic-receipt: --verb ${verb} addresses a unit — <work_unit>.discovery.<topic> or <work_unit>.specification.<spec>, got phase "${phase}"`);
  }
  const stage = /** @type {'discovery'|'specification'} */ (phase);
  const cancelled = unitCancelled(manifest, stage, topic);
  if (verb === 'cancel') {
    if (!cancelled) throw new Error(`render topic-receipt: "${topic}" is not cancelled — the cancel has not run`);
    return topicReceipt(verb, topic, { warn });
  }
  if (cancelled) {
    throw new Error(`render topic-receipt: "${topic}" is still cancelled — the reactivate has not run`);
  }
  return topicReceipt(verb, topic, { warn, restored: unitStatuses(manifest, stage, topic) });
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
  const research = itemOf(manifest, 'research', workUnit);
  const series = itemOf(manifest, 'experiment', workUnit);
  const experiments = series && typeof series === 'object'
    ? Object.keys(series.experiments || {}).filter((id) => isParentExperimentId(id)).length
    : 0;
  return absorbSummary(workUnit, /** @type {string} */ (args.into), /** @type {string} */ (args.topic), {
    discussion: discussion.status,
    ...(research && typeof research === 'object' && typeof research.status === 'string' ? { research: research.status } : {}),
    experiments,
    seeds: Array.isArray(manifest.seeds) ? manifest.seeds.length : 0,
    imports: Array.isArray(manifest.imports) ? manifest.imports.length : 0,
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
  const unknown = moved.filter((m) => !['research', 'seeds', 'imports'].includes(m));
  if (unknown.length > 0) {
    throw new Error(`render absorb-receipt: --moved entries must be research, seeds, or imports, got "${unknown.join(', ')}"`);
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

/** @param {string} cwd @param {{dotpath: string, to?: string, imports?: string, warn?: string}} args @returns {string} */
function promoteReceiptSurface(cwd, args) {
  const { workUnit, phase, topic, manifest } = resolveAddress(cwd, args.dotpath, 'promote-receipt');
  if (phase !== 'specification') {
    throw new Error(`render promote-receipt: address must be <work_unit>.specification.<topic>, got phase "${phase}"`);
  }
  if (!args.to) throw new Error('render promote-receipt: --to is required');
  const item = itemOf(manifest, 'specification', topic);
  if (!item || item.status !== 'promoted') {
    throw new Error(`render promote-receipt: "${topic}" is not "promoted" — the promotion has not run`);
  }
  let imports = 0;
  if (args.imports !== undefined) {
    imports = Number(args.imports);
    if (!Number.isInteger(imports) || imports < 0) {
      throw new Error(`render promote-receipt: --imports must be a carried import count, got "${args.imports}"`);
    }
  }
  return promoteReceipt(workUnit, topic, args.to, { warn: args.warn === '1', imports });
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

/** @param {string} cwd @param {{dotpath: string, warn?: string}} args @returns {string} */
function sessionReceiptSurface(cwd, args) {
  resolveWorkUnit(cwd, args.dotpath, 'session-receipt');
  return sessionReceipt({ warn: args.warn === '1' });
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
  const cfg = workUnitTypeConfig(type);
  const { next_phase } = computeNextPhase(manifest);
  const phases = revisitablePhases(type, { next_phase, completed_phases: completedPhases(cfg, manifest) });
  if (phases.length === 0) {
    throw new Error(`render revisit-phases: "${workUnit}" has no completed earlier phase to revisit`);
  }
  return revisitPhasesSection(phases);
}

/** @param {string} cwd @param {{dotpath: string}} args @returns {string} */
function planTopics(cwd, args) {
  const { workUnit } = resolveWorkUnit(cwd, args.dotpath, 'plan-topics');
  const md = manageDetail(cwd, workUnit);
  if (!md) throw new Error(`render plan-topics: work unit "${workUnit}" not found`);
  if (!(md.work_type === 'epic' && md.has_plan && md.planning_topics.length > 1)) {
    throw new Error(`render plan-topics: "${workUnit}" has no multi-topic plan to choose from`);
  }
  return planTopicsMenu(md);
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
  return section('DISPLAY: roadmap', 'emit verbatim as a code block', roadmapMapView(state));
}

/** @param {string} cwd @param {Record<string, string|undefined>} args @returns {string} */
function roadmapAddGateSurface(cwd, args) {
  const state = roadmapState(cwd);
  if (!state.exists) {
    throw new Error('render roadmap-add-gate: no roadmap on the project manifest');
  }
  if (!args.horizon) throw new Error('render roadmap-add-gate: --horizon is required');
  if (!state.horizons.includes(args.horizon)) {
    throw new Error(`render roadmap-add-gate: unknown horizon "${args.horizon}"`);
  }
  return section(
    'MENU: roadmap add gate',
    "emit verbatim as markdown, then STOP for the user's response",
    roadmapAddGate(state, args.horizon),
  );
}

/** @param {string} cwd @param {object} _args @returns {string} */
function horizonPick(cwd, _args) {
  const state = roadmapState(cwd);
  if (!state.exists) {
    throw new Error('render horizon-pick: no roadmap on the project manifest — the caller names its first horizon in prose');
  }
  if (state.horizons.length === 0) {
    throw new Error('render horizon-pick: the roadmap holds no horizons — the caller names one in prose');
  }
  const options = state.horizons.map((horizon, i) => {
    const waiting = state.items.filter((r) => r.horizon === horizon && r.state === 'waiting').length;
    return cmdOption(String(i + 1), null, `${horizon} — *${waiting} waiting*`);
  });
  options.push(cmdOption('n', 'new', 'A new horizon — name it'));
  return section('MENU: horizon pick', STOP_FOR_RESPONSE, menu('Which horizon?', options));
}

/** @param {string} cwd @param {Record<string, string|undefined>} args @returns {string} */
function parkGate(cwd, args) {
  const { name, horizon, summary, source } = args;
  if (!isFilled(name)) throw new Error('render park-gate: --name is required');
  if (!isFilled(horizon)) throw new Error('render park-gate: --horizon is required');
  if (!isFilled(summary)) throw new Error('render park-gate: --summary is required');
  const state = roadmapState(cwd);
  if (state.items.some((r) => r.name === name)) {
    throw new Error(`render park-gate: "${name}" is already on the roadmap — edit it, or pick a different name`);
  }
  const isNew = state.exists && !state.horizons.includes(horizon);
  const statement = [
    `Parking **${titlecase(name)}** — ${summary} — puts it on the roadmap under "${horizon}"${isNew ? ' (new)' : ''}, waiting until it is pulled into work.`,
    ...(state.exists ? [] : ['The roadmap is created with it.']),
    ...(isFilled(source) ? [`Its source is \`${source}\`.`] : []),
  ].join(' ');
  return section('MENU: park gate', STOP_FOR_RESPONSE, menu(statement, [
    cmdOption('y', 'yes', 'Park it'),
    cmdOption('n', 'no', 'Leave it — nothing is recorded'),
    promptOption('Comment', 'Tell me what to change (name, horizon, or summary)'),
  ], { question: 'Park it on the roadmap?' }));
}

/** @param {string} _cwd @param {Record<string, string|undefined>} args @returns {string} */
function roadmapSessionReceiptSurface(_cwd, args) {
  return sessionReceipt({ warn: args.warn === '1' });
}

// The static roadmap gate menus — no state to resolve; served as surfaces
// because every menu is engine-rendered, fetched at the point it displays.
const STOP_FOR_RESPONSE = "emit verbatim as markdown, then STOP for the user's response";

/** @param {string} _cwd @param {object} _args @returns {string} */
function roadmapHarvestGateSurface(_cwd, _args) {
  return section('MENU: roadmap harvest gate', STOP_FOR_RESPONSE, roadmapHarvestGate());
}

/** @param {string} _cwd @param {object} _args @returns {string} */
function roadmapParksGateSurface(_cwd, _args) {
  return section('MENU: roadmap parks gate', STOP_FOR_RESPONSE, roadmapParksGate());
}

/** @param {string} _cwd @param {object} _args @returns {string} */
function roadmapShapeGateSurface(_cwd, _args) {
  return section('MENU: roadmap shape gate', STOP_FOR_RESPONSE, roadmapShapeGate());
}

// The cross-flow static gates — adopted engine-side as their files were
// touched (menus are engine-rendered, static sets included). Wording is
// the gates' own; each is fetched at the exact point it displays.

/** Discovery's work-type commit confirm — the shaping conversation's hinge. @param {string} _cwd @param {object} _args @returns {string} */
function shapeGateSurface(_cwd, _args) {
  return section('MENU: shape gate', STOP_FOR_RESPONSE, menu('', [
    cmdOption('y', 'yes', "That's the right shape, set it up"),
    cmdOption('o', 'other', "It's something else (tell me what)"),
    promptOption('Keep shaping', "Tell me what I'm missing"),
  ], { question: 'Have I read this right?' }));
}

/** The epic synthesis' topic sort confirm. @param {string} _cwd @param {object} _args @returns {string} */
function synthesisGateSurface(_cwd, _args) {
  return section('MENU: synthesis gate', STOP_FOR_RESPONSE, menu('', [
    cmdOption('y', 'yes', 'Commit these topics and conclude'),
    cmdOption('e', 'explore', 'Go back to exploration; not ready to commit yet'),
    promptOption('Adjust', 'Tell me what to change (split, merge, rename, re-route, edit summary)'),
  ], { question: 'Commit these topics?' }));
}

/** The knowledge query-failure gate — retry or proceed without context. @param {string} _cwd @param {object} _args @returns {string} */
function queryFailureGateSurface(_cwd, _args) {
  return section('MENU: query failure gate', STOP_FOR_RESPONSE, menu('', [
    cmdOption('r', 'retry', "I'll fix the issue; retry the query"),
    cmdOption('s', 'skip', 'Proceed without knowledge context for this phase'),
  ], { question: 'How should I proceed?' }));
}

// The legacy research split's dialog gates, keyed by what each asks: themes
// = the candidate theme list's early sanity gate, plan = the drafted plan's
// apply consent, remove = the destructive theme-removal confirm.
/** @type {Record<string, {question: string, options: string[]}>} */
const LEGACY_SPLIT_GATES = {
  themes: {
    question: 'Proceed with these themes?',
    options: [
      cmdOption('y', 'yes', 'Proceed to draft cache files'),
      cmdOption('a', 'abandon', 'Skip this source file'),
      promptOption('Redirect', 'Adjust the theme list (rename, merge two, split one, add, remove)'),
    ],
  },
  plan: {
    question: 'Apply this plan?',
    options: [
      cmdOption('y', 'yes', 'Apply this plan'),
      cmdOption('a', 'abandon', 'Skip this source file'),
      promptOption('Edit', 'Modify cache files or plan.json (rename, merge, split, add, remove). To rewrite a draft, edit the cache file directly between renders.'),
    ],
  },
  remove: {
    question: 'Remove the theme?',
    options: [
      cmdOption('y', 'yes', 'Remove the theme and drop its content'),
      cmdOption('n', 'no', 'Back out'),
    ],
  },
};

const LEGACY_SPLIT_GATE_VARIANTS = Object.keys(LEGACY_SPLIT_GATES);

/** One of the legacy split dialog's gates. @param {string} _cwd @param {Record<string, string|undefined>} args @returns {string} */
function legacySplitGateSurface(_cwd, { variant }) {
  if (variant === undefined || !LEGACY_SPLIT_GATE_VARIANTS.includes(variant)) {
    throw new Error(`render legacy-split-gate: --variant must be one of ${LEGACY_SPLIT_GATE_VARIANTS.join(', ')}, got "${variant ?? ''}"`);
  }
  const gate = LEGACY_SPLIT_GATES[variant];
  return section(`MENU: legacy split ${variant} gate`, STOP_FOR_RESPONSE, menu('', gate.options, { question: gate.question }));
}

// The legacy research split's dialog displays, keyed by what each shows:
// candidates = the theme list at the early sanity gate (a batch worklist,
// summary beneath each name), plan = the drafted plan (each theme's summary,
// drafted content, and cache path as a tree, then the rename apply makes —
// its stamp is minted at apply, so the footer names the slot), errors =
// validate.cjs's refusals as bullets. Names, summaries, counts, previews,
// and the validator's lines are judgment content and ride the payload; the
// cache layout is the engine's.
/** @type {Record<string, string[]>} */
const LEGACY_SPLIT_THEME_FIELDS = {
  candidates: ['kebab_name', 'summary'],
  plan: ['kebab_name', 'summary', 'content_preview'],
};
const LEGACY_SPLIT_DISPLAY_VARIANTS = [...Object.keys(LEGACY_SPLIT_THEME_FIELDS), 'errors'];

/** One of the legacy split dialog's displays. @param {string} cwd @param {Record<string, string|undefined>} args @returns {string} */
function legacySplitDisplaySurface(cwd, { variant, file }) {
  if (variant === undefined || !LEGACY_SPLIT_DISPLAY_VARIANTS.includes(variant)) {
    throw new Error(`render legacy-split-display: --variant must be one of ${LEGACY_SPLIT_DISPLAY_VARIANTS.join(', ')}, got "${variant ?? ''}"`);
  }
  if (!file) throw new Error('render legacy-split-display: --file <payload.json> is required');
  const p = readJsonPayload(cwd, file, 'legacy-split-display');
  if (!isFilled(p.source)) throw new Error('render legacy-split-display: "source" must be a non-empty string');

  if (variant === 'errors') {
    if (!Array.isArray(p.errors) || p.errors.length === 0) {
      throw new Error('render legacy-split-display: "errors" must be a non-empty array of strings');
    }
    p.errors.forEach((e, i) => {
      if (!isFilled(e)) throw new Error(`render legacy-split-display: errors[${i}] must be a non-empty string`);
    });
    const body = [`Validation failed for ${p.source}:`, '', ...p.errors.flatMap((e) => bulletRow(e))];
    return section('DISPLAY: legacy split errors', CONTINUE_INSTRUCTION, body.join('\n'));
  }

  const fields = LEGACY_SPLIT_THEME_FIELDS[variant];
  if (variant === 'plan' && !isFilled(p.work_unit)) {
    throw new Error('render legacy-split-display: "work_unit" must be a non-empty string');
  }
  if (!Array.isArray(p.themes) || p.themes.length === 0) {
    throw new Error(`render legacy-split-display: "themes" must be a non-empty array of {${[...fields, ...(variant === 'plan' ? ['paragraph_count'] : [])].join(', ')}}`);
  }
  p.themes.forEach((t, i) => {
    for (const field of fields) {
      if (!isFilled(t[field])) throw new Error(`render legacy-split-display: theme ${i + 1} is missing "${field}"`);
    }
    if (variant === 'plan' && (!Number.isInteger(t.paragraph_count) || t.paragraph_count < 0)) {
      throw new Error(`render legacy-split-display: theme ${i + 1} "paragraph_count" must be a non-negative integer`);
    }
  });

  if (variant === 'candidates') {
    const body = worklist({
      intro: `Candidate themes for ${p.source}.md:`,
      items: p.themes.map((t) => ({ title: t.kebab_name, note: t.summary })),
    });
    return section('DISPLAY: legacy split candidates', CONTINUE_MARKDOWN_INSTRUCTION, body);
  }

  const lines = [`Plan for ${p.source}.md:`, ''];
  p.themes.forEach((t, i) => {
    lines.push(`${i + 1}. ${t.kebab_name}`);
    lines.push(treeList([
      `Summary: ${t.summary}`,
      `Content: ${t.paragraph_count} para(s) — "${t.content_preview}..."`,
      `Cache: .workflows/.cache/${p.work_unit}/legacy-split/${p.source}/${t.kebab_name}.md`,
    ], { indent: '   ' }));
    lines.push('');
  });
  lines.push(`Source file will be renamed to ${p.source}-superseded-<datetime>.md.`);
  return section('DISPLAY: legacy split plan', CONTINUE_INSTRUCTION, lines.join('\n'));
}

// ---------------------------------------------------------------------------
// The baseline surfaces — project-level, no address. Each handler resolves
// the one BaselineState (domain/baseline.cjs), refuses states the calling
// prose never reaches, and hands the pure projection its detail.
// ---------------------------------------------------------------------------

/** Resolve baseline state, refusing the never-started states — nothing recorded, or a native verdict. @param {string} cwd @param {string} surface */
function resolveBaseline(cwd, surface) {
  const d = baselineState(cwd);
  if (d.status === 'none' || d.status === 'native') {
    throw new Error(`render ${surface}: the baseline is "${d.status}" — no assessment has been started`);
  }
  return d;
}

/** @param {string} cwd @param {object} _args @returns {string} */
function baselineProgressSurface(cwd, _args) {
  const d = resolveBaseline(cwd, 'baseline-progress');
  if (d.areas.length === 0) {
    throw new Error('render baseline-progress: the baseline has no areas');
  }
  return baselineProgress(d);
}

/** @param {string} cwd @param {Record<string, string|undefined>} args @returns {string} */
function baselineAreaGateSurface(cwd, { area }) {
  const d = resolveBaseline(cwd, 'baseline-area-gate');
  if (!area) throw new Error('render baseline-area-gate: --area is required');
  const entry = d.areas.find((a) => a.name === area);
  if (!entry) throw new Error(`render baseline-area-gate: unknown area "${area}"`);
  if (entry.status !== 'completed') {
    throw new Error(`render baseline-area-gate: area "${area}" is "${entry.status}", not completed — the gate follows the doc landing`);
  }
  if (d.remaining === 0) {
    throw new Error('render baseline-area-gate: no areas remain — the flow concludes instead of gating');
  }
  return baselineAreaGate(d, area);
}

/** @param {string} cwd @param {object} _args @returns {string} */
function baselinePausedSurface(cwd, _args) {
  const d = resolveBaseline(cwd, 'baseline-paused');
  if (d.status !== 'in-progress') {
    throw new Error(`render baseline-paused: the baseline is "${d.status}", not in-progress`);
  }
  return baselinePaused(d);
}

/** @param {string} cwd @param {object} _args @returns {string} */
function baselineReceiptSurface(cwd, _args) {
  const d = resolveBaseline(cwd, 'baseline-receipt');
  if (d.status !== 'completed') {
    throw new Error(`render baseline-receipt: the baseline is "${d.status}", not completed — the receipt follows the completion write`);
  }
  const unlanded = d.areas.filter((a) => a.status !== 'completed');
  if (unlanded.length > 0) {
    throw new Error(`render baseline-receipt: area "${unlanded[0].name}" is "${unlanded[0].status}", not completed — a receipt never names a doc that was not landed`);
  }
  return baselineReceipt(d);
}

// An area name doubles as the doc's knowledge-base identity — kebab-case,
// dot- and slash-free, enforced where the proposal is rendered so an illegal
// name never survives to the interview.
const AREA_NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Read + validate a `--file` JSON payload. @param {string} cwd @param {string} surface @param {string|undefined} file @returns {any} */
function readBaselinePayload(cwd, surface, file) {
  if (!file) throw new Error(`render ${surface}: --file <payload.json> is required`);
  let raw;
  try {
    raw = fs.readFileSync(path.resolve(cwd, file), 'utf8');
  } catch {
    throw new Error(`render ${surface}: payload file not found: ${file}`);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`render ${surface}: payload is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** @param {string} cwd @param {Record<string, string|undefined>} args @returns {string} */
function baselineScopeGateSurface(cwd, { file }) {
  const payload = readBaselinePayload(cwd, 'baseline-scope-gate', file);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('render baseline-scope-gate: payload must be an object {mode, areas}');
  }
  if (payload.mode !== 'fresh' && payload.mode !== 'expand') {
    throw new Error('render baseline-scope-gate: "mode" must be "fresh" or "expand"');
  }
  if (!Array.isArray(payload.areas) || payload.areas.length === 0) {
    throw new Error('render baseline-scope-gate: "areas" must be a non-empty array of {name, detail}');
  }
  for (const [i, a] of payload.areas.entries()) {
    if (!a || typeof a.name !== 'string' || !AREA_NAME_RE.test(a.name)) {
      throw new Error(`render baseline-scope-gate: area ${i + 1} "name" must be kebab-case (dot- and slash-free — it is the doc's knowledge-base identity)`);
    }
    if (typeof a.detail !== 'string' || a.detail.trim() === '') {
      throw new Error(`render baseline-scope-gate: area ${i + 1} ("${a.name}") is missing "detail" — one line on what it covers`);
    }
  }
  return baselineScopeGate(payload);
}

/** @param {string} cwd @param {Record<string, string|undefined>} args @returns {string} */
function baselineRoundSurface(cwd, { file }) {
  const payload = readBaselinePayload(cwd, 'baseline-round', file);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('render baseline-round: payload must be an object {area, questions}');
  }
  const d = resolveBaseline(cwd, 'baseline-round');
  const entry = d.areas.find((a) => a.name === payload.area);
  if (!entry) throw new Error(`render baseline-round: unknown area "${payload.area}"`);
  if (entry.status !== 'researched') {
    throw new Error(`render baseline-round: area "${payload.area}" is "${entry.status}", not researched — rounds walk a researched area's agenda`);
  }
  if (!Array.isArray(payload.questions) || payload.questions.length === 0 || payload.questions.length > 4) {
    throw new Error('render baseline-round: "questions" must be an array of 1-4 {text, candidates?}');
  }
  for (const [i, q] of payload.questions.entries()) {
    if (!q || typeof q.text !== 'string' || q.text.trim() === '') {
      throw new Error(`render baseline-round: question ${i + 1} is missing "text"`);
    }
    if (q.candidates !== undefined && (!Array.isArray(q.candidates) || q.candidates.length > 4 || q.candidates.some((c) => typeof c !== 'string' || c.trim() === ''))) {
      throw new Error(`render baseline-round: question ${i + 1} "candidates" must be up to 4 non-empty strings when present`);
    }
  }
  return baselineRound(payload);
}

/** @param {string} _cwd @param {object} _args @returns {string} */
function baselineDocGateSurface(_cwd, _args) {
  return baselineDocGate();
}

/** @param {string} cwd @param {object} _args @returns {string} */
function baselineManageGateSurface(cwd, _args) {
  const d = resolveBaseline(cwd, 'baseline-manage-gate');
  if (d.status !== 'completed') {
    throw new Error(`render baseline-manage-gate: the baseline is "${d.status}", not completed — manage serves a completed assessment`);
  }
  return baselineManageGate();
}

/** The one-time offer gate — only while nothing is recorded; a native verdict is recorded state and refuses here. @param {string} cwd @param {object} _args @returns {string} */
function baselineOfferGateSurface(cwd, _args) {
  const d = baselineState(cwd);
  if (d.status !== 'none') {
    throw new Error(`render baseline-offer-gate: the baseline is "${d.status}" — the offer fires once, before anything is recorded`);
  }
  return baselineOfferGate();
}

/** @param {string} cwd @param {object} _args @returns {string} */
function baselineDocPickSurface(cwd, _args) {
  const d = resolveBaseline(cwd, 'baseline-doc-pick');
  if (d.status !== 'completed') {
    throw new Error(`render baseline-doc-pick: the baseline is "${d.status}", not completed`);
  }
  return baselineDocPick(d);
}

// ---------------------------------------------------------------------------
// The walkthrough surfaces — project-level, no address, no state. A screen is
// a content file, so the only things to resolve are which screen and where
// the walk was entered from; the recorded answer drives the offer alone, and
// no surface reads it.
// ---------------------------------------------------------------------------

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
 * gives for the number the reader pressed. `--menu-only` serves the return
 * from a question, as it does on a screen.
 * @param {string} _cwd @param {Record<string, string|undefined>} args @returns {string}
 */
function walkthroughTopicSurface(_cwd, args) {
  return walkthroughTopic(loadCard(args.name), Boolean(args['menu-only']));
}

/**
 * workflow-start's knowledge gate menus. `--provider` and `--model` belong to
 * the reuse variant alone — the system configuration its yes row names. A
 * provider stands without a model (the provider defaults it); a model
 * without a provider names nothing.
 * @param {string} _cwd @param {Record<string, string|undefined>} args @returns {string}
 */
function knowledgeGateSurface(_cwd, { variant, provider, model }) {
  if (variant === undefined || !KNOWLEDGE_GATE_VARIANTS.includes(variant)) {
    throw new Error(`render knowledge-gate: --variant must be one of ${KNOWLEDGE_GATE_VARIANTS.join(', ')}, got "${variant ?? ''}"`);
  }
  if (variant !== 'reuse' && (provider !== undefined || model !== undefined)) {
    throw new Error(`render knowledge-gate: --provider/--model belong to the reuse variant — the ${variant} variant names no configuration`);
  }
  if (isFilled(model) && !isFilled(provider)) {
    throw new Error('render knowledge-gate: --model names nothing without --provider — the provider is the configuration, the model rides with it');
  }
  return knowledgeGate(variant, { provider, model });
}

/** The catalogue: surface name → handler. @type {Record<string, (cwd: string, args: {dotpath: string} & Record<string, string|undefined>) => string>} */
const SURFACES = {
  'resume-gate': resumeGate,
  'task-list': taskList,
  'findings-summary': findingsSummary,
  'finding-announce': findingAnnounce,
  'finding-batch': findingBatch,
  'finding': finding,
  'review-presentation': reviewPresentation,
  'review-gate': reviewGate,
  'spec-review-gate': specReviewGate,
  'spec-completion-gate': specCompletionGate,
  'convergence-diagnostic': convergenceDiagnostic,
  'carry-note-gate': carryNoteGate,
  'hypothesis-board': hypothesisBoard,
  'findings-signoff-gate': findingsSignoffGate,
  'fix-direction': fixDirection,
  'validation-gate': validationGate,
  'validation-report': validationReport,
  'project-skills': projectSkills,
  'linters': linters,
  'triage-announce': triageAnnounce,
  'triage-offer': triageOffer,
  'triage-block': triageBlock,
  'requeue-offer': requeueOffer,
  'reroute-offer': rerouteOffer,
  'research-threads': researchThreadsSurface,
  'research-conclude-gate': researchConcludeGate,
  'deep-dive-offer': deepDiveOffer,
  'perspective-offer': perspectiveOffer,
  'in-flight-agents-gate': inFlightAgentsGate,
  'review-findings-gate': reviewFindingsGate,
  'reroute-candidates': rerouteCandidates,
  'off-topic-offer': offTopicOffer,
  'backlog-gate': backlogGate,
  'map-op-gate': mapOpGate,
  'candidate-gate': candidateGate,
  'dismissed-topics': dismissedTopics,
  'triage-closed-target': triageClosedTarget,
  'conclude-gate': concludeGate,
  'closing-gate': closingGate,
  'experiment-register': experimentRegisterSurface,
  'experiment-approval-gate': experimentApprovalGateSurface,
  'experiment-pick': experimentPickSurface,
  'experiment-next-gate': experimentNextGateSurface,
  'experiment-spawn-gate': experimentSpawnGateSurface,
  'wait-gate': waitGateSurface,
  'summary-backfill-gate': summaryBackfillGate,
  'external-dependency-gate': externalDependencyGate,
  'checkpoint-files-gate': checkpointFilesGate,
  'executor-block-gate': executorBlockGate,
  'dependency-approval-gate': dependencyApprovalGate,
  'task-count-gate': taskCountGate,
  'plan-context-gate': planContextGate,
  'cross-cutting-gate': crossCuttingGate,
  'cross-cutting-references': crossCuttingReferences,
  'plan-format-gate': planFormatGate,
  'plan-review-gate': planReviewGate,
  'complexity-gate': complexityGate,
  'first-phase-gate': firstPhaseGate,
  'correction-gate': correctionGate,
  'analysis-proceed-gate': analysisProceedGate,
  'spec-confirm-gate': specConfirmGate,
  'proposed-task': proposedTask,
  'incoherence-gate': incoherenceGate,
  'resurface-gate': resurfaceGate,
  'construction-gate': constructionGate,
  'tasks-overview': tasksOverview,
  'author-task-gate': authorTaskGate,
  'phase-tree': phaseTree,
  'phase-completed': phaseCompleted,
  'phase-paused': phasePausedSurface,
  'phase-note': phaseNote,
  'entry-gate': entryGate,
  'direct-entry-gate': directEntryGate,
  'code-gate': codeGate,
  'next-phase-gate': nextPhaseGate,
  'cancel-gate': cancelGate,
  'postpone-gate': postponeGate,
  'epic-all-done-gate': epicAllDoneGate,
  'epic-soft-gate': epicSoftGate,
  'task-brief': taskBrief,
  'task-result': taskResult,
  'task-gate': taskGate,
  'fix-gate': fixGate,
  'blocked-tasks': blockedTasks,
  'cycle-limit': cycleLimit,
  'spec-corrections': specCorrections,
  'cycle-gate': cycleGate,
  'workunit-receipt': workunitReceiptSurface,
  'topic-receipt': topicReceiptSurface,
  'absorb-summary': absorbSummarySurface,
  'absorb-receipt': absorbReceiptSurface,
  'absorb-continuation': absorbContinuationSurface,
  'promote-receipt': promoteReceiptSurface,
  'import-reprompt': importRepromptSurface,
  'pivot-continuation': pivotContinuation,
  'session-receipt': sessionReceiptSurface,
  'absorb-target': absorbTarget,
  'absorb-confirm-gate': absorbConfirmGateSurface,
  'plan-topics': planTopics,
  'archived-actions': archivedActionsSurface,
  'archived-delete-gate': archivedDeleteGateSurface,
  'completed-actions': completedActionsSurface,
  'revisit-phases': revisitPhasesSurface,
  'roadmap-view': roadmapViewSurface,
  'roadmap-add-gate': roadmapAddGateSurface,
  'horizon-pick': horizonPick,
  'park-gate': parkGate,
  'roadmap-session-receipt': roadmapSessionReceiptSurface,
  'roadmap-harvest-gate': roadmapHarvestGateSurface,
  'roadmap-parks-gate': roadmapParksGateSurface,
  'roadmap-shape-gate': roadmapShapeGateSurface,
  'shape-gate': shapeGateSurface,
  'synthesis-gate': synthesisGateSurface,
  'query-failure-gate': queryFailureGateSurface,
  'baseline-progress': baselineProgressSurface,
  'baseline-area-gate': baselineAreaGateSurface,
  'baseline-paused': baselinePausedSurface,
  'baseline-receipt': baselineReceiptSurface,
  'baseline-scope-gate': baselineScopeGateSurface,
  'baseline-round': baselineRoundSurface,
  'baseline-doc-gate': baselineDocGateSurface,
  'baseline-manage-gate': baselineManageGateSurface,
  'baseline-doc-pick': baselineDocPickSurface,
  'baseline-offer-gate': baselineOfferGateSurface,
  'walkthrough-screen': walkthroughScreenSurface,
  'walkthrough-home': walkthroughHomeSurface,
  'walkthrough-topics': walkthroughTopicsSurface,
  'walkthrough-topic': walkthroughTopicSurface,
  'migration-gate': () => migrationGate(),
  'label-gate': () => labelGate(),
  'knowledge-gate': knowledgeGateSurface,
  'legacy-split-gate': legacySplitGateSurface,
  'legacy-split-display': legacySplitDisplaySurface,
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
