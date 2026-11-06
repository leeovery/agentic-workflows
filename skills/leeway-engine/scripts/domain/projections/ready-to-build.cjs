'use strict';

// ---------------------------------------------------------------------------
// Domain ring: ready to build as the person sees it (11.8.2, 11.8.8), drawn
// from the spec, the cut on the manifest and the ledger (ready-to-build.cjs).
// A feature's is one screen with its topic's decided (9.7.6, 11.8.5): its
// title says so, `{Title} — decided, and ready to build`, and it draws the
// topic's close (closing.cjs) — WHAT YOU DECIDED before Claude's calls, the
// product-record lines and the candidates after them — beside the spec's
// parts; its foot says the pick marks the topic decided with what it covers,
// it strikes a candidate on `x`, `s` being the step, and its comment takes
// a change to any of it. An epic's or a bugfix's is the feature's screen
// without the parts that belong to the feature's decided: the title,
// Claude's calls at the spec counted by kind (closing.cjs), THE OUTLINE —
// the spec's areas — and THE PHASE CUT, each phase with its scenarios
// counted and the sections it draws on; every checklist item skipped, with
// its reason (6.4.5); then the first departure still to be asked its
// verdict (16.10.11), at the point the view names — the verdict gate, one
// at a time — and once none is, ready to build's gate, an authority gate
// that always stops (11.8.1): the build's position, auto first and
// recommended, nothing preselected (3.3.9); the review page, offered only
// where the session can publish one (11.11.11); Claude's calls opened; and
// a comment. Its foot says what the pick does — and, while the review page
// is open, what it records of the review (11.11.7).
// ---------------------------------------------------------------------------

const { section, menu, cmdOption, promptOption, callout, MENU_INSTRUCTION, CONTINUE_INSTRUCTION } = require('./surfaces.cjs');
const { renderTree } = require('../../kernel/render.cjs');
const { TREE_WIDTH } = require('../conventions.cjs');
const { counted } = require('./map.cjs');
const { runs, block, series, callsBlock, decidedBlocks, recordBlocks, marksDecided, strikeRows, verdictBlock, verdictGate } = require('./closing.cjs');

/**
 * Ready to build as it is drawn: the unit and its title; Claude's calls,
 * listed or counted; the spec's areas; the cut's phases; the checklists'
 * skips; the verdict asked and the point it is given at; a feature's
 * topic's close, null for any other unit; whether the session can publish
 * the review page; and, while it is open, its counts by the marks last
 * stored — null while it is not — with where Claude reads its marks back
 * to.
 * @typedef {{
 *   unit: string, title: string,
 *   calls: import('./closing.cjs').ShownCall[], listed: boolean,
 *   outline: {number: string, title: string}[],
 *   phases: {name: string, scenarios: number, sections: string[]}[],
 *   skips: {text: string, reason: string}[],
 *   verdict: import('../ledger-verdicts.cjs').AskedVerdict|null,
 *   point: string,
 *   close: import('./closing.cjs').TopicClose|null,
 *   page: boolean,
 *   review: {ticked: number, claudes: number, other: number}|null,
 *   readBack: string,
 * }} ReadyView
 */

/** The spec's areas, numbered, their numbers right-aligned. @param {ReadyView['outline']} outline */
function outlineBlock(outline) {
  const width = Math.max(...outline.map(({ number }) => number.length));
  return block(`THE OUTLINE (${counted(outline.length, 'section')})`, renderTree(outline.map(({ number, title }) => ({ title: `${number.padStart(width)} ${title}` })), { width: TREE_WIDTH }));
}

/** The cut's phases in build order, each with its scenarios counted and the sections it draws on. @param {ReadyView['phases']} phases */
function cutBlock(phases) {
  const scenarios = phases.reduce((sum, phase) => sum + phase.scenarios, 0);
  return block(`THE PHASE CUT (${counted(phases.length, 'phase')} · ${counted(scenarios, 'scenario')})`, renderTree(phases.map(({ name, scenarios: n, sections }, at) => ({
    title: `${at + 1} ${name}`,
    body: [`${counted(n, 'scenario')} · draws on §${sections.join(', ')}`],
  })), { width: TREE_WIDTH }));
}

