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
 * @param {{dotpath: string, file?: string}} args
 * @returns {string} sections
 */
function taskList(cwd, { dotpath, file }) {
  if (!file) throw new Error('render task-list: --file <payload.json> is required');
  const { topic, manifest } = resolveAddress(cwd, dotpath, 'task-list');
  const payload = readTaskListPayload(cwd, file);

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
      `Phase ${payload.phase}: ${payload.phase_name} — task list approved. Proceeding to authoring.`,
    ));
  } else {
    parts.push(section(
      'MENU: task list gate',
      'emit verbatim as markdown, then STOP for the user\'s response',
      menu('Approve this task list?', [
        cmdOption('y', 'yes', 'Proceed to authoring'),
        cmdOption('a', 'auto', 'Approve this and all remaining task list gates automatically'),
        promptOption('Tell me what to change', 'which tasks to reorder, split, merge, add, edit, or remove'),
        promptOption('Navigate', 'Tell me where to go: a different phase or task, or the leading edge'),
      ]),
    ));
  }
  return parts.join('\n');
}

/** The catalogue: surface name → handler. @type {Record<string, (cwd: string, args: {dotpath: string} & Record<string, string|undefined>) => string>} */
const SURFACES = {
  'resume-gate': resumeGate,
  'task-list': taskList,
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
