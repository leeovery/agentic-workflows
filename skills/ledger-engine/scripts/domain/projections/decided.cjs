'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a topic's close as the person sees it (9.7), drawn from the
// record and Claude's staged payload (decided.cjs):
// - the decided screen (9.7.3): the topic's close (closing.cjs) — what the
//   person decided and what was carried over, Claude's calls counted by
//   kind, the product-record lines and withdrawals, and the candidates — and
//   every checklist item skipped, with its reason (6.4.5). Then the first
//   departure on the topic still to be asked its verdict (16.10.2) — the
//   verdict gate, one at a time — and once none is, the decided gate, an
//   authority gate that always stops (3.2.3): its yes covers the lines, the
//   withdrawals and every candidate not struck, their counts in words;
// - the pick of the candidate to strike, where more than one stands (P8),
//   on the decided screen or a feature's ready to build, which shows its
//   topic's close (9.7.6);
// - the wait for the topic's agents still running (9.7.8), a learned process
//   gate (9.8.12): its wait draws the gate again once their reports land,
//   its go goes on.
// ---------------------------------------------------------------------------

const { section, menu, cmdOption, promptOption, callout, MENU_INSTRUCTION, CONTINUE_INSTRUCTION } = require('./surfaces.cjs');
const { runs, callsBlock, decidedBlocks, recordBlocks, candidateWords, marksDecided, strikeRows, verdictBlock, verdictGate } = require('./closing.cjs');
const { TREE_WIDTH, titlecase } = require('../conventions.cjs');
const { counted } = require('./map.cjs');

/**
 * The decided screen as it is drawn, `title` the topic as screens title it.
 * @typedef {Omit<import('./closing.cjs').TopicClose, 'called'> & {
 *   title: string,
 *   calls: import('./closing.cjs').ShownCall[],
 *   listed: boolean,
 *   skips: {text: string, reason: string}[],
 *   verdict: import('../ledger-verdicts.cjs').AskedVerdict|null,
 * }} DecidedView
 */

/** The topic's close the screen draws, its calls counted. @param {DecidedView} view @returns {import('./closing.cjs').TopicClose} */
const closeOf = (view) => ({ ...view, called: view.calls.length });

/**
 * The decided screen's display: each block that has something to show.
 * @param {DecidedView} view
 */
function decidedDisplay(view) {
  const { title, calls, listed, skips, verdict } = view;
  const blocks = [`${title} — decided`, ...decidedBlocks(closeOf(view))];
  if (calls.length > 0) blocks.push(callsBlock(calls, listed));
  blocks.push(...recordBlocks(closeOf(view)));
  if (skips.length > 0) blocks.push(skips.map(({ text, reason }) => callout(`Skipped: ${text} — ${reason}`, { width: TREE_WIDTH })).join('\n'));
  if (verdict !== null) blocks.push(verdictBlock(verdict));
  return blocks.join('\n\n');
}

/**
 * The decided gate: the yes, Claude's calls opened where they are not
 * listed, the strike where a candidate stands, and a comment.
 * @param {DecidedView} view
 */
function decidedGate(view) {
  const { unit, topic, title, calls, listed } = view;
  const rows = [
    cmdOption('y', 'yes', 'Mark it decided', runs(['decided', 'yes', unit, topic])),
    ...(calls.length > 0 && !listed ? [cmdOption('c', 'calls', `See Claude's ${counted(calls.length, 'call')}`, runs(['render', 'decided', `${unit}.${topic}`, '--calls']))] : []),
    ...strikeRows(closeOf(view), 's'),
    promptOption('Comment', 'Tell me what to change — a product-record line included'),
  ];
  return section('MENU: decided', MENU_INSTRUCTION, menu(`Your yes ${marksDecided(closeOf(view), title)}.`, rows, { question: 'Mark it decided?' }));
}

/**
 * The decided screen: its display, then the verdict gate while a departure
 * waits to be asked, else the decided gate.
 * @param {DecidedView} view
 * @returns {string}
 */
function decidedScreen(view) {
  const display = section('DISPLAY: decided', CONTINUE_INSTRUCTION, decidedDisplay(view));
  return display + (view.verdict === null ? decidedGate(view) : verdictGate(view.verdict, 'decided'));
}

/**
 * The pick of the candidate to strike: each standing candidate by its
 * number on the screen, `flags` carried into what it runs, and back to the
 * screen the pick was made from, `back` its name and what draws it.
 * @param {{unit: string, topic: string, parks: boolean, candidates: {name: string, struck: boolean}[], flags: string[], back: {to: string, argv: string[]}}} view
 * @returns {string}
 */
function strikePick(view) {
  const { unit, topic, parks, candidates, flags, back } = view;
  const rows = candidates.flatMap(({ name, struck }, at) => (struck ? [] : [
    cmdOption(String(at + 1), null, { head: titlecase(name) }, runs(['decided', 'strike', unit, topic, String(at + 1), ...flags])),
  ]));
  rows.push(cmdOption('b', 'back', `Back to ${back.to} — nothing struck`, runs(back.argv)));
  return section('MENU: decided strike', MENU_INSTRUCTION, menu('', rows, { question: candidateWords(parks).ask }));
}

/** The kinds of agent whose plural is not their name and an s. @type {Readonly<Record<string, string>>} */
const PLURAL_KINDS = Object.freeze({ synthesis: 'syntheses', 'closing-pass': 'closing passes' });

/** `n` agents of a kind, as the person reads them: `1 deep dive`, `2 closing passes`. @param {number} n @param {string} kind */
function agentsOfKind(n, kind) {
  return counted(n, kind.replaceAll('-', ' '), PLURAL_KINDS[kind] ?? `${kind.replaceAll('-', ' ')}s`);
}

/**
 * The wait for the topic's agents still running (9.7.8): which are, by kind,
 * and whether to wait for what they find — the gate drawn again once their
 * reports land, empty when none still runs — or go on to the close, a report
 * landing later taken in when the topic next opens.
 * @param {string} unit @param {string} topic @param {string} title the topic as screens title it @param {string[]} kinds the kind of each agent running, in dispatch order
 * @param {import('../learned-gates.cjs').GateStep} step the gate's, a learned one
 * @returns {string}
 */
function waitAgents(unit, topic, title, kinds, step) {
  /** @type {Map<string, number>} */
  const byKind = new Map();
  for (const kind of kinds) byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
  const running = [...byKind].map(([kind, n]) => agentsOfKind(n, kind)).join(', ');
  return section('MENU: wait for agents', MENU_INSTRUCTION, menu(`Still running on ${title}: ${running}.`, [
    cmdOption('w', 'wait', 'Wait — take in what they find first', runs(['render', 'wait-agents', `${unit}.${topic}`])),
    cmdOption('g', 'go', 'Go on — their reports wait for the next opening', { next: { kind: 'continue' } }),
  ], { question: 'Wait for them?' }), step);
}

module.exports = { decidedScreen, strikePick, waitAgents };
