'use strict';

// ---------------------------------------------------------------------------
// Domain ring: project-baseline projections — pure renderers over the
// BaselineState the render surfaces resolve (domain/baseline.cjs). Like every
// sibling projection they take a detail object and return a string; state
// resolution and refusals live with the surface handlers in domain/render.cjs.
// ---------------------------------------------------------------------------

const { wrapWithPrefix } = require('../../kernel/render.cjs');
const { displayWidth } = require('../../kernel/terminal.cjs');
const { section, menu, menuFrame, cmdOption, promptOption, CONTINUE_INSTRUCTION } = require('./surfaces.cjs');
const { titlecase } = require('../conventions.cjs');

const MENU_INSTRUCTION = "emit verbatim as markdown, then STOP for the user's response";
const ASK_INSTRUCTION = "emit verbatim as a code block, then STOP for the user's response";

/** @typedef {import('../baseline.cjs').BaselineState} BaselineState */

/**
 * The baseline area map — an in-progress assessment shows each area's status
 * and what remains; a completed one lists the landed docs. Serves the
 * interview's resume display and the manage view.
 * @param {BaselineState} d
 * @returns {string}
 */
function baselineProgress(d) {
  const lines = [];
  if (d.status === 'completed') {
    lines.push(`Baseline — ${d.areas.length} area(s) documented:`, '');
    for (const a of d.areas) lines.push(`  • ${a.name}.md`);
  } else {
    const pad = Math.max(...d.areas.map((a) => a.name.length));
    lines.push('Baseline in progress:', '');
    for (const a of d.areas) lines.push(`  ${a.name.padEnd(pad)}  [${a.status}]`);
    lines.push('', `${d.remaining} area(s) remain.`);
  }
  return section('DISPLAY: baseline progress', CONTINUE_INSTRUCTION, lines.join('\n'));
}

/**
 * The between-areas gate: the named area just landed, more remain.
 * @param {BaselineState} d @param {string} area
 * @returns {string}
 */
function baselineAreaGate(d, area) {
  const body = menu(
    `**${titlecase(area)}** is documented. ${d.remaining} area(s) remain.`,
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
 * @param {BaselineState} d
 * @returns {string}
 */
function baselinePaused(d) {
  const done = d.areas.length - d.remaining;
  const lines = [
    `Paused — ${done} of ${d.areas.length} area(s) documented.`,
    ...wrapWithPrefix(
      'Everything answered so far is recorded, and the finished docs are already live in the knowledge base.',
      { width: displayWidth() },
    ),
    '',
    'Resume from the workflow-start menu.',
  ];
  return section('DISPLAY: baseline paused', CONTINUE_INSTRUCTION, lines.join('\n'));
}

/**
 * The completion receipt — every area documented and indexed.
 * @param {BaselineState} d
 * @returns {string}
 */
function baselineReceipt(d) {
  const lines = [
    `Baseline complete — ${d.areas.length} area(s) documented and indexed.`,
    '',
  ];
  for (const a of d.areas) lines.push(`  • ${a.name}.md`);
  lines.push('');
  lines.push(...wrapWithPrefix(
    'The thinking phases now surface this as [baseline | …] context in their knowledge queries.',
    { width: displayWidth() },
  ));
  return section('DISPLAY: baseline receipt', CONTINUE_INSTRUCTION, lines.join('\n'));
}

/**
 * @typedef {object} ScopePayload
 * @property {'fresh'|'expand'} mode
 * @property {{name: string, detail: string}[]} areas
 */

/**
 * The scope confirmation — the proposed area list (judgment content, via
 * payload) above its approve/back/adjust gate.
 * @param {ScopePayload} payload
 * @returns {string}
 */
function baselineScopeGate(payload) {
  const list = payload.areas.map((a) => `**${a.name}** — ${a.detail}`).join('\n');
  const body = menu(
    '',
    [
      cmdOption('a', 'approve', 'Lock the list and start the research'),
      cmdOption('b', 'back', 'Leave without changing anything'),
      promptOption('Adjust', 'Tell me what to add, drop, rename, or merge'),
    ],
    { question: 'Assess these areas?' },
  );
  return [
    section('DISPLAY: baseline scope', 'emit verbatim as markdown (not a code block)', list),
    section('MENU: baseline scope gate', MENU_INSTRUCTION, body),
  ].join('\n');
}

/**
 * @typedef {object} RoundPayload
 * @property {string} area
 * @property {{text: string, candidates?: string[]}[]} questions
 */

/**
 * One interview round — numbered questions with lettered candidate answers,
 * closing on the answer-in-any-mix line.
 * @param {RoundPayload} payload
 * @returns {string}
 */
function baselineRound(payload) {
  const lines = [];
  payload.questions.forEach((q, i) => {
    if (i > 0) lines.push('');
    lines.push(...wrapWithPrefix(`${i + 1}. ${q.text}`, { width: displayWidth(), hang: 3 }));
    const candidates = q.candidates || [];
    if (candidates.length > 0) lines.push('');
    candidates.forEach((c, j) => {
      lines.push(...wrapWithPrefix(`${String.fromCharCode(97 + j)}. ${c}`, { width: displayWidth(), prefix: '   ', hang: 3 }));
    });
  });
  lines.push('');
  lines.push(...wrapWithPrefix(
    'Answer in your own words, pick letters, or say "don\'t know" — in any mix.',
    { width: displayWidth() },
  ));
  return section('DISPLAY: baseline round', ASK_INSTRUCTION, lines.join('\n'));
}

/**
 * The doc-landing gate after an area's weave.
 * @returns {string}
 */
function baselineDocGate() {
  const body = menu(
    '',
    [
      cmdOption('a', 'approve', 'Index and commit the doc'),
      cmdOption('v', 'view', 'Read the full doc first'),
      promptOption('Adjust', 'Tell me what to change'),
    ],
    { question: 'Land it?' },
  );
  return section('MENU: baseline doc gate', MENU_INSTRUCTION, body);
}

/**
 * The completed-baseline manage gate.
 * @returns {string}
 */
function baselineManageGate() {
  const body = menu(
    '',
    [
      cmdOption('e', 'expand', 'Add a new area, or deepen an existing one'),
      cmdOption('v', 'view', 'Read an area doc'),
      cmdOption('b', 'back', 'Leave the baseline as it is'),
    ],
    { question: 'What would you like to do?' },
  );
  return section('MENU: baseline manage gate', MENU_INSTRUCTION, body);
}

/**
 * The doc picker under manage's view.
 * @returns {string}
 */
function baselineDocPick() {
  const body = menuFrame(['Which doc? (enter the area name, or **`b/back`**)']);
  return section('MENU: baseline doc pick', MENU_INSTRUCTION, body);
}

/**
 * The one-time boot offer — workflow-start's Step 0.4 gate.
 * @returns {string}
 */
function baselineOfferGate() {
  const body = menu(
    '',
    [
      cmdOption('y', 'yes', 'Start the assessment now'),
      cmdOption('n', 'no', 'Skip — you can start it later from the workflow-start menus'),
    ],
    { question: 'Run a baseline assessment?' },
  );
  return section('MENU: baseline offer', MENU_INSTRUCTION, body);
}

module.exports = {
  baselineProgress,
  baselineAreaGate,
  baselinePaused,
  baselineReceipt,
  baselineScopeGate,
  baselineRound,
  baselineDocGate,
  baselineManageGate,
  baselineDocPick,
  baselineOfferGate,
};
