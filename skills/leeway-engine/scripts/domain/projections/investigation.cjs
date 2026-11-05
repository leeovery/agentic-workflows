'use strict';

// ---------------------------------------------------------------------------
// Domain ring: an investigation's process gates as the person sees them
// (19.4.19), drawn from the hunt its log holds (investigation-log.cjs) and
// Claude's staged payload (investigation.cjs), each a display and a gate:
// - the plan (19.4.24): the hypotheses still open, in the order Claude will
//   check them, each with how; those settled so far; and, where a finding
//   brought a revised plan back, what it changed, first. Its gate is the
//   plan gate, the revised plan's too: yes goes ahead in that order;
// - the check-in: every hypothesis and where it stands, those just resolved
//   marked; the experiments, each with what it showed; and what is checked
//   next. Its gate's yes carries on;
// - the conclude (19.4.23): THE HUNT, Claude's recap; the symptoms, in the
//   person's words; the root cause told against them; and the fix
//   direction. A departure still to be asked its verdict is asked first,
//   under the verdict gate at the conclusion (16.10.11); then the conclude
//   gate: yes concludes the investigation (investigation-conclude.cjs), keep
//   going carries the hunt on.
// Each gate's comment takes what the person would change.
// ---------------------------------------------------------------------------

const { section, dataSection, menu, cmdOption, promptOption, MENU_INSTRUCTION, CONTINUE_INSTRUCTION } = require('./surfaces.cjs');
const { block, verdictBlock, verdictGate } = require('./closing.cjs');
const { renderTree, wrapWithPrefix } = require('../../kernel/render.cjs');
const { TREE_WIDTH } = require('../conventions.cjs');
const { counted } = require('./map.cjs');

/** @typedef {import('../investigation-log.cjs').Hypothesis} Hypothesis */
/** @typedef {import('../investigation-log.cjs').Experiment} Experiment */
/** @typedef {import('./surfaces.cjs').Next} Next */

/**
 * The plan as it is drawn: the topic as screens title it, each open
 * hypothesis in order with how it is checked, the settled ones, and what the
 * finding changed, null on a first plan.
 * @typedef {{title: string, order: {hypothesis: Hypothesis, check: string}[], settled: Hypothesis[], changed: string|null}} PlanView
 */

/**
 * The check-in as it is drawn: the topic as screens title it, every
 * hypothesis, those just resolved by name, the experiments and what comes
 * next.
 * @typedef {{title: string, hypotheses: Hypothesis[], resolved: string[], experiments: Experiment[], next: string}} CheckInView
 */

/**
 * The conclude as it is drawn: the bugfix, the topic as screens title it,
 * Claude's recap, the symptoms in the person's words, the root cause and the
 * fix, each in its words, the verdict asked, and the areas the project's
 * bugfixes have recorded, for Claude alone.
 * @typedef {{unit: string, title: string, hunt: string, symptoms: string[], rootCause: string, fix: string, verdict: import('../ledger-verdicts.cjs').AskedVerdict|null, areas: string[]}} ConcludeView
 */

const INDENT = '  ';

/** Each state's glyph, as 20.12.1 draws it. @type {Readonly<Record<string, string>>} */
const GLYPHS = Object.freeze({ suspected: '○', confirmed: '✓', 'ruled-out': '–', intended: '–' });

/** Each state as a screen says it. @type {Readonly<Record<string, string>>} */
const STATE_WORDS = Object.freeze({ suspected: 'open', confirmed: 'confirmed', 'ruled-out': 'ruled out', intended: 'intended' });

const GO = { next: /** @type {Next} */ ({ kind: 'continue' }) };

/** A hypothesis's row's title. @param {Hypothesis} hypothesis */
const rowTitle = ({ name, title, state }) => `${GLYPHS[state]} ${name} ${title}`;

/** Words, wrapped under a block's heading. @param {string} text */
const indented = (text) => wrapWithPrefix(text, { width: TREE_WIDTH, prefix: INDENT }).join('\n');

/** Words as a bullet under a block's heading, wrapped beneath it. @param {string} text */
const bulleted = (text) => wrapWithPrefix(text, { width: TREE_WIDTH, prefix: INDENT, hang: 2 }).map((line, at) => (at === 0 ? `${INDENT}• ${line.slice(INDENT.length)}` : line)).join('\n');

/** The screen's header: the topic, and which screen. @param {string} title @param {string} which */
const header = (title, which) => `${title} · ${which}`;

/** The hypotheses settled so far, each with its state. @param {Hypothesis[]} settled */
function settledBlock(settled) {
  return block(`SETTLED SO FAR (${settled.length})`, renderTree(settled.map((hypothesis) => ({ title: rowTitle(hypothesis), tag: STATE_WORDS[hypothesis.state] })), { width: TREE_WIDTH }));
}

