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
const { loadManifest, loadProjectManifest } = require('./reads.cjs');
const { titlecase, WORKLIST_GLYPH, DISCOVERY_GLYPH, discoveryLifecycleLabel } = require('./conventions.cjs');
const { section, CONTINUE_INSTRUCTION, CONTINUE_MARKDOWN_INSTRUCTION, AUTO_GATE_INSTRUCTION, menu, menuFrame, MENU_GLYPH, cmdOption, bareOption, promptOption, callout, indentedBody, bulletRow, subDetail, treeList } = require('./projections/surfaces.cjs');
const { buildOrderLive } = require('./build-order.cjs');
const { worklist, escapeMarkdown } = require('./projections/worklist.cjs');
const { blockedTasksMenu, taskGateSection, fixGateSection, cycleLimitDisplay, cycleGateMenu } = require('./projections/tasks.cjs');
const { workunitReceipt, topicReceipt, absorbReceipt, promoteReceipt, pivotContinuationMenu, sessionReceipt } = require('./projections/transactions.cjs');
const { absorbTargetMenu, planTopicsMenu } = require('./projections/start.cjs');
const {
  baselineProgress, baselineAreaGate, baselinePaused, baselineReceipt,
  baselineScopeGate, baselineRound, baselineDocGate, baselineManageGate, baselineDocPick,
  baselineOfferGate,
} = require('./projections/baseline.cjs');
const { baselineState } = require('./baseline.cjs');
const { heldCodeSessions, beatQuietly, fmtAge, CODE_PHASES } = require('./presence.cjs');
const { roadmapState } = require('./roadmap.cjs');
const {
  roadmapMapView,
  roadmapAddGate,
  roadmapHarvestGate,
  roadmapParksGate,
  roadmapShapeGate,
  roadmapConcludeGate,
} = require('./projections/roadmap.cjs');
const { revisitablePhases, revisitPhasesSection } = require('./projections/workunit.cjs');
const { WORK_UNIT_TYPES, typeConfig: workUnitTypeConfig, completedPhases } = require('./workunit-detail.cjs');
const { phaseItems, computeNextPhase, computeTopicLifecycle } = require('./derivations.cjs');
const { manageDetail } = require('./workunit-manage.cjs');
const { gateOf, counterOf, FIX_THRESHOLD, SESSION_CYCLE_LIMIT } = require('./tasks.cjs');
const { sourceRows } = require('./transitions.cjs');

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
      ));
    }
    const label = `Found existing review for **${t}**.` + (reviewed !== null ? `\nAll ${completed} tasks have been reviewed.` : '');
    return section('MENU: resume gate', RESUME_MENU_INSTRUCTION, menu(label, [
      cmdOption('c', 'continue', 'Continue from current review state'),
      cmdOption('r', 'restart', 'Delete review, start fresh'),
    ]));
  }
  if (variant === 'scoping') {
    return section('MENU: resume gate', RESUME_MENU_INSTRUCTION, menu(
      `Found completed scoping for **${t}** — spec and plan are in place.`,
      [
        cmdOption('c', 'continue', 'Adjust the existing spec and plan'),
        cmdOption('r', 'restart', 'Erase the spec, plan, and task files, then rescope from scratch'),
      ],
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
    ]),
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
// adds the Do/Acceptance Criteria/Tests blocks. Judging comes before
// authoring, and detail that doesn't exist yet can't be rendered.
// A proposal carrying an open decision renders the question and its stakes
// as the body's last lines and the sides as its menu under a fixed engine
// question — the conflict-menu idiom: model-authored text never enters the
// glyphed chrome. A decision is an irreducible product fork — never a
// technical call an investigation would settle — and the required "stakes"
// (a top-level field beside "decision", never nested inside it) is the
// payload's argument for the stop: each side's product consequence, why no
// investigation settles the tie, and — where a side is marked — the grounds
// for the recommendation. The menu fires at either gate mode, by design: a
// bare `y` would hand the call to the executor, and auto never settles an
// irreducible product fork — a decision item always stops, and over an
// auto opt-in it says so. A decision excludes the authored blocks: the
// direction is settled before bodies exist. A side may mark itself
// recommended (at most one); it orders first with a "(recommended)"
// suffix — the findingChoice idiom.
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
  for (const field of ['steps', 'criteria', 'tests']) {
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
    if (blocks.steps || blocks.criteria || blocks.tests) {
      throw new Error('render proposed-task: "decision" excludes steps/criteria/tests — the direction is settled before bodies are authored');
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
    '',
    `**Problem**: ${p.problem}`,
    `**Solution**: ${p.solution}`,
  ];
  if (isFilled(p.outcome)) body.push(`**Outcome**: ${p.outcome}`);
  if (p.decision) body.push(`**Decision**: ${p.decision.question}`, `**Stakes**: ${p.stakes}`);
  for (const [field, heading] of [['steps', 'Do'], ['criteria', 'Acceptance Criteria'], ['tests', 'Tests']]) {
    if (!blocks[field]) continue;
    body.push('', `**${heading}**:`, ...blocks[field]);
  }
  const parts = [section('DISPLAY: proposed task', 'emit verbatim as markdown', body.join('\n'))];

  const hint = isFilled(args['comment-hint']) ? args['comment-hint'] : 'Tell me what to change';
  if (p.decision) {
    parts.push(section(
      'MENU: task decision',
      STOP_FOR_RESPONSE,
      menu(gate === 'auto' ? AUTO_OVERRIDE_LINE : '', [
        ...decisionRows,
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
      cmdOption('p', 'proceed', 'Continue review'),
      cmdOption('s', 'skip', 'Skip review, proceed to completion'),
    ], { question: 'Continue with review?' }));
  }
  return section('MENU: spec review reloop gate', STOP_FOR_RESPONSE, menu('', [
    cmdOption('r', 'reanalyse', 'Run another review cycle (all three phases)'),
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
  churning: 'Findings resolve but are replaced at the same rate — the edits are likely generating new findings. Consider consolidating duplicated statements rather than running another cycle.',
  converging: 'Continuing is likely to resolve remaining items.',
  stable: 'Same issues are cycling. Consider manual intervention on the recurring items.',
  diverging: 'Fixes are introducing new issues. Consider reviewing the approach.',
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
    if (p.loop_type !== 'spec-review') {
      throw new Error('render convergence-diagnostic: document growth belongs to spec-review — omit the word counts');
    }
    if (!Number.isInteger(p.review_baseline_words) || !Number.isInteger(p.live_words) || p.review_baseline_words < 0 || p.live_words < 0) {
      throw new Error('render convergence-diagnostic: "review_baseline_words" and "live_words" travel together as non-negative integers');
    }
  }

  const growth = hasGrowth ? p.live_words - p.review_baseline_words : 0;
  const head = [
    `${CONVERGENCE_LOOPS[p.loop_type]} — cycle ${p.latest_cycle} diagnostic`,
    '',
    `  Trend: ${p.trend}`,
    `  Latest cycle: ${fresh.length + recurring.length} findings (${fresh.length} new, ${recurring.length} recurring)`,
  ];
  if (multi) head.push(`  Per stream: ${p.stream_counts.map((st) => `${st.label} ${st.count}`).join(' · ')}`);
  if (hasGrowth) head.push(`  Document growth: ${p.review_baseline_words} → ${p.live_words} words (${growth >= 0 ? `+${growth}` : growth} net across review)`);

  const parts = [head.join('\n')];
  if (resolved.length > 0) {
    parts.push(['  Resolved:', ...resolved.map((f) => `    • ${f.title} (fixed in cycle ${f.last_seen_cycle})`)].join('\n'));
  }
  if (recurring.length > 0) {
    parts.push(['  Recurring:', ...recurring.map((f) => `    • ${f.title} (cycles ${f.cycles})\n      ${f.hypothesis}`)].join('\n'));
  }
  if (fresh.length > 0) {
    parts.push(['  New this cycle:', ...fresh.map((f) => `    • ${f.title}`)].join('\n'));
  }

  const flags = [callout(CONVERGENCE_TRENDS[p.trend])];
  if (p.loop_type === 'spec-review' && p.trend === 'churning' && growth > 0) {
    flags.push(callout('The cycles are adding words while findings churn — later reviews are reviewing earlier reviews\' writing, a shape the review rules forbid: findings add missing source content or remove wrong content, never rework sound ground. Check the recent additions against the sources before running another cycle.'));
  }
  if (hasGrowth && growth > p.review_baseline_words / 4) {
    flags.push(callout(`Review has added ${growth} words to a ${p.review_baseline_words}-word construction. Growth that traces to source material is the loop working; check that these additions do — additions from nowhere mean the loop is feeding on itself.`));
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
//   gap-route — the gap raise plus its acknowledgement gate: the menu states
//               the routing intent and confirms it (no "no" — an objection
//               arrives as Comment and drops into the settleable exchange)
//   held-doc  — the fallback when a live session holds the owning document
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
  const { phase, topic, manifest } = resolveAddress(cwd, dotpath, 'incoherence-gate');
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
    return [
      section('DISPLAY: incoherence gap', 'emit verbatim as markdown', body.join('\n')),
      section('MENU: incoherence gap', INCOHERENCE_STOP, menu(
        `${overAuto ? `${AUTO_OVERRIDE_LINE}\n\n` : ''}Routing this to "${p.doc}" — it reopens with the gap, and this specification pauses until the answer lands.`,
        [
          cmdOption('y', 'yes', 'Land the gap and pause here'),
          promptOption('Comment', 'Tell me what you\'re thinking before it moves'),
        ],
        { question: 'Proceed?' },
      )),
    ].join('\n');
  }
  return section('MENU: incoherence held doc', INCOHERENCE_STOP, menu(
    `${overAuto ? `${AUTO_OVERRIDE_LINE}\n\n` : ''}"${p.doc}" is open in another session right now, so the fix belongs there — this topic waits for it.`,
    [
      cmdOption('n', 'next', 'Queue the resolution and carry on here'),
      cmdOption('s', 'stop', 'Stop here; re-enter after that session lands it'),
    ],
    { question: 'How do you want to continue?' },
  ));
}

// ---------------------------------------------------------------------------
// cancel-cascade-gate — the collapse confirm `topic cancel`'s refusal routes
// to: a live specification is built from the topic being cancelled, so the
// cascade takes both. No payload — the collapse set is manifest state (the
// same reverse join the refusal ran): started specs cancel with the topic
// (reactivatable), proposed groupings are discarded. Always gated.
// ---------------------------------------------------------------------------

/**
 * @param {string} cwd
 * @param {{dotpath: string}} args
 * @returns {string}
 */
function cancelCascadeGate(cwd, { dotpath }) {
  const { topic, manifest } = resolveAddress(cwd, dotpath, 'cancel-cascade-gate');
  const specItems = ((manifest.phases || {}).specification || {}).items || {};
  const collapses = Object.entries(specItems).filter(([, s]) =>
    s && typeof s === 'object' && !['cancelled', 'superseded', 'promoted'].includes(s.status)
    && sourceRows(s.sources).some(([n]) => n === topic));
  if (collapses.length === 0) {
    throw new Error(`render cancel-cascade-gate: no live specification sources "${topic}" — the bare cancel proceeds`);
  }
  const started = collapses.filter(([, s]) => s.status !== 'proposed').map(([n]) => titlecase(n));
  const proposed = collapses.filter(([, s]) => s.status === 'proposed').map(([n]) => titlecase(n));
  const parts = [];
  if (started.length > 0) parts.push(`**${started.join('**, **')}** is cancelled with it (reactivatable)`);
  if (proposed.length > 0) parts.push(`the proposed grouping **${proposed.join('**, **')}** is discarded — the next grouping analysis rebuilds from the new world`);
  const statement = `Cancelling **${titlecase(topic)}** collapses the specification work built from it: ${parts.join('; ')}.`;
  return section('MENU: cancel cascade', "emit verbatim as markdown, then STOP for the user's response", menu(
    statement,
    [
      cmdOption('y', 'yes', 'Cancel the topic and the specification work it sources'),
      cmdOption('n', 'no', 'Return to menu'),
    ],
    { question: 'Cancel them together?' },
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
    ]),
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
 * as its suffix.
 * @param {{summary: string, recommended?: boolean}[]} sides @param {string} atMostOne
 * @returns {string[]}
 */
function recommendedMenuRows(sides, atMostOne) {
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
// that failed the review and must be planned. Corrections are a count —
// they are already made, gated by the suite and verified, so a list would
// put pages nobody reads in front of the one decision that matters. The
// judgment (which items, worded how) rides as the payload; the shape is
// this surface's rule, so it cannot drift per verdict or per author.

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
    section('TITLE', "emit verbatim as markdown — the view's chrome heading", `# **\`■ Review — ${title}\`**`),
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
    tail.push(`Outside this spec: ${n} finding${n === 1 ? '' : 's'} held for your call.`);
  }
  if (Number(p.discarded) > 0) {
    tail.push(`Discarded: ${p.discarded} — reasons in the report.`);
  }
  if (tail.length) body.push(tail.join('\n'));
  if (body.length) {
    sections.push(section('DISPLAY: review findings', CONTINUE_MARKDOWN_INSTRUCTION, body.join('\n\n')));
  }
  return sections.join('\n');
}

// review-gate — the review's closing menu. Membership follows the verdict
// and what remains: a fail routes to planning and nothing else (out-of-scope
// findings are future work, and future work is not offered while the review
// is failing); a pass completes, with the out-of-scope decision offered only
// when such findings exist. The option set varies at runtime, so the column
// is computed for whichever set survives.

/**
 * @param {string} cwd
 * @param {{dotpath: string, verdict?: string, replan?: string, 'out-of-scope'?: string}} args
 * @returns {string}
 */
function reviewGate(cwd, args) {
  const { phase } = resolveAddress(cwd, args.dotpath, 'review-gate');
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
    options.push(cmdOption('c', 'complete', 'Complete the review phase and continue'));
    const oos = Number(args['out-of-scope']) || 0;
    if (oos > 0) {
      options.push(cmdOption('i', 'inbox', `Decide the ${oos} finding${oos === 1 ? '' : 's'} outside this spec`));
    }
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
    ]),
  );
}

// research-conclude-gate — the topic-completion consent gate. The dead-end
// row renders only when the session's own conclusion is that the topic gives
// the product nothing to carry forward under its own name — the judgment
// travels as the --dead-end flag, never derived here.

/**
 * @param {string} cwd
 * @param {{dotpath: string, 'dead-end'?: string}} args
 * @returns {string}
 */
function researchConcludeGate(cwd, args) {
  resolveResearch(cwd, args.dotpath, 'research-conclude-gate');
  const options = [
    cmdOption('c', 'conclude', 'Mark this topic as complete, ready for discussion'),
  ];
  if (args['dead-end']) {
    options.push(cmdOption('d', 'dead-end', 'Close it as a dead end — completed and kept as record, no discussion owed; reversible from the map'));
  }
  options.push(cmdOption('k', 'keep', "Keep digging, there's more to understand"));
  return section(
    'MENU: research conclude gate',
    "emit verbatim as markdown, then STOP for the user's response",
    menu('', options, { question: 'This topic looks ready to conclude.' }),
  );
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
// worth investigating independently. The thread description is the judgment
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
    throw new Error('render deep-dive-offer: "thread" must be a non-empty string — the thread description as it opens the offer');
  }
  return section('MENU: deep dive offer', STOP_FOR_RESPONSE, menu(
    `${p.thread} looks like it could use a deep dive.`,
    [
      cmdOption('y', 'yes', 'Dispatch a deep-dive agent'),
      cmdOption('n', 'no', "Skip, we'll cover it in conversation"),
    ],
    { question: 'Want me to spin up a background investigation while we keep going?' },
  ));
}