/** The screen's display: each block that has something to show, a feature's topic's close around Claude's calls. @param {ReadyView} view */
function readyDisplay({ title, calls, listed, outline, phases, skips, verdict, close }) {
  const blocks = [close === null ? `${title} — ready to build` : `${title} — decided, and ready to build`];
  if (close !== null) blocks.push(...decidedBlocks(close));
  if (calls.length > 0) blocks.push(callsBlock(calls, listed));
  if (close !== null) blocks.push(...recordBlocks(close));
  blocks.push(outlineBlock(outline), cutBlock(phases));
  if (skips.length > 0) blocks.push(skips.map(({ text, reason }) => callout(`Skipped: ${text} — ${reason}`, { width: TREE_WIDTH })).join('\n'));
  if (verdict !== null) blocks.push(verdictBlock(verdict));
  return blocks.join('\n\n');
}

/** What the pick records of the open review page: the lines ticked, those carrying Claude's tick let stand, and the rest passing without review. @param {NonNullable<ReadyView['review']>} review */
function recordsReview({ ticked, claudes, other }) {
  const recorded = [
    ...(ticked > 0 ? [`the ${counted(ticked, 'line')} you ticked on the review page`] : []),
    ...(claudes > 0 ? [`the ${claudes} carrying Claude's tick that you let stand`] : []),
  ];
  const pass = other === 1 ? 'passes' : 'pass';
  if (recorded.length === 0) return `records that you ticked no line on the review page (${other === 1 ? 'its one line' : `all ${counted(other, 'line')}`} ${pass} without review)`;
  return `records ${series(recorded, 'and')}${other > 0 ? ` (the other ${other} ${pass} without review)` : ''}`;
}

/** What the pick does, said above the gate. @param {ReadyView} view */
function foot({ title, close, review }) {
  const does = [
    ...(close === null ? [] : [marksDecided(close, title)]),
    'approves the outline and the phase cut',
    ...(review === null ? [] : [recordsReview(review)]),
  ];
  return `Your pick ${does.join(', ')}, and starts the build in that position.`;
}

/**
 * Ready to build's gate: the two positions, auto first; the review row
 * where the session can publish the page — taking the review while it is
 * not open, reading its comments once it is; Claude's calls opened where
 * they are not listed; a feature's strike where a candidate stands; and a
 * comment.
 * @param {ReadyView} view
 */
function readyGate(view) {
  const { unit, calls, listed, page, review, readBack, close } = view;
  const marks = review === null ? [] : ['--marks', readBack];
  const pageFlag = page ? ['--page'] : [];
  const pick = (/** @type {string} */ position) => runs(['ready-to-build', 'yes', unit, '--position', position, ...marks]);
  const rows = [
    cmdOption('a', 'auto', { head: 'Auto — runs on its own; danger stops what it touches, a question for you parks only what depends on it, and finish waits for you', recommended: true }, pick('auto')),
    cmdOption('s', 'step', 'Step — it also stops after each task, for you to review and test it', pick('step')),
  ];
  if (page && review === null) rows.push(cmdOption('r', 'review', 'Review the spec on a page first — all of it, the parts you care about, or none', runs(['spec', 'page', unit])));
  if (page && review !== null) rows.push(cmdOption('r', 'review', 'Read the comments you\'ve left on the page', runs(['spec', 'marks', unit, '--file', readBack])));
  if (calls.length > 0 && !listed) rows.push(cmdOption('c', 'calls', `See Claude's ${counted(calls.length, 'call')}`, runs(['render', 'ready-to-build', unit, '--calls', ...pageFlag])));
  if (close !== null) rows.push(...strikeRows(close, 'x', pageFlag));
  rows.push(promptOption('Comment', close === null ? 'Ask for a change to the outline or the phase cut' : 'Ask for a change — to what you decided, a product-record line, the outline or the phase cut'));
  return section('MENU: ready to build', MENU_INSTRUCTION, menu(foot(view), rows, { question: 'Build it, and in which position?' }));
}

/**
 * Ready to build: its display, then the verdict gate while a departure
 * waits to be asked, else ready to build's gate.
 * @param {ReadyView} view
 * @returns {string}
 */
function readyToBuildScreen(view) {
  const display = section('DISPLAY: ready to build', CONTINUE_INSTRUCTION, readyDisplay(view));
  return display + (view.verdict === null ? readyGate(view) : verdictGate(view.verdict, view.point));
}

module.exports = { readyToBuildScreen };
