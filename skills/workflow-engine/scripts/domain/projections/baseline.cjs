'use strict';

// ---------------------------------------------------------------------------
// Domain ring: project-baseline projections — the render surfaces the
// workflow-baseline skill fetches at its display points. Baseline state is
// project-level: everything here reads the project manifest's `baseline`
// object, never a work-unit manifest.
// ---------------------------------------------------------------------------

const path = require('path');
const { readProjectManifest } = require('../../kernel/manifest-io.cjs');
const { section, menu, cmdOption, CONTINUE_INSTRUCTION } = require('./surfaces.cjs');
const { titlecase } = require('../conventions.cjs');

const MENU_INSTRUCTION = "emit verbatim as markdown, then STOP for the user's response";

/**
 * @typedef {object} BaselineDetail
 * @property {string} status
 * @property {{name: string, status: string}[]} areas  registration order
 */

/**
 * Read the project manifest's baseline object. Loud when absent — these
 * surfaces are called from prescribed prose that has already branched on the
 * status, so a missing object is an authoring bug.
 * @param {string} cwd @param {string} surface
 * @returns {BaselineDetail}
 */
function baselineDetail(cwd, surface) {
  const manifest = readProjectManifest(path.join(cwd, '.workflows'));
  const b = manifest && manifest.baseline;
  if (!b || typeof b !== 'object' || Array.isArray(b)) {
    throw new Error(`render ${surface}: no baseline on the project manifest`);
  }
  const areasObj = b.areas && typeof b.areas === 'object' && !Array.isArray(b.areas) ? b.areas : {};
  const areas = Object.entries(areasObj).map(([name, status]) => ({ name, status: String(status) }));
  return { status: typeof b.status === 'string' ? b.status : 'none', areas };
}

/** @param {BaselineDetail} d */
function remaining(d) {
  return d.areas.filter((a) => a.status !== 'completed').length;
}

/**
 * The baseline area map — an in-progress assessment shows each area's status
 * and what remains; a completed one lists the landed docs. Serves the
 * interview's resume display and the manage view.
 * @param {string} cwd @param {object} _args
 * @returns {string}
 */
function baselineProgress(cwd, _args) {
  const d = baselineDetail(cwd, 'baseline-progress');
  if (d.areas.length === 0) {
    throw new Error('render baseline-progress: the baseline has no areas');
  }
  const lines = [];
  if (d.status === 'completed') {
    lines.push(`Baseline — ${d.areas.length} area(s) documented:`, '');
    for (const a of d.areas) lines.push(`  ${a.name}.md`);
  } else {
    const pad = Math.max(...d.areas.map((a) => a.name.length));
    lines.push('Baseline in progress:', '');
    for (const a of d.areas) lines.push(`  ${a.name.padEnd(pad)}  [${a.status}]`);
    lines.push('', `${remaining(d)} area(s) remain.`);
  }
  return section('DISPLAY: baseline progress', CONTINUE_INSTRUCTION, lines.join('\n'));
}

/**
 * The between-areas gate: the named area just landed, more remain. The
 * none-remain case is the conclude path — reaching this surface there is an
 * authoring bug, so it throws rather than rendering an empty gate.
 * @param {string} cwd @param {Record<string, string|undefined>} args
 * @returns {string}
 */
function baselineAreaGate(cwd, { area }) {
  const d = baselineDetail(cwd, 'baseline-area-gate');
  if (!area) throw new Error('render baseline-area-gate: --area is required');
  const entry = d.areas.find((a) => a.name === area);
  if (!entry) throw new Error(`render baseline-area-gate: unknown area "${area}"`);
  if (entry.status !== 'completed') {
    throw new Error(`render baseline-area-gate: area "${area}" is "${entry.status}", not completed — the gate follows the doc landing`);
  }
  const left = remaining(d);
  if (left === 0) {
    throw new Error('render baseline-area-gate: no areas remain — the flow concludes instead of gating');
  }
  const body = menu(
    `**${titlecase(area)}** is documented. ${left} area(s) remain.`,
    [
      cmdOption('c', 'continue', 'Interview the next area'),
      cmdOption('p', 'pause', 'Stop here — resume any time from workflow-start'),
    ],
    { question: 'Keep going?' },
  );
  return section('MENU: baseline area gate', MENU_INSTRUCTION, body);
}

/**
 * The pause receipt — what the interview holds so far and how to get back in.
 * @param {string} cwd @param {object} _args
 * @returns {string}
 */
function baselinePaused(cwd, _args) {
  const d = baselineDetail(cwd, 'baseline-paused');
  if (d.status !== 'in-progress') {
    throw new Error(`render baseline-paused: the baseline is "${d.status}", not in-progress`);
  }
  const done = d.areas.length - remaining(d);
  const body = [
    `Paused — ${done} of ${d.areas.length} area(s) documented.`,
    'Everything answered so far is recorded, and the finished docs',
    'are already live in the knowledge base.',
    '',
    'Resume from the workflow-start menu.',
  ].join('\n');
  return section('DISPLAY: baseline paused', CONTINUE_INSTRUCTION, body);
}

/**
 * The completion receipt — every area documented and indexed.
 * @param {string} cwd @param {object} _args
 * @returns {string}
 */
function baselineReceipt(cwd, _args) {
  const d = baselineDetail(cwd, 'baseline-receipt');
  if (d.status !== 'completed') {
    throw new Error(`render baseline-receipt: the baseline is "${d.status}", not completed — the receipt follows the completion write`);
  }
  const lines = [
    `Baseline complete — ${d.areas.length} area(s) documented and indexed.`,
    '',
  ];
  for (const a of d.areas) lines.push(`  ${a.name}.md`);
  lines.push('', 'Every phase now surfaces this as [baseline | ...] context', 'in its knowledge queries.');
  return section('DISPLAY: baseline receipt', CONTINUE_INSTRUCTION, lines.join('\n'));
}

module.exports = { baselineProgress, baselineAreaGate, baselinePaused, baselineReceipt };