// in-flight-agents-gate — the wait-or-conclude gate a session takes when
// background agents are still running at conclusion. Research and discussion
// both dispatch and both conclude, so the gate serves the pair. Served to the
// epic and feature sessions alike: the shape is one gate, and the count is
// the session's own (this session's dispatches, an earlier session's dead
// rows already closed), so it rides as a scalar flag rather than being
// re-derived. A statement-headed route menu — the opening line reports what
// is still running, and there is no yes to answer — so it stays context
// rather than flickering into a glyphed label as the count changes.

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
  return section('MENU: in-flight agents gate', STOP_FOR_RESPONSE, menuFrame([
    n === 1 ? 'There is still 1 background agent working.' : `There are still ${n} background agents working.`,
    '',
    cmdOption('w', 'wait', 'Wait for results before concluding'),
    cmdOption('p', 'proceed', 'Conclude now (results will persist in cache for reference)'),
  ], { glyphLabel: false }));
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
    options.push(cmdOption('r', 'roadmap', 'Park it on the product roadmap with a horizon'));
  }
  if (manifest.work_type === 'feature') {
    options.push(cmdOption('p', 'pivot', 'Convert this work to an epic so it can hold the concern as its own topic'));
  }
  options.push(cmdOption('i', 'ignore', discussion ? 'Note it in the Summary and move on' : 'Note it in the research file and move on'));
  return section(
    'MENU: off-topic offer',
    "emit verbatim as markdown, then STOP for the user's response",
    menu(`**${p.concern}** is beyond this topic's scope.`, options),
  );
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
    menu(`Where should "${p.concern}" land?`, options, { prompt }),
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
      ...indentedBody(['Lifecycle: fresh — no phase work yet, so the routing hint is mutable.']),
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
      throw new Error(`render map-op-gate: "${name}" can't be closed as a dead end — it's cancelled; reactivate the phase work from the epic menu first`);
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
    throw new Error(`render map-op-gate: "${name}" can't be ${verb} — it's "${lifecycle}", not fresh`);
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
    promptOption('Comment', 'Tell me what to change (routing, summary, or description)'),
  ], { question: 'Add this topic to the map?' }))].join('\n');
}

