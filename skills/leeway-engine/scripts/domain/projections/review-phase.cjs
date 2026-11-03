'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the review phase as the person sees it (14.4), drawn from its
// rounds' records (review-phase.cjs) and the ledger.
//
// - A round's report (14.4.1) is short and product first: what the person
//   can now do; what was proven by running it, and what was not, in the
//   standing's own words (15.3.3, 15.3.5); what was fixed — the findings
//   whose fix tasks, to this round, are done — and, plainly, those whose fix
//   task was closed, nothing built; this round's fix tasks not yet built, as
//   the build phase they make; what went to the inbox, never what was
//   dropped (14.3.6); how Claude settled a failing round, where it did
//   (14.6.3); and one line counting the calls decided for the person,
//   without kinds until the labeller (P11, 29.19). Its detailed checks are
//   in a file, never shown (14.4.2). `review round` writes it as
//   `round-{N}.md`, what the round decided — its fix tasks as filed, no
//   standing claimed; the screen draws each fix's standing as it is.
// - The report closing the review phase (14.4.3), the certificate: whether
//   it passed or Claude settled it, and in which round; every round, broken
//   up by round; then every call decided for the person across the unit,
//   with the build's share. The round that ends the review phase is written
//   as it.
// - The calls, when the person asks (14.4.4): every one decided for them,
//   grouped by the kind each carries, in the ledger's order of kinds
//   (16.11.3), those that change what the product does first, then process
//   and internals, those the labeller has not reached last, as unlabelled
//   (P11).
// ---------------------------------------------------------------------------

const { section, clipped, CONTINUE_INSTRUCTION } = require('./surfaces.cjs');
const { renderTree } = require('../../kernel/render.cjs');
const { TREE_WIDTH } = require('../conventions.cjs');
const { counted, ROW_MAX } = require('./map.cjs');
const { block } = require('./closing.cjs');
const { KINDS } = require('../event-fields.cjs');

/** @typedef {import('../review-phase.cjs').UnitCall} UnitCall */

/**
 * A round as its report draws it: its number and verdict; how Claude
 * settled it, or null; what the person can now do; each scenario of the
 * cut by id with its wording and standing; how many fix tasks it made; the
 * findings whose fix tasks to it are done, and those whose task was
 * closed; its own fix tasks not yet built, each by its task with the
 * finding it answers, and the phase they make; and what it filed to the
 * inbox, each item by its title and kind.
 * @typedef {{
 *   round: number, passed: boolean, settled: string|null, can_now: string[],
 *   scenarios: {scenario: string, wording: string, standing: string}[],
 *   made: number, fixed: string[], unbuilt: string[], fixing: {task: string, text: string}[], phase: number, filed: {title: string, kind: string}[],
 * }} RoundView
 */
/** The calls decided for the person across the unit, and how many of them were made in the build. @typedef {{count: number, build: number}} CallsCount */

/** Items drawn as a list beneath a block's heading. @param {string[]} items */
const listed = (items) => renderTree(items.map((title) => ({ title })), { width: TREE_WIDTH, wrapTitles: true });

/** A round's verdict, as its heading says it. @param {RoundView} view */
function verdictWords({ passed, settled, made, phase }) {
  const fixes = made === 0 ? '' : ` — ${counted(made, 'fix task')}, phase ${phase}`;
  if (passed) return `passed${fixes}`;
  return settled === null ? `failed${fixes}` : `failed, settled${fixes}`;
}

/** A round's blocks, each that has something to show (the header's). @param {RoundView} view @returns {string[]} */
function roundBlocks(view) {
  const proven = view.scenarios.filter(({ standing }) => standing === 'proven');
  const unproven = view.scenarios.filter(({ standing }) => standing !== 'proven');
  return [
    ...(view.can_now.length === 0 ? [] : [block('WHAT YOU CAN NOW DO', listed(view.can_now))]),
    ...(proven.length === 0 ? [] : [block(`PROVEN BY RUNNING IT (${proven.length} of ${view.scenarios.length})`, listed(proven.map(({ scenario, wording }) => `${scenario} ${wording}`)))]),
    ...(unproven.length === 0 ? [] : [block(`NOT PROVEN (${unproven.length})`, listed(unproven.map(({ scenario, wording, standing }) => `${scenario} ${wording} — ${standing}`)))]),
    ...(view.fixed.length === 0 ? [] : [block(`FIXED (${view.fixed.length})`, listed(view.fixed))]),
    ...(view.unbuilt.length === 0 ? [] : [block(`NOT BUILT (${view.unbuilt.length})`, listed(view.unbuilt.map((text) => `${text} — its fix task was closed`)))]),
    ...(view.fixing.length === 0 ? [] : [block(`TO FIX, PHASE ${view.phase} (${counted(view.fixing.length, 'task')})`, listed(view.fixing.map(({ task, text }) => `${task} ${text}`)))]),
    ...(view.filed.length === 0 ? [] : [block(`WENT TO THE INBOX (${view.filed.length})`, listed(view.filed.map(({ title, kind }) => `${title} (${kind})`)))]),
    ...(view.settled === null ? [] : [block('SETTLED', listed([view.settled]))]),
  ];
}

