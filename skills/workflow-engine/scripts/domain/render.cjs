'use strict';

// Render-surface catalogue — the named runtime surfaces `engine render
// <surface>` serves to skills. Judgment decides; code renders: address-backed
// values come from the manifest (JSON state only — markdown artifacts are
// never parsed), judgment content arrives as a validated JSON payload file,
// and each surface returns demarcated sections the calling flow emits
// verbatim at its prescribed moment. Gate-mode branching renders inside the
// surface: the caller never chooses between gated and auto output.

const fs = require('fs');
const path = require('path');
const { loadManifest } = require('./reads.cjs');
const { titlecase, WORKLIST_GLYPH } = require('./conventions.cjs');
const { section, CONTINUE_INSTRUCTION, CONTINUE_MARKDOWN_INSTRUCTION, AUTO_GATE_INSTRUCTION, menu, cmdOption, promptOption, callout, subDetail, treeList } = require('./projections/surfaces.cjs');
const { worklist } = require('./projections/worklist.cjs');
const { blockedTasksMenu, taskGateSection, fixGateSection, fixThresholdDisplay, cycleLimitDisplay, cycleGateMenu } = require('./projections/tasks.cjs');
const { workunitReceipt, topicReceipt, absorbReceipt, promoteReceipt, pivotContinuationMenu, sessionReceipt } = require('./projections/transactions.cjs');
const { absorbTargetMenu, planTopicsMenu } = require('./projections/start.cjs');
const { revisitablePhases, revisitPhasesSection } = require('./projections/workunit.cjs');
const { WORK_UNIT_TYPES, typeConfig: workUnitTypeConfig, completedPhases } = require('./workunit-detail.cjs');
const { computeNextPhase } = require('./derivations.cjs');
const { manageDetail } = require('./workunit-manage.cjs');
const { gateOf, FIX_THRESHOLD, SESSION_CYCLE_LIMIT } = require('./tasks.cjs');

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
  const { phase, topic, manifest } = resolveAddress(cwd, dotpath, 'resume-gate');
  const t = titlecase(topic);
  if (variant === 'plan') {
    const item = itemOf(manifest, 'planning', topic) || {};
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
// proposed-task / tasks-overview — the analysis and review synthesis loops'
// shared task presentation (their prose templates were byte-identical twins).
// Gate mode rides as a flag, not an address read: one consumer carries it in
// the cycle response, the other in the manifest's staging.c{N} subtree — the
// surface guarantees the form of both outputs, the flow owns the mode.
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
  for (const field of ['title', 'severity', 'sources', 'problem', 'solution', 'outcome']) {
    if (!isFilled(p[field])) throw new Error(`render proposed-task: "${field}" must be a non-empty string`);
  }
  const blocks = {};
  for (const field of ['steps', 'criteria', 'tests']) {
    const lines = stringLines(p[field], 'proposed-task', field);
    if (lines.length === 0) throw new Error(`render proposed-task: "${field}" must be non-empty`);
    blocks[field] = lines;
  }

  const body = [
    `**Task ${p.current}/${p.total}: ${p.title}** (${p.severity})`,
    `Sources: ${p.sources}`,
    '',
    `**Problem**: ${p.problem}`,
    `**Solution**: ${p.solution}`,
    `**Outcome**: ${p.outcome}`,
    '',
    '**Do**:',
    ...blocks.steps,
    '',
    '**Acceptance Criteria**:',
    ...blocks.criteria,
    '',
    '**Tests**:',
    ...blocks.tests,
  ];
  const parts = [section('DISPLAY: proposed task', 'emit verbatim as markdown', body.join('\n'))];

  if (gate === 'auto') {
    parts.push(section(
      'DISPLAY: task auto-approved',
      `after recording the approval: ${AUTO_GATE_INSTRUCTION}`,
      `Task ${p.current} of ${p.total}: ${p.title} — approved [auto].`,
    ));
  } else {
    const hint = isFilled(args['comment-hint']) ? args['comment-hint'] : 'Tell me what to change';
    parts.push(section(
      'MENU: task approval',
      'emit verbatim as markdown, then STOP for the user\'s response',
      menu('Approve this task?', [
        cmdOption('y', 'yes', 'Approve this task'),
        cmdOption('a', 'auto', 'Approve this and all remaining tasks automatically'),
        cmdOption('s', 'skip', 'Skip this task'),
        promptOption('Comment', hint),
      ]),
    ));
  }
  return parts.join('\n');
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
// Artefact content is framed by its emission fence (D8): a diff renders as
// one ```diff-fenced section — colouring keys on the column-0 markers, and
// space-prefixed context lines place the change — prose content as a plain
// code block. No drawn borders anywhere.
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

// reroute-offer — the off-topic reroute's consent gate. The concern and,
// when one home is clear, the resolved target with its judged landing
// phase are judgment content; the chrome and the options are fixed.

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
  const hasTarget = isFilled(p.target);
  const hasPhase = isFilled(p.landing_phase);
  if (hasTarget !== hasPhase) {
    throw new Error('render reroute-offer: "target" and "landing_phase" come together — both for a clear home, neither otherwise');
  }
  if (hasPhase && !['research', 'discussion'].includes(p.landing_phase)) {
    throw new Error(`render reroute-offer: "landing_phase" must be "research" or "discussion", got "${p.landing_phase}"`);
  }
  const label = hasTarget
    ? `**${p.concern}** belongs to a different topic, not this one.\nIt reads as **${p.target}**'s ground, landing ${p.landing_phase}-side — append a phase to override (e.g. \`r discussion\`).`
    : `**${p.concern}** belongs to a different topic, not this one.`;
  return section(
    'MENU: reroute offer',
    "emit verbatim as markdown, then STOP for the user's response",
    menu(label, [
      cmdOption('r', 'reroute', 'Send it to the topic it belongs to; it picks it up later'),
      cmdOption('k', 'keep', 'Keep it here as a subtopic'),
    ]),
  );
}