// topic-collision-gate — the shared topic-creation core's exit after a
// proposed name collided with an active map item. Static: the rejection
// itself was rendered by the validation, and this gate only asks what to do
// about it.

/** @param {string} _cwd @param {object} _args @returns {string} */
function topicCollisionGate(_cwd, _args) {
  return section('MENU: topic collision gate', STOP_FOR_RESPONSE, menu('', [
    cmdOption('c', 'cancel', 'Abandon creating this topic'),
    promptOption('Pick another', 'Tell me a different name'),
  ], { question: 'How would you like to proceed?' }));
}

// triage-closed-target — the reroute's stop over a target no future session
// will surface. The address names the target and the surface derives its
// lifecycle with the same join every other map consumer uses, so the two
// closed states cannot drift apart in the wording. A statement-headed route
// menu: three destinations, no yes to answer, so the statement stays
// context rather than flickering into a glyphed label as the name shortens.

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
    : 'Reactivate it and land the concern there — its phase work returns to its previous status and counts as open again';
  return section('MENU: closed target gate', STOP_FOR_RESPONSE, menuFrame([
    `"${topic}" is ${closed}, so it won't pick up rerouted concerns.`,
    '',
    cmdOption('o', 'open', reopen),
    cmdOption('e', 'elsewhere', 'Pick a different target'),
    cmdOption('d', 'drop', 'Drop the reroute; the concern stays with the current topic'),
  ], { glyphLabel: false }));
}

