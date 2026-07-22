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
const { titlecase } = require('./conventions.cjs');
const { section, menu, cmdOption, promptOption, callout, subDetail, treeList } = require('./projections/surfaces.cjs');

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
// optional triage count is model-counted (the Triage section lives in the
// artifact markdown, which the model has already read and the engine never
// parses) and rides as a scalar flag.
// ---------------------------------------------------------------------------

/**
 * @param {string} cwd
 * @param {{dotpath: string, triage?: string}} args
 * @returns {string} sections
 */
function resumeGate(cwd, { dotpath, triage }) {
  const { phase, topic } = resolveAddress(cwd, dotpath, 'resume-gate');
  const parts = [];
  if (triage !== undefined) {
    const n = parseInt(triage, 10);
    if (!Number.isInteger(n) || n < 1) {
      throw new Error(`render resume-gate: --triage must be a positive integer, got "${triage}"`);
    }
    parts.push(section(
      'DISPLAY: triage warning',
      'emit verbatim as a code block, directly above the menu',
      callout([
        `${n} rerouted concern(s) from other topics sit undrained in this`,
        "file's Triage section. Restarting deletes them permanently.",
      ]),
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
      'emit verbatim as a code block, then proceed without a gate',
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
// the cycle response, the other in staging-file frontmatter — the surface
// guarantees the form of both outputs, the flow owns the mode.
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
      'emit verbatim as a code block after recording the approval',
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
    throw new Error('render tasks-overview: "tasks" must be a non-empty array of {title, severity}');
  }
  const lines = [`${p.label}: ${p.tasks.length} proposed task${p.tasks.length === 1 ? '' : 's'}`, ''];
  p.tasks.forEach((t, i) => {
    if (!isFilled(t.title) || !isFilled(t.severity)) {
      throw new Error(`render tasks-overview: task ${i + 1} needs "title" and "severity"`);
    }
    lines.push(`  ${i + 1}. ${t.title} (${t.severity})`);
  });
  return section('DISPLAY: tasks overview', 'emit verbatim as a code block', lines.join('\n'));
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
  const lines = [`${p.review_label} — ${p.items.length} item${p.items.length === 1 ? '' : 's'} found`, ''];
  p.items.forEach((it, i) => {
    for (const field of ['title', 'tag', 'summary']) {
      if (!isFilled(it[field])) throw new Error(`render findings-summary: item ${i + 1} is missing "${field}"`);
    }
    lines.push(`${i + 1}. ${it.title} (${it.tag})`);
    lines.push(subDetail(it.summary));
    if (i < p.items.length - 1) lines.push('');
  });
  lines.push('', "Let's work through these one at a time, starting with #1.");
  return section('DISPLAY: findings summary', 'emit verbatim as a code block', lines.join('\n'));
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
      'emit verbatim as a code block after applying the fix',
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
 * @param {{dotpath: string, phase?: string}} args
 * @returns {string}
 */
function phaseCompleted(cwd, { dotpath, phase }) {
  const { workUnit } = resolveWorkUnit(cwd, dotpath, 'phase-completed');
  if (!isFilled(phase)) throw new Error('render phase-completed: --phase is required');
  return section(
    'DISPLAY: phase completed',
    'emit verbatim as a code block',
    `${titlecase(phase)} completed for "${titlecase(workUnit)}".`,
  );
}

/**
 * @param {string} cwd
 * @param {{dotpath: string}} args
 * @returns {string}
 */
function earlyCompletionGate(cwd, { dotpath }) {
  const { workUnit } = resolveWorkUnit(cwd, dotpath, 'early-completion-gate');
  return section(
    'MENU: early completion gate',
    "emit verbatim as markdown, then STOP for the user's response",
    menu(`Implementation completed for "${titlecase(workUnit)}".`, [
      cmdOption('y', 'yes', 'Proceed to review'),
      cmdOption('d', 'done', 'Complete without review'),
    ]),
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
    ]),
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
    ]),
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
    'emit verbatim as a code block',
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

/** @param {string} title @param {string[]} bodyLines */
function blocker(title, bodyLines) {
  return section(
    'DISPLAY: entry blocker',
    'emit verbatim as a code block, then STOP — terminal condition',
    [title, '', ...bodyLines].join('\n'),
  );
}

/**
 * @param {string} cwd
 * @param {{dotpath: string}} args
 * @returns {string} blocker sections, or '' when the entry is clear
 */
function entryGate(cwd, { dotpath }) {
  const { phase, topic, manifest } = resolveAddress(cwd, dotpath, 'entry-gate');
  const t = titlecase(topic);

  if (phase === 'planning') {
    const spec = itemOf(manifest, 'specification', topic);
    const status = spec && spec.status;
    if (!status) {
      return blocker('Specification Missing', [
        `No specification found for "${t}".`,
        '',
        'The specification must be completed before planning can begin.',
      ]);
    }
    if (status === 'in-progress') {
      return blocker('Specification In Progress', [
        `The specification for "${t}" is not yet completed.`,
        '',
        'The specification must be completed before planning can begin.',
      ]);
    }
    if (status === 'proposed') {
      return blocker('Specification Not Started', [
        `"${t}" is a proposed grouping — the specification`,
        "hasn't been started yet.",
        '',
        'Start the specification first, then return to planning once it',
        'completes.',
      ]);
    }
    if (status === 'superseded') {
      return blocker('Specification Superseded', [
        `The specification for "${t}" was consolidated into`,
        `"${titlecase(String(spec.superseded_by || ''))}".`,
        '',
        'Plan the superseding specification instead.',
      ]);
    }
    if (status === 'promoted') {
      return blocker('Specification Promoted', [
        `"${t}" was promoted to the cross-cutting work unit`,
        `"${spec.promoted_to}". Cross-cutting specifications inform other plans —`,
        'they are not planned directly.',
      ]);
    }
    return '';
  }

  if (phase === 'implementation') {
    const plan = itemOf(manifest, 'planning', topic);
    if (!plan || !plan.status) {
      return blocker('Plan Missing', [
        `No plan found for "${t}".`,
        '',
        'A completed plan is required for implementation.',
      ]);
    }
    if (plan.status !== 'completed') {
      return blocker('Plan Not Completed', [`The plan for "${t}" is not yet completed.`]);
    }
    return '';
  }

  if (phase === 'review') {
    if (!itemOf(manifest, 'planning', topic)) {
      return blocker('Plan Missing', [
        `No plan found for "${t}".`,
        '',
        'A completed plan and completed implementation are required for review.',
      ]);
    }
    const impl = itemOf(manifest, 'implementation', topic);
    if (!impl) {
      return blocker('Implementation Missing', [
        `No implementation found for "${t}".`,
        '',
        'A completed implementation is required for review.',
      ]);
    }
    if (impl.status !== 'completed') {
      return blocker('Implementation Not Complete', [`The implementation for "${t}" is not yet completed.`]);
    }
    return '';
  }

  if (phase === 'specification') {
    const wu = titlecase(manifest.name || topic);
    const workType = manifest.work_type;
    if (workType === 'bugfix') {
      const inv = itemOf(manifest, 'investigation', topic);
      if (!inv) {
        return blocker('Source Material Missing', [
          `No investigation found for "${wu}".`,
          '',
          'A completed investigation is required before specification can begin.',
        ]);
      }
      if (inv.status !== 'completed') {
        return blocker('Investigation In Progress', [
          `The investigation for "${wu}" is not yet completed.`,
          '',
          'The investigation must be completed before specification can begin.',
        ]);
      }
      return '';
    }
    if (workType === 'epic') {
      const items = ((manifest.phases || {}).discussion || {}).items || {};
      const names = Object.keys(items);
      if (names.length === 0) {
        return blocker('Source Material Missing', [
          `No discussions found for "${wu}".`,
          '',
          'At least one completed discussion is required before specification can begin.',
        ]);
      }
      if (!names.some((n) => items[n] && items[n].status === 'completed')) {
        return blocker('No Completed Discussions', [
          `No completed discussions found for "${wu}".`,
          '',
          'At least one completed discussion is required before specification can begin.',
          'Run /workflow-start to continue an in-progress discussion.',
        ]);
      }
      return '';
    }
    // feature / cross-cutting: the topic's own discussion.
    const disc = itemOf(manifest, 'discussion', topic);
    if (!disc) {
      return blocker('Source Material Missing', [
        `No discussion found for "${wu}".`,
        '',
        'A completed discussion is required before specification can begin.',
      ]);
    }
    if (disc.status !== 'completed') {
      return blocker('Discussion In Progress', [
        `The discussion for "${wu}" is not yet completed.`,
        '',
        'The discussion must be completed before specification can begin.',
      ]);
    }
    return '';
  }

  throw new Error(`render entry-gate: no prerequisite rules for phase "${phase}" (planning|implementation|review|specification)`);
}

/** The catalogue: surface name → handler. @type {Record<string, (cwd: string, args: {dotpath: string} & Record<string, string|undefined>) => string>} */
const SURFACES = {
  'resume-gate': resumeGate,
  'task-list': taskList,
  'findings-summary': findingsSummary,
  'finding': finding,
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