// reroute-candidates — the ambiguous reroute's selection gate. The plausible
// homes and the judged landing phase are judgment content; the numbering,
// the new-topic option, and the override grammar are fixed.

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
    return cmdOption(String(i + 1), null, `${c.name} [${c.lifecycle}]`);
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

// finding-batch — a surfacing lane whose findings ask nothing of the user
// beyond a yes: the `apply` batch (corrections determined by decisions
// already made) and the `route` batch (concerns owned by a sibling topic).
// The lane fixes the chrome; the payload carries only judgment content, so
// the screen is one call and the prose holds no template.

/** @type {Record<string, {intro: string, confirm: (n: number) => string, ask: string, fields: string[]}>} */
const BATCH_LANES = {
  apply: {
    intro: "The fix follows from what's already decided. Nothing here is a choice.",
    confirm: (n) => `Apply all ${n}, then move on`,
    ask: "Tell me a number to expand, or one you don't think is settled",
    fields: ['title', 'detail'],
  },
  route: {
    intro: "Not this topic's to answer. Each goes to its owner's triage queue as a concern, carrying the context built here.",
    confirm: (n) => `Send all ${n}`,
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
  p.items.forEach((it, i) => {
    for (const field of lane.fields) {
      if (!isFilled(it[field])) throw new Error(`render finding-batch: item ${i + 1} is missing "${field}"`);
    }
  });
  // Batch rows carry no walk-state — the lane is all-or-nothing, so no
  // glyph column. A route row's destination rides the tag slot.
  const body = worklist({
    intro: lane.intro,
    items: p.items.map((it) => ({ title: it.title, tag: it.target ? `→ ${it.target}` : undefined, note: it.detail })),
  });
  return [
    section('DISPLAY: finding batch', 'emit verbatim as markdown', body),
    section(
      'MENU: finding batch',
      "emit verbatim as markdown, then STOP for the user's response",
      menu('', [
        cmdOption('y', 'yes', lane.confirm(p.items.length)),
        promptOption('Ask', lane.ask),
      ]),
    ),
  ].join('\n');
}

/**
 * @param {string} cwd
 * @param {{dotpath: string, file?: string}} args
 * @returns {string}
 */
function finding(cwd, { dotpath, file }) {
  if (!file) throw new Error('render finding: --file <payload.json> is required');
  const { phase, topic, manifest } = resolveAddress(cwd, dotpath, 'finding');
  const p = readJsonPayload(cwd, file, 'finding');

  if (!Number.isInteger(p.n) || p.n < 1) throw new Error('render finding: "n" must be a positive integer');
  if (!Number.isInteger(p.total) || p.total < p.n) throw new Error('render finding: "total" must be an integer ≥ "n"');
  if (!isFilled(p.title)) throw new Error('render finding: "title" must be a non-empty string');
  if (!Array.isArray(p.meta) || p.meta.some((m) => !Array.isArray(m) || m.length !== 2 || !isFilled(m[0]) || !(typeof m[1] === 'number' || isFilled(m[1])))) {
    throw new Error('render finding: "meta" must be an array of [label, value] pairs');
  }
  if (!isFilled(p.details)) throw new Error('render finding: "details" must be a non-empty string');
  if (p.diff && p.content) throw new Error('render finding: pass "diff" or "content", not both');

  const applyLabel = isFilled(p.apply_label) ? p.apply_label : 'Apply verbatim';
  const appliedLabel = isFilled(p.applied_label) ? p.applied_label : 'approved. Applied.';
  const feedbackHint = isFilled(p.feedback_hint) ? p.feedback_hint : 'Tell me what to change before approving';

  const parts = [];

  const head = [`**Finding ${p.n} of ${p.total}: ${p.title}**`, ''];
  for (const [label, value] of p.meta) head.push(`- **${label}**: ${value}`);
  head.push('', `**Details**: ${p.details}`);
  parts.push(section('DISPLAY: finding', 'emit verbatim as markdown', head.join('\n')));

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
  } else if (p.content) {
    if (!isFilled(p.content.label)) throw new Error('render finding: "content.label" must be a non-empty string');
    const lines = stringLines(p.content.lines, 'finding', 'content.lines');
    if (lines.length === 0) throw new Error('render finding: "content.lines" must be non-empty');
    parts.push(section('DISPLAY: finding content', 'emit verbatim as a code block', [`${p.content.label}:`, '', ...lines].join('\n')));
  }

  const items = (((manifest.phases || {})[phase] || {}).items || {})[topic] || {};
  const gateMode = items.finding_gate_mode === 'auto' ? 'auto' : 'gated';

  if (gateMode === 'auto') {
    parts.push(section(
      'DISPLAY: finding auto-approved',
      `after applying the fix: ${AUTO_GATE_INSTRUCTION}`,
      `Finding ${p.n} of ${p.total}: ${p.title} — ${appliedLabel}`,
    ));
  } else {
    const options = [cmdOption('y', 'yes', applyLabel)];
    if (p.diff) options.push(cmdOption('v', 'view full', 'Show full Current and Proposed content'));
    options.push(
      cmdOption('a', 'auto', 'Approve this and all remaining findings automatically'),
      cmdOption('s', 'skip', 'Leave as-is, move to next finding'),
      promptOption('Provide feedback', feedbackHint),
    );
    parts.push(section(
      'MENU: finding gate',
      'emit verbatim as markdown, then STOP for the user\'s response',
      menu(`**Finding ${p.n} of ${p.total}: ${p.title}**`, options),
    ));
  }
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
  const doing = phase === 'research' ? 'exploration' : 'discussion';
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
// Task-loop gates — fetched by the implementation loop at the exact stage
// that displays them, so the section always sits in the tool result directly
// above its emission. State-backed: the in-flight task and gate modes come
// from the implementation item; gate-mode branching renders inside the
// surface. `blocked-tasks` and `cycle-gate` are static menus and take no
// address.
// ---------------------------------------------------------------------------

/**
 * The implementation item at a `<wu>.implementation.<topic>` address, plus
 * its in-flight task id. Loud when the address names another phase or no
 * task is in flight — these surfaces serve the task loop, which always has
 * a current task at its gates.
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

/** @param {string} cwd @param {{dotpath: string}} args @returns {string} */
function taskGate(cwd, args) {
  const { item, taskId } = implItemAt(cwd, args.dotpath, 'task-gate');
  return taskGateSection(taskId, gateOf(item, 'task_gate_mode'));
}

/** @param {string} cwd @param {{dotpath: string}} args @returns {string} */
function fixGate(cwd, args) {
  const { item, taskId } = implItemAt(cwd, args.dotpath, 'fix-gate');
  const attempts = typeof item.fix_attempts === 'number' ? item.fix_attempts : 0;
  return fixGateSection(taskId, gateOf(item, 'fix_gate_mode'), attempts >= FIX_THRESHOLD);
}

/** @param {string} cwd @param {{dotpath: string}} args @returns {string} */
function fixThreshold(cwd, args) {
  const { item, taskId } = implItemAt(cwd, args.dotpath, 'fix-threshold');
  const attempts = typeof item.fix_attempts === 'number' ? item.fix_attempts : 0;
  if (attempts < FIX_THRESHOLD) {
    throw new Error(`render fix-threshold: fix_attempts is ${attempts}, below the threshold of ${FIX_THRESHOLD}`);
  }
  return fixThresholdDisplay(attempts, taskId);
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

/** The catalogue: surface name → handler. @type {Record<string, (cwd: string, args: {dotpath: string} & Record<string, string|undefined>) => string>} */
const SURFACES = {
  'resume-gate': resumeGate,
  'task-list': taskList,
  'findings-summary': findingsSummary,
  'finding-batch': findingBatch,
  'finding': finding,
  'triage-announce': triageAnnounce,
  'triage-offer': triageOffer,
  'triage-block': triageBlock,
  'reroute-offer': rerouteOffer,
  'reroute-candidates': rerouteCandidates,
  'proposed-task': proposedTask,
  'tasks-overview': tasksOverview,
  'author-task-gate': authorTaskGate,
  'phase-tree': phaseTree,
  'phase-completed': phaseCompleted,
  'phase-note': phaseNote,
  'entry-gate': entryGate,
  'early-completion-gate': earlyCompletionGate,
  'revisit-gate': revisitGate,
  'epic-all-done-gate': epicAllDoneGate,
  'task-gate': taskGate,
  'fix-gate': fixGate,
  'fix-threshold': fixThreshold,
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