// ---------------------------------------------------------------------------
// The phase gates. Each of these stops a flow the same way a shipped surface
// does — the option set in code, the prose carrying the fetch and the
// emission. Wording is the flow's own; the frame, the alignment and the
// register are this catalogue's.
// ---------------------------------------------------------------------------

// conclude-gate — the closing consent of the four phases whose conclusion is
// a user's call. One surface, keyed by the address's own phase segment: the
// shape is identical (a question, a yes, a way back), and only the wording
// each phase has always used differs, so it lives in one table rather than
// four copies of the same frame. Research's conclude gate is its own surface
// — it carries a conditional dead-end row no other phase has.
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
      cmdOption('n', 'no', 'Go back and make changes'),
    ],
  },
  planning: {
    question: 'Ready to conclude?',
    options: () => [
      cmdOption('y', 'yes', 'Conclude plan and mark as completed'),
      cmdOption('n', 'no', 'Go back and make changes'),
    ],
  },
};

/**
 * @param {string} cwd
 * @param {{dotpath: string}} args
 * @returns {string}
 */
function concludeGate(cwd, { dotpath }) {
  const { phase } = resolveAddress(cwd, dotpath, 'conclude-gate');
  const gate = CONCLUDE_GATES[phase];
  if (!gate) {
    throw new Error(`render conclude-gate: phase must be one of ${Object.keys(CONCLUDE_GATES).join(', ')}, got "${phase}"`);
  }
  return section('MENU: conclude gate', STOP_FOR_RESPONSE, menu('', gate.options(), { question: gate.question }));
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
  return section('MENU: unsourced topics gate', STOP_FOR_RESPONSE, menuFrame([
    `${p.names.length} topic(s) have no source file to draft from:`,
    '',
    ...p.names.map((n) => `- ${titlecase(n)}`),
    '',
    cmdOption('p', 'provide', "Tell me the summary for each and I'll write it"),
    cmdOption('d', 'dismiss', 'Write a minimal name-derived summary noting the missing source, so this stops re-prompting'),
    cmdOption('l', 'leave', 'Leave them unset; this flow re-offers next time'),
  ]));
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
// blocked or failed. The executor's own ISSUES text is echoed above; the
// three ways out are fixed.

/**
 * @param {string} cwd
 * @param {{dotpath: string}} args
 * @returns {string}
 */
function executorBlockGate(cwd, { dotpath }) {
  const { phase } = resolveAddress(cwd, dotpath, 'executor-block-gate');
  if (phase !== 'implementation') {
    throw new Error(`render executor-block-gate: address must be <work_unit>.implementation.<topic>, got phase "${phase}"`);
  }
  return section('MENU: executor block gate', STOP_FOR_RESPONSE, menu('', [
    cmdOption('r', 'retry', 'Re-invoke the executor with your comments (provide below)'),
    cmdOption('s', 'skip', 'Skip this task and move to the next'),
    cmdOption('t', 'stop', 'Stop implementation entirely'),
  ], { question: 'How would you like to proceed?' }));
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

// plan-format-gate — the plan's format offer, reached only when a project
// default exists. The format is project-manifest state, so the surface reads
// it rather than being told: an offer naming a format nobody set would be a
// gate over nothing. The address is the project's, not a work unit's — the
// planning item does not exist yet when this gate renders.

/**
 * @param {string} cwd
 * @returns {string}
 */
function planFormatGate(cwd) {
  const project = loadProjectManifest(cwd);
  const format = ((project || {}).defaults || {}).plan_format;
  if (!isFilled(format)) {
    throw new Error('render plan-format-gate: no project default plan_format — the offer only renders over an existing default');
  }
  return section('MENU: plan format gate', STOP_FOR_RESPONSE, menu(
    `Project default format is **${format}**. Use the same format?`,
    [
      cmdOption('y', 'yes', `Use ${format}`),
      cmdOption('n', 'no', 'See all available formats'),
    ],
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
      cmdOption('p', 'proceed', 'Continue review'),
      cmdOption('s', 'skip', 'Skip review, proceed to completion'),
    ], { question: 'Continue with review?' }));
  }
  return section('MENU: plan review reloop gate', STOP_FOR_RESPONSE, menu('', [
    cmdOption('r', 'reanalyse', 'Run another round (traceability + integrity)'),
    cmdOption('p', 'proceed', 'Proceed to conclusion'),
  ], { question: 'Run another review round?' }));
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
    `Apply the correction protocol to ${specPath}?`,
    [
      cmdOption('y', 'yes', 'Edit in place + corrigendum + knowledge re-index'),
      cmdOption('v', 'view', 'Show the full correction list'),
      cmdOption('n', 'no', 'Leave the specification as-is'),
    ],
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
// made), the `decide` batch (calls settled by the record or first
// principles, presented for veto before they land), and the `route` batch
// (concerns owned by a sibling topic). The lane fixes the chrome; the
// payload carries only judgment content, so the screen is one call and the
// prose holds no template. A screen holds at most BATCH_MAX items — a
// larger lane renders over successive screens, each approved on its own.

const BATCH_MAX = 5;

/** A confirm's remainder tail — how many of the lane wait beyond this screen. @param {number} more */
const moreTail = (more) => (more > 0 ? ` (${more} more after this)` : '');

/** @type {Record<string, {intro: (n: number) => string, confirm: (n: number, more: number) => string, discuss?: string, ask: string, fields: string[]}>} */
const BATCH_LANES = {
  apply: {
    intro: () => "The fix follows from what's already decided. Nothing here is a choice.",
    confirm: (n, more) => `${n === 1 ? 'Apply it' : `Apply all ${n}`}, then move on${moreTail(more)}`,
    ask: "Tell me a number to expand, or one you don't think is settled",
    fields: ['title', 'detail'],
  },
  decide: {
    intro: (n) => (n === 1
      ? "This one has a single defensible answer, settled by what's already decided or by first principles. I've made the call and named what determined it."
      : "Each of these has one defensible answer, settled by what's already decided or by first principles. I've made each call and named what determined it."),
    confirm: (n, more) => `${n === 1 ? 'Document it' : `Document all ${n}`} and move on${moreTail(more)}`,
    discuss: "Say discuss and a number — I'll raise it after the rest land",
    ask: 'Tell me a number to expand',
    fields: ['title', 'detail'],
  },
  route: {
    intro: (n) => (n === 1
      ? "Not this topic's to answer. It goes to its owner's triage queue as a concern, carrying the context built here."
      : "Not this topic's to answer. Each goes to its owner's triage queue as a concern, carrying the context built here."),
    confirm: (n, more) => `${n === 1 ? 'Send it' : `Send all ${n}`}${moreTail(more)}`,
    ask: 'Tell me a number to expand, or one that should stay here',
    fields: ['title', 'target', 'detail'],
  },
};

/**
 * @param {string} cwd
 * @param {{dotpath: string, file?: string}} args
 * @returns {string}
 */
function findingBatch(cwd, { dotpath, file }) {
  if (!file) throw new Error('render finding-batch: --file <payload.json> is required');
  resolveAddress(cwd, dotpath, 'finding-batch');
  const p = readJsonPayload(cwd, file, 'finding-batch');
  const lane = BATCH_LANES[p.lane];
  if (!lane) {
    throw new Error(`render finding-batch: "lane" must be one of ${Object.keys(BATCH_LANES).join(', ')}`);
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
  // Batch rows carry no walk-state — the lane is all-or-nothing, so no
  // glyph column. A route row's destination rides the tag slot.
  const body = worklist({
    intro: lane.intro(p.items.length),
    items: p.items.map((it) => ({ title: it.title, tag: it.target ? `→ ${it.target}` : undefined, note: it.detail })),
  });
  return [
    section('DISPLAY: finding batch', 'emit verbatim as markdown', body),
    section(
      'MENU: finding batch',
      "emit verbatim as markdown, then STOP for the user's response",
      menu('', [
        cmdOption('y', 'yes', lane.confirm(p.items.length, more)),
        ...(lane.discuss ? [promptOption('Discuss', lane.discuss)] : []),
        promptOption('Ask', lane.ask),
      ]),
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
// only question that determines its shape. `settled`: the record admits one
// defensible answer, so the finding carries the call and what determined it,
// and `auto` applies it without a stop. `choice`: real options exist and
// picking is the user's, so the finding proposes nothing and the stop
// overrides `auto` — the stays-gated rule is that a choice exists, never a
// category. `route` belongs to resolve-source-incoherence and refuses by name.
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
  return findingSettled(p, head, itemOf(manifest, phase, topic) || {}, view === 'full');
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
 * the fix, not its explanation.
 * @param {any} p @param {string[]} head @param {any} item @param {boolean} view @returns {string}
 */
function findingSettled(p, head, item, view) {
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

  // `--view` answers the gate's own v/view row: the wording the user asked
  // for, and the gate again minus that row. The report is not repeated —
  // re-rendering it whole is how one finding comes to fill a screen twice.
  if (view) {
    if (!p.content) throw new Error('render finding: --view needs "content" — a diff finding shows its change in place');
    return [
      section('DISPLAY: finding wording', 'emit verbatim as markdown', [`**${p.content.label}**`, '', ...p.content.lines].join('\n')),
      gateMenu(false),
    ].join('\n');
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
  // Whole-section content is validated above and never rendered here — source
  // read aloud is what buried the report; it waits for `v/view`, where it
  // renders as markdown rather than as a wall of syntax.

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
// plus the discuss/later menu.

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
        cmdOption('d', 'discuss', 'Surface and discuss them one at a time'),
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
      cmdOption('m', 'move', `Move it to this topic's ${other} queue — raised when ${other} runs`),
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
  return section(
    'DISPLAY: phase completed',
    CONTINUE_INSTRUCTION,
    `${titlecase(phase)} completed for "${titlecase(workUnit)}".${artefacts}`,
  );
}

/**
 * @param {string} cwd
 * @param {{dotpath: string}} args
 * @returns {string}
 */
function earlyCompletionGate(cwd, { dotpath }) {
  const { workUnit, manifest } = resolveWorkUnit(cwd, dotpath, 'early-completion-gate');
  // A live reconcile flag makes the skip-review exit an informed choice: the
  // gate names what completing now would carry unresolved.
  const flagged = [];
  for (const [phase, data] of Object.entries(manifest.phases || {})) {
    for (const [name, item] of Object.entries((data && data.items) || {})) {
      if (item && typeof item === 'object' && item.status === 'completed' && item.reconcile_needed !== undefined) {
        flagged.push(`${phase}/${name} (${item.reconcile_needed})`);
      }
    }
  }
  const label = flagged.length > 0
    ? `Implementation completed for "${titlecase(workUnit)}". ⚑ Input moved beneath ${flagged.join(', ')} — completing without review carries the pending reconcile unresolved.`
    : `Implementation completed for "${titlecase(workUnit)}".`;
  return section(
    'MENU: early completion gate',
    "emit verbatim as markdown, then STOP for the user's response",
    menu(label, [
      cmdOption('y', 'yes', 'Proceed to review'),
      cmdOption('d', 'done', 'Complete without review'),
    ], { question: 'Proceed to review?' }),
  );
}

/**
 * @param {string} cwd
 * @param {{dotpath: string, prev?: string, next?: string}} args
 * @returns {string}
 */
function revisitGate(cwd, { dotpath, prev, next }) {
  const { workUnit } = resolveWorkUnit(cwd, dotpath, 'revisit-gate');
  if (!isFilled(prev)) throw new Error('render revisit-gate: --prev is required');
  if (!isFilled(next)) throw new Error('render revisit-gate: --next is required');
  return section(
    'MENU: revisit gate',
    "emit verbatim as markdown, then STOP for the user's response",
    menu(`${titlecase(prev)} completed for "${titlecase(workUnit)}".`, [
      cmdOption('y', 'yes', `Proceed to ${next}`),
      cmdOption('r', 'revisit', 'Revisit an earlier phase'),
    ], { question: `Proceed to ${next}?` }),
  );
}

/**
 * The epic menu's bare topic-cancel confirm — the statement stays context,
 * the short question takes the glyph. The cascade case (a live spec sources
 * the topic) renders through cancel-cascade-gate instead.
 * @param {string} cwd
 * @param {{dotpath: string}} args
 * @returns {string}
 */
function cancelGate(cwd, { dotpath }) {
  const { phase, topic } = resolveAddress(cwd, dotpath, 'cancel-gate');
  return section(
    'MENU: cancel gate',
    "emit verbatim as markdown, then STOP for the user's response",
    menu(`Cancelling **${titlecase(topic)}** in ${phase} will mark it as cancelled — it can be reactivated later.`, [
      cmdOption('y', 'yes', 'Confirm cancellation'),
      cmdOption('n', 'no', 'Return to menu'),
    ], { question: 'Cancel it?' }),
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
// whole table. Empty when the selection raises no concern. The discovery-side
// rows count unfinished upstream items; the planning and implementation rows
// read the build order and name the topics sitting ahead of the selection.
// Advisory always: the menu offers proceed-anyway, never a refusal.
// ---------------------------------------------------------------------------

const { SOFT_GATE_ACTIONS } = require('./projections/epic.cjs');

const SOFT_GATE_DISCUSSION_ACTIONS = ['start_discussion', 'start_discussion_after_research', 'continue_discussion', 'new_discussion'];

/** @param {object[]} items @returns {{inProgress: number, total: number}} */
function softGateCounts(items) {
  const live = items.filter((i) => i.status !== 'cancelled');
  return { inProgress: live.filter((i) => i.status === 'in-progress').length, total: live.length };
}

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

  if (SOFT_GATE_DISCUSSION_ACTIONS.includes(action)) {
    const c = softGateCounts(phaseItems(manifest, 'research'));
    if (c.total > 0 && c.inProgress > 0) {
      message = `${c.inProgress} of ${c.total} research topics still in-progress. Topic analysis works best with all research available.`;
    }
  } else if (action === 'start_specification') {
    const c = softGateCounts(phaseItems(manifest, 'discussion'));
    if (c.total > 0 && c.inProgress > 0) {
      message = `${c.inProgress} of ${c.total} discussions still in-progress. Later conclusions may reshape this grouping.`;
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
    ], { glyphLabel: false }),
  );
}

// ---------------------------------------------------------------------------
// phase-note — the entry skills' one-line status notes (Resuming / Starting /
// Reopening …). Address-backed; the verb is the caller's word, the noun
// defaults to the phase segment (planning overrides with "plan").
// ---------------------------------------------------------------------------

/**
 * @param {string} cwd
 * @param {{dotpath: string, verb?: string, noun?: string}} args
 * @returns {string}
 */
function phaseNote(cwd, { dotpath, verb, noun }) {
  const { phase, topic } = resolveAddress(cwd, dotpath, 'phase-note');
  if (!isFilled(verb)) throw new Error('render phase-note: --verb is required (e.g. Resuming, Reopening, Starting)');
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

/** @param {any} manifest @param {string} phase @param {string} topic */
function itemOf(manifest, phase, topic) {
  return (((manifest.phases || {})[phase] || {}).items || {})[topic];
}

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
      // in-progress (a gap routed into it) blocks this spec until it
      // re-concludes. sourceRows decodes the map and legacy array forms.
      const spec = itemOf(manifest, 'specification', topic);
      const open = sourceRows(spec && spec.sources)
        .map(([n]) => n)
        .filter((n) => n && items[n] && items[n].status === 'in-progress');
      if (open.length > 0) {
        return blocker(
          `Sources for "${t}" are back in-progress: ${open.join(', ')}`,
          'A specification cannot be built from an in-flight record — conclude the reopened discussion(s), then re-enter this specification.',
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

  throw new Error(`render entry-gate: no prerequisite rules for phase "${phase}" (planning|implementation|review|specification)`);
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
        cmdOption('p', 'proceed', 'Enter anyway — two sessions on one code base'),
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
  const session = typeof item.analysis_cycle_session === 'number' ? item.analysis_cycle_session : 0;
  if (session <= SESSION_CYCLE_LIMIT) {
    throw new Error(`render cycle-limit: analysis_cycle_session is ${session}, within the session limit of ${SESSION_CYCLE_LIMIT}`);
  }
  return cycleLimitDisplay(session, SESSION_CYCLE_LIMIT);
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

/** @param {string} cwd @param {{dotpath: string, verb?: string, warn?: string}} args @returns {string} */
function topicReceiptSurface(cwd, args) {
  const { phase, topic, manifest } = resolveAddress(cwd, args.dotpath, 'topic-receipt');
  const verb = args.verb;
  if (verb !== 'complete' && verb !== 'cancel' && verb !== 'reactivate') {
    throw new Error(`render topic-receipt: --verb must be complete, cancel, or reactivate, got "${verb}"`);
  }
  const item = itemOf(manifest, phase, topic);
  if (!item) throw new Error(`render topic-receipt: no ${phase} item "${topic}"`);
  if (verb === 'complete' && item.status !== 'completed') {
    throw new Error(`render topic-receipt: "${topic}" is "${item.status}", not "completed" — the complete has not run`);
  }
  if (verb === 'cancel' && item.status !== 'cancelled') {
    throw new Error(`render topic-receipt: "${topic}" is "${item.status}", not "cancelled" — the cancel has not run`);
  }
  if (verb === 'reactivate' && item.status === 'cancelled') {
    throw new Error(`render topic-receipt: "${topic}" is still "cancelled" — the reactivate has not run`);
  }
  return topicReceipt(verb, topic, phase, item.status, { warn: args.warn === '1' });
}

/** @param {string} cwd @param {{dotpath: string, topic?: string, moved?: string, warn?: string}} args @returns {string} */
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
  return absorbReceipt(workUnit, topic, moved, { warn: args.warn === '1' });
}

/** @param {string} cwd @param {{dotpath: string, to?: string, warn?: string}} args @returns {string} */
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
  return promoteReceipt(workUnit, topic, args.to, { warn: args.warn === '1' });
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
function revisitPhasesSurface(cwd, args) {
  const { manifest, workUnit } = resolveWorkUnit(cwd, args.dotpath, 'revisit-phases');
  const type = manifest.work_type;
  if (!WORK_UNIT_TYPES[type]) {
    throw new Error(`render revisit-phases: "${workUnit}" is ${type ? `a ${type}` : 'untyped'} — the revisit menu serves the linear work types`);
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

/** @param {string} _cwd @param {object} _args @returns {string} */
function roadmapConcludeGateSurface(_cwd, _args) {
  return section('MENU: roadmap conclude gate', STOP_FOR_RESPONSE, roadmapConcludeGate());
}

// The cross-flow static gates — adopted engine-side as their files were
// touched (menus are engine-rendered, static sets included). Wording is
// the gates' own; each is fetched at the exact point it displays.

/**
 * Discovery's work-unit name confirm; `--variant collision` is the re-ask
 * after a name collided with an existing unit.
 * @param {string} _cwd @param {Record<string, string|undefined>} args @returns {string}
 */
function nameGateSurface(_cwd, { variant }) {
  if (variant !== undefined && variant !== 'collision') {
    throw new Error('render name-gate: --variant takes "collision" (omit it for the confirm shape)');
  }
  const body = variant === 'collision'
    ? menu('', [
      promptOption('A different name', 'Tell me what to call it instead'),
    ], { question: 'Choose a different name, or resume via /workflow-start.' })
    : menu('', [
      cmdOption('y', 'yes', 'Use this name'),
      promptOption('A different name', 'Tell me what to call it instead'),
    ], { question: 'Is this name okay?' });
  return section('MENU: name gate', STOP_FOR_RESPONSE, body);
}

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
  ], { question: 'Confirm to commit, or tell me what to adjust.' }));
}

/** The knowledge query-failure gate — retry or proceed without context. @param {string} _cwd @param {object} _args @returns {string} */
function queryFailureGateSurface(_cwd, _args) {
  return section('MENU: query failure gate', STOP_FOR_RESPONSE, menu('', [
    cmdOption('r', 'retry', "I'll fix the issue; retry the query"),
    cmdOption('s', 'skip', 'Proceed without knowledge context for this phase'),
  ], { question: 'How should I proceed?' }));
}

// ---------------------------------------------------------------------------
// The baseline surfaces — project-level, no address. Each handler resolves
// the one BaselineState (domain/baseline.cjs), refuses states the calling
// prose never reaches, and hands the pure projection its detail.
// ---------------------------------------------------------------------------

/** Resolve baseline state, refusing the never-started default. @param {string} cwd @param {string} surface */
function resolveBaseline(cwd, surface) {
  const d = baselineState(cwd);
  if (d.status === 'none') {
    throw new Error(`render ${surface}: no baseline on the project manifest`);
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

/** The one-time offer gate — only sensible while the baseline was never started. @param {string} cwd @param {object} _args @returns {string} */
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
  return baselineDocPick();
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
  'research-conclude-gate': researchConcludeGate,
  'deep-dive-offer': deepDiveOffer,
  'in-flight-agents-gate': inFlightAgentsGate,
  'reroute-candidates': rerouteCandidates,
  'off-topic-offer': offTopicOffer,
  'map-op-gate': mapOpGate,
  'candidate-gate': candidateGate,
  'topic-collision-gate': topicCollisionGate,
  'triage-closed-target': triageClosedTarget,
  'conclude-gate': concludeGate,
  'summary-backfill-gate': summaryBackfillGate,
  'external-dependency-gate': externalDependencyGate,
  'checkpoint-files-gate': checkpointFilesGate,
  'executor-block-gate': executorBlockGate,
  'dependency-approval-gate': dependencyApprovalGate,
  'task-count-gate': taskCountGate,
  'plan-format-gate': planFormatGate,
  'plan-review-gate': planReviewGate,
  'correction-gate': correctionGate,
  'analysis-proceed-gate': analysisProceedGate,
  'proposed-task': proposedTask,
  'incoherence-gate': incoherenceGate,
  'cancel-cascade-gate': cancelCascadeGate,
  'resurface-gate': resurfaceGate,
  'construction-gate': constructionGate,
  'tasks-overview': tasksOverview,
  'author-task-gate': authorTaskGate,
  'phase-tree': phaseTree,
  'phase-completed': phaseCompleted,
  'phase-note': phaseNote,
  'entry-gate': entryGate,
  'code-gate': codeGate,
  'early-completion-gate': earlyCompletionGate,
  'revisit-gate': revisitGate,
  'cancel-gate': cancelGate,
  'epic-all-done-gate': epicAllDoneGate,
  'epic-soft-gate': epicSoftGate,
  'task-brief': taskBrief,
  'task-result': taskResult,
  'task-gate': taskGate,
  'fix-gate': fixGate,
  'blocked-tasks': blockedTasks,
  'cycle-limit': cycleLimit,
  'cycle-gate': cycleGate,
  'workunit-receipt': workunitReceiptSurface,
  'topic-receipt': topicReceiptSurface,
  'absorb-receipt': absorbReceiptSurface,
  'promote-receipt': promoteReceiptSurface,
  'pivot-continuation': pivotContinuation,
  'session-receipt': sessionReceiptSurface,
  'absorb-target': absorbTarget,
  'plan-topics': planTopics,
  'revisit-phases': revisitPhasesSurface,
  'roadmap-view': roadmapViewSurface,
  'roadmap-add-gate': roadmapAddGateSurface,
  'roadmap-session-receipt': roadmapSessionReceiptSurface,
  'roadmap-harvest-gate': roadmapHarvestGateSurface,
  'roadmap-parks-gate': roadmapParksGateSurface,
  'roadmap-shape-gate': roadmapShapeGateSurface,
  'roadmap-conclude-gate': roadmapConcludeGateSurface,
  'name-gate': nameGateSurface,
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