/** The line counting the calls decided for the person, and how to see them. @param {string} unit @param {CallsCount} calls @param {boolean} share whether to say the build's share */
function callsLine(unit, { count, build }, share) {
  const of = share ? `${counted(count, 'call')} across the work unit, ${build} of them in the build` : counted(count, 'call');
  return block('CALLS DECIDED FOR YOU', `  ${of} — render review-calls ${unit} lists them`);
}

/** A round's report as text (the header's). @param {string} unit @param {string} title @param {RoundView} view @param {CallsCount} calls */
function roundReport(unit, title, view, calls) {
  return [`${title} — review, round ${view.round}: ${verdictWords(view)}`, ...roundBlocks(view), callsLine(unit, calls, false)].join('\n\n');
}

/** The report closing the review phase as text (the header's). @param {string} unit @param {string} title @param {RoundView[]} views @param {CallsCount} calls */
function closingReport(unit, title, views, calls) {
  const rounds = views.map((view) => [`ROUND ${view.round} — ${verdictWords(view)}`, ...roundBlocks(view)].join('\n\n'));
  const ended = views.at(-1)?.passed ? 'passed' : 'settled';
  return [`${title} — review ${ended} in round ${views.length}, the certificate of the work`, ...rounds, callsLine(unit, calls, true)].join('\n\n');
}

/** A report drawn as a screen. @param {string} text */
const reportScreen = (text) => section('DISPLAY: review report', CONTINUE_INSTRUCTION, text);

/** The kinds that never change what the product does. */
const INNER_KINDS = Object.freeze(['process', 'internals']);
/** The groups' order: the ledger's kinds that change what the product does, then the others. */
const KIND_ORDER = Object.freeze([...KINDS.filter((kind) => !INNER_KINDS.includes(kind)), ...INNER_KINDS]);

/** A kind's place among the groups, the unlabelled last. @param {string|null} kind */
const kindRank = (kind) => (kind === null ? KIND_ORDER.length : KIND_ORDER.indexOf(kind));

/** Two kinds in the groups' order. @param {[string|null, unknown]} a @param {[string|null, unknown]} b */
const byKind = ([a], [b]) => kindRank(a) - kindRank(b);

/**
 * The calls decided for the person, grouped by kind (the header's), each
 * its question cut to keep its tag on the line — where it was made, and how
 * the person handed it over where they did — its answer beneath.
 * @param {string} unit @param {string} title @param {UnitCall[]} calls
 */
function reviewCallsScreen(unit, title, calls) {
  /** @type {Map<string|null, UnitCall[]>} */
  const groups = new Map();
  for (const call of calls) groups.set(call.kind, [...(groups.get(call.kind) ?? []), call]);
  const ordered = [...groups].sort(byKind);
  const blocks = ordered.map(([kind, of]) => block(`${(kind ?? 'unlabelled').toUpperCase()} (${of.length})`, renderTree(of.map(({ question, answer, phase, handed }) => ({
    title: `◇ ${clipped(question ?? answer, ROW_MAX)}`,
    tag: [phase, ...(handed === null ? [] : [handed])].join(' · '),
    body: question === null ? [] : [answer],
  })), { width: TREE_WIDTH })));
  const head = `${title} — ${counted(calls.length, 'call')} decided for you`;
  return section('DISPLAY: review calls', CONTINUE_INSTRUCTION, [head, ...(blocks.length === 0 ? ['  None — every call in this work unit was yours.'] : blocks)].join('\n\n'));
}

module.exports = { roundReport, closingReport, reportScreen, reviewCallsScreen };
