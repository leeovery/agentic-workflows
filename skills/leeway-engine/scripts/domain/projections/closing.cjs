'use strict';

// ---------------------------------------------------------------------------
// Domain ring: what an authority gate closing work shows of the record, drawn
// alike by a topic's decided screen (projections/decided.cjs) and ready to
// build (projections/ready-to-build.cjs):
// - Claude's calls, counted by the kind each carries, a call the labeller
//   has not reached counted as unlabelled (16.11), and opened to list them,
//   one the person handed over marked so (9.5.4);
// - the first departure still to be asked its verdict — what it decides,
//   Claude's answer and the person's — and the verdict gate over it, each
//   verdict given at the gate's own point (16.10.2, 16.10.11).
// ---------------------------------------------------------------------------

const { section, menu, cmdOption, clipped, MENU_INSTRUCTION } = require('./surfaces.cjs');
const { renderTree } = require('../../kernel/render.cjs');
const { TREE_WIDTH } = require('../conventions.cjs');
const { ROW_MAX, counted } = require('./map.cjs');

/** A call of Claude's as a gate shows it: the question it answers, its answer, its kind and how the person handed it over. @typedef {{question: string|null, answer: string, kind: string|null, handed: string|null}} ShownCall */
/** @typedef {import('../ledger-verdicts.cjs').AskedVerdict} AskedVerdict */

/** A block's heading and its lines. @param {string} heading @param {string} body */
function block(heading, body) {
  return `${heading}\n${body.replace(/\n+$/, '')}`;
}

/** Words as the person reads them, `last` before the last: `a`, `a or b`, `a, b or c`. @param {string[]} words @param {string} last */
function series(words, last) {
  return words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} ${last} ${words.at(-1)}`;
}

/** Claude's calls by kind, most first, the unlabelled last: `2 behaviour · 1 look · 3 unlabelled`. @param {ShownCall[]} calls */
function kindCounts(calls) {
  /** @type {Map<string, number>} */
  const kinds = new Map();
  for (const { kind } of calls) if (kind !== null) kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
  const unlabelled = calls.filter(({ kind }) => kind === null).length;
  const labelled = [...kinds].sort(([, a], [, b]) => b - a).map(([kind, n]) => `${n} ${kind}`);
  return [...labelled, ...(unlabelled > 0 ? [`${unlabelled} unlabelled — the labeller gives each its kind`] : [])].join(' · ');
}

/** Each of Claude's calls, its question cut to keep its tag on the line — its kind, and how the person handed it over where they did — its answer beneath. @param {ShownCall[]} calls */
function callTree(calls) {
  return renderTree(calls.map(({ question, answer, kind, handed }) => ({
    title: `◇ ${clipped(question ?? answer, ROW_MAX)}`,
    tag: [kind ?? 'unlabelled', ...(handed === null ? [] : [handed])].join(' · '),
    body: question === null ? [] : [answer],
  })), { width: TREE_WIDTH });
}

/** The calls block: their count by kind, listed beneath where `listed`. @param {ShownCall[]} calls @param {boolean} listed */
function callsBlock(calls, listed) {
  return block(`CLAUDE'S CALLS (${calls.length})`, `  ${kindCounts(calls)}${listed ? `\n${callTree(calls)}` : ''}`);
}

/** The verdict asked of one departure: the question, Claude's answer and the person's. @param {AskedVerdict} verdict */
function verdictBlock({ at, of, question, lean, yours }) {
  return block(`YOUR VERDICT (${at} of ${counted(of, 'call')} you changed)`, renderTree([{
    title: clipped(question, ROW_MAX),
    body: [...(lean === null ? [] : [`My answer: ${lean}`]), `Yours: ${yours}`],
  }], { width: TREE_WIDTH }));
}

/**
 * The verdict gate over the departure a screen asks about: each verdict
 * given at `point`, the verdict point the screen is.
 * @param {AskedVerdict} verdict @param {string} point
 */
function verdictGate({ entry }, point) {
  /** @param {string} verdict @returns {{next: import('./surfaces.cjs').Next}} */
  const give = (verdict) => ({ next: { kind: 'engine', argv: ['verdict', 'give', entry, verdict, '--at', point] } });
  return section('MENU: verdict', MENU_INSTRUCTION, menu('', [
    cmdOption('n', 'nothing', 'Nothing — mine would have served as well', give('nothing')),
    cmdOption('f', 'fix', 'A fix later', give('fix')),
    cmdOption('l', 'loss', 'A real loss', give('loss')),
    cmdOption('s', 'skip', 'Skip — I can\'t call it yet; it waits in the verdict queue', give('skip')),
  ], { question: 'What would my answer have cost the product?' }));
}

module.exports = { block, series, callsBlock, verdictBlock, verdictGate };