/**
 * The plan: what the finding changed, where it brought a revised plan back;
 * the open hypotheses in order, each with how it is checked; the settled
 * ones; then the plan gate.
 * @param {PlanView} view @returns {string}
 */
function planScreen({ title, order, settled, changed }) {
  const blocks = [header(title, changed === null ? 'investigation plan' : 'revised plan')];
  if (changed !== null) blocks.push(block('WHAT THE FINDING CHANGED', indented(changed)));
  blocks.push(block(`IN THE ORDER I'LL CHECK THEM (${order.length})`, renderTree(order.map(({ hypothesis, check }) => ({ title: rowTitle(hypothesis), body: [check] })), { width: TREE_WIDTH })));
  if (settled.length > 0) blocks.push(settledBlock(settled));
  return section('DISPLAY: investigation plan', CONTINUE_INSTRUCTION, blocks.join('\n\n'))
    + section('MENU: plan gate', MENU_INSTRUCTION, menu('', [
      cmdOption('y', 'yes', 'Go ahead with the analysis in this order', GO),
      promptOption('Comment', 'Tell me what to change — a hypothesis, or the order'),
    ], { question: 'Go ahead in this order?' }));
}

/** The hunt's counts: the hypotheses, how many confirmed, and the experiments. @param {Hypothesis[]} hypotheses @param {Experiment[]} experiments */
function facts(hypotheses, experiments) {
  const confirmed = hypotheses.filter(({ state }) => state === 'confirmed').length;
  return [counted(hypotheses.length, 'hypothesis', 'hypotheses'), `${confirmed} confirmed`, counted(experiments.length, 'experiment')].join(' · ');
}

/**
 * The check-in: every hypothesis, those just resolved marked; the
 * experiments; what comes next; then the check-in gate.
 * @param {CheckInView} view @returns {string}
 */
function checkInScreen({ title, hypotheses, resolved, experiments, next }) {
  const rows = hypotheses.map((hypothesis) => ({
    title: rowTitle(hypothesis),
    tag: resolved.includes(hypothesis.name) ? `${STATE_WORDS[hypothesis.state]} · just now` : STATE_WORDS[hypothesis.state],
  }));
  const blocks = [header(title, 'check-in'), facts(hypotheses, experiments)];
  blocks.push(block(`HYPOTHESES (${hypotheses.length})`, renderTree(rows, { width: TREE_WIDTH })));
  if (experiments.length > 0) {
    blocks.push(block(`EXPERIMENTS (${experiments.length})`, renderTree(experiments.map(({ name, title, showed }) => ({ title: `✓ ${name} ${title}`, body: [showed] })), { width: TREE_WIDTH })));
  }
  blocks.push(block('NEXT', indented(next)));
  return section('DISPLAY: investigation check-in', CONTINUE_INSTRUCTION, blocks.join('\n\n'))
    + section('MENU: check-in gate', MENU_INSTRUCTION, menu('', [
      cmdOption('y', 'yes', 'Carry on with what\'s next', GO),
      promptOption('Comment', 'Tell me what to look at instead, or what this changes'),
    ], { question: 'Carry on?' }));
}

/**
 * The conclude: the recap, the symptoms, the root cause and the fix
 * direction; then the verdict gate while a departure waits to be asked,
 * else the conclude gate.
 * @param {ConcludeView} view @returns {string}
 */
function concludeScreen({ unit, title, hunt, symptoms, rootCause, fix, verdict, areas }) {
  const blocks = [header(title, 'conclude'), block('THE HUNT', indented(hunt))];
  if (symptoms.length > 0) blocks.push(block(`SYMPTOMS (${symptoms.length})`, symptoms.map(bulleted).join('\n')));
  blocks.push(block('ROOT CAUSE', indented(rootCause)), block('FIX DIRECTION', indented(fix)));
  if (verdict !== null) blocks.push(verdictBlock(verdict));
  const data = areas.length === 0 ? '' : dataSection(areas.map((area) => `area: ${area}`));
  const display = data + section('DISPLAY: investigation conclude', CONTINUE_INSTRUCTION, blocks.join('\n\n'));
  if (verdict !== null) return display + verdictGate(verdict, 'conclusion');
  return display + section('MENU: conclude gate', MENU_INSTRUCTION, menu('', [
    cmdOption('y', 'yes', 'Conclude it, and move on to the spec', { next: { kind: 'engine', argv: ['investigation', 'conclude', unit] } }),
    cmdOption('k', 'keep going', 'Keep investigating — there is more to look at', GO),
    promptOption('Comment', 'Tell me what does not match what you saw'),
  ], { question: 'Conclude the investigation?' }));
}

module.exports = { planScreen, checkInScreen, concludeScreen };
